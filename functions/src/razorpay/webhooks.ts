import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// ─── Secrets ─────────────────────────────────────────────────────────────────

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_PLAN_ID = defineSecret('RAZORPAY_PLAN_ID');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRazorpay(keyId: string, keySecret: string) {
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ─── Create Subscription ──────────────────────────────────────────────────────

export const createRazorpaySubscription = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const db = getFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');

    const userData = userSnap.data() as {
      subscription?: { plan?: string; razorpaySubscriptionId?: string };
    };

    if (userData.subscription?.plan === 'pro') {
      throw new HttpsError('already-exists', 'Already on Pro plan');
    }

    const razorpay = getRazorpay(RAZORPAY_KEY_ID.value(), RAZORPAY_KEY_SECRET.value());

    const subscription = await razorpay.subscriptions.create({
      plan_id: RAZORPAY_PLAN_ID.value(),
      customer_notify: 1,
      quantity: 1,
      total_count: 12, // 12 months, auto-renews
      notes: { firebaseUid: uid },
    });

    // Store subscription id on user doc (plan stays 'free' until payment verified)
    await db.doc(`users/${uid}`).set(
      { subscription: { razorpaySubscriptionId: subscription.id } },
      { merge: true }
    );

    return {
      subscriptionId: subscription.id,
      keyId: RAZORPAY_KEY_ID.value(),
    };
  }
);

// ─── Verify Payment ───────────────────────────────────────────────────────────

export const verifyRazorpayPayment = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const { razorpayPaymentId, razorpaySubscriptionId, razorpaySignature } = request.data as {
      razorpayPaymentId: string;
      razorpaySubscriptionId: string;
      razorpaySignature: string;
    };

    // Verify HMAC signature: SHA256(payment_id + "|" + subscription_id, key_secret)
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET.value())
      .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw new HttpsError('invalid-argument', 'Payment signature verification failed');
    }

    const db = getFirestore();

    // Fetch subscription details from Razorpay to get end date
    const razorpay = getRazorpay(RAZORPAY_KEY_ID.value(), RAZORPAY_KEY_SECRET.value());
    const sub = await razorpay.subscriptions.fetch(razorpaySubscriptionId);

    const currentPeriodEnd = sub.current_end
      ? new Date(sub.current_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.doc(`users/${uid}`).set(
      {
        subscription: {
          plan: 'pro',
          razorpaySubscriptionId,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      },
      { merge: true }
    );

    console.log(`[Razorpay] User ${uid} upgraded to Pro — payment ${razorpayPaymentId}`);
    return { success: true };
  }
);

// ─── Cancel Subscription ──────────────────────────────────────────────────────

export const cancelRazorpaySubscription = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const db = getFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    const userData = userSnap.data() as {
      subscription?: { razorpaySubscriptionId?: string };
    };

    const subscriptionId = userData?.subscription?.razorpaySubscriptionId;
    if (!subscriptionId) throw new HttpsError('not-found', 'No active subscription found');

    const razorpay = getRazorpay(RAZORPAY_KEY_ID.value(), RAZORPAY_KEY_SECRET.value());

    // cancel_at_cycle_end: 1 = cancel at end of billing cycle (not immediately)
    await razorpay.subscriptions.cancel(subscriptionId, true);

    await db.doc(`users/${uid}`).set(
      { subscription: { cancelAtPeriodEnd: true } },
      { merge: true }
    );

    console.log(`[Razorpay] User ${uid} cancelled subscription ${subscriptionId}`);
    return { cancelled: true };
  }
);

// ─── Webhook Handler ──────────────────────────────────────────────────────────

export const razorpayWebhook = onRequest(
  { secrets: [RAZORPAY_WEBHOOK_SECRET] },
  async (req, res) => {
    const sig = req.headers['x-razorpay-signature'] as string;
    if (!sig) {
      res.status(400).send('Missing signature');
      return;
    }

    // Verify webhook signature: HMAC-SHA256(rawBody, webhookSecret)
    const expectedSig = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value())
      .update(req.rawBody)
      .digest('hex');

    if (expectedSig !== sig) {
      console.error('[Razorpay Webhook] Signature mismatch');
      res.status(400).send('Signature mismatch');
      return;
    }

    const event = req.body as {
      event: string;
      payload: {
        subscription?: { entity: { id: string; status: string; current_end?: number; notes?: { firebaseUid?: string } } };
        payment?: { entity: { id: string } };
      };
    };

    const db = getFirestore();

    try {
      switch (event.event) {
        case 'subscription.activated': {
          const sub = event.payload.subscription?.entity;
          if (!sub) break;
          const uid = sub.notes?.firebaseUid ?? await findUidBySubscription(db, sub.id);
          if (!uid) break;

          await db.doc(`users/${uid}`).set(
            {
              subscription: {
                plan: 'pro',
                razorpaySubscriptionId: sub.id,
                currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
                cancelAtPeriodEnd: false,
              },
            },
            { merge: true }
          );
          break;
        }

        case 'subscription.charged': {
          const sub = event.payload.subscription?.entity;
          if (!sub) break;
          const uid = await findUidBySubscription(db, sub.id);
          if (!uid) break;

          await db.doc(`users/${uid}`).set(
            {
              subscription: {
                plan: 'pro',
                currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
              },
            },
            { merge: true }
          );
          break;
        }

        case 'subscription.cancelled':
        case 'subscription.expired': {
          const sub = event.payload.subscription?.entity;
          if (!sub) break;
          const uid = await findUidBySubscription(db, sub.id);
          if (!uid) break;

          await db.doc(`users/${uid}`).set(
            {
              subscription: {
                plan: 'free',
                razorpaySubscriptionId: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
              },
            },
            { merge: true }
          );
          console.log(`[Razorpay Webhook] User ${uid} downgraded to Free (${event.event})`);
          break;
        }

        case 'payment.failed': {
          const sub = event.payload.subscription?.entity;
          if (sub) {
            const uid = await findUidBySubscription(db, sub.id);
            if (uid) console.warn(`[Razorpay Webhook] Payment failed for user ${uid}`);
          }
          break;
        }
      }
    } catch (err) {
      console.error('[Razorpay Webhook] Handler error:', err);
      res.status(500).send('Internal error');
      return;
    }

    res.json({ received: true });
  }
);

// ─── Helper ───────────────────────────────────────────────────────────────────

async function findUidBySubscription(
  db: ReturnType<typeof getFirestore>,
  subscriptionId: string
): Promise<string | null> {
  const snap = await db
    .collection('users')
    .where('subscription.razorpaySubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
}
