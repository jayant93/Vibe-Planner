import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

// ─── Secrets ─────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_PRO_PRICE_ID = defineSecret('STRIPE_PRO_PRICE_ID');
const APP_URL = defineSecret('APP_URL');

// ─── Create Checkout Session ──────────────────────────────────────────────────

export const createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, APP_URL] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const db = getFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
    const userData = userSnap.data() as { email?: string; subscription?: { stripeCustomerId?: string } };

    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2024-06-20' });
    const appUrl = APP_URL.value();
    const { successUrl, cancelUrl } = request.data as { successUrl?: string; cancelUrl?: string };

    // Reuse existing Stripe customer if present
    let customerId = userData.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      await db.doc(`users/${uid}`).set(
        { subscription: { stripeCustomerId: customerId } },
        { merge: true }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRO_PRICE_ID.value(), quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl ?? `${appUrl}/settings?upgrade=success`,
      cancel_url: cancelUrl ?? `${appUrl}/upgrade`,
      metadata: { firebaseUid: uid },
    });

    return { url: session.url };
  }
);

// ─── Open Billing Portal ──────────────────────────────────────────────────────

export const openBillingPortal = onCall(
  { secrets: [STRIPE_SECRET_KEY, APP_URL] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const db = getFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    const userData = userSnap.data() as { subscription?: { stripeCustomerId?: string } } | undefined;
    const customerId = userData?.subscription?.stripeCustomerId;
    if (!customerId) throw new HttpsError('not-found', 'No billing account found');

    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2024-06-20' });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL.value()}/settings`,
    });

    return { url: session.url };
  }
);

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2024-06-20' });
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook verification failed';
      console.error('[Stripe Webhook] Signature verification failed:', message);
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    const db = getFirestore();

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const uid = session.metadata?.['firebaseUid'];
          if (!uid || !session.subscription) break;

          const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2024-06-20' });
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);

          await db.doc(`users/${uid}`).set(
            {
              subscription: {
                plan: 'pro',
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: sub.id,
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              },
            },
            { merge: true }
          );
          console.log(`[Stripe] User ${uid} upgraded to Pro`);
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const uid = await findUidByCustomer(db, sub.customer as string);
          if (!uid) break;

          const isActive = sub.status === 'active' || sub.status === 'trialing';
          await db.doc(`users/${uid}`).set(
            {
              subscription: {
                plan: isActive ? 'pro' : 'free',
                stripeSubscriptionId: sub.id,
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              },
            },
            { merge: true }
          );
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const uid = await findUidByCustomer(db, sub.customer as string);
          if (!uid) break;

          await db.doc(`users/${uid}`).set(
            {
              subscription: {
                plan: 'free',
                stripeSubscriptionId: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
              },
            },
            { merge: true }
          );
          console.log(`[Stripe] User ${uid} downgraded to Free`);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const uid = await findUidByCustomer(db, invoice.customer as string);
          if (!uid) break;
          console.warn(`[Stripe] Payment failed for user ${uid}`);
          // Could send a notification here
          break;
        }
      }
    } catch (err) {
      console.error('[Stripe Webhook] Handler error:', err);
      res.status(500).send('Internal error');
      return;
    }

    res.json({ received: true });
  }
);

// ─── Helper ───────────────────────────────────────────────────────────────────

async function findUidByCustomer(
  db: ReturnType<typeof getFirestore>,
  customerId: string
): Promise<string | null> {
  const snap = await db
    .collection('users')
    .where('subscription.stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
}
