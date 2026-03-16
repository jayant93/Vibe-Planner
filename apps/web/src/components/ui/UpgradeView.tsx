'use client';

import { useState } from 'react';
import {
  callCreateRazorpaySubscription,
  callVerifyRazorpayPayment,
  callCancelRazorpaySubscription,
} from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { toDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Check, IndianRupee } from 'lucide-react';
import { Spinner } from './Spinner';

const FREE_FEATURES = [
  'Daily + Weekly planner views',
  'Unlimited tasks',
  'Up to 3 habits',
  '5 AI schedule optimizations/day',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Monthly + Yearly views',
  'Unlimited habits with streaks',
  'Unlimited AI scheduling',
  'Google Calendar 2-way sync',
  'Smart time-block suggestions',
  'Data export',
  'Offline mode',
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.Razorpay !== 'undefined') {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function UpgradeView() {
  const user = usePlannerStore((s) => s.user);
  const isPro = usePlannerStore((s) => s.isPro());
  const subscription = usePlannerStore((s) => s.subscription());
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleUpgrade() {
    if (!user) return;
    setLoading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway. Check your connection and try again.');
        setLoading(false);
        return;
      }

      const { subscriptionId, keyId } = await callCreateRazorpaySubscription();

      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: 'Vibe Planner',
        description: 'Pro Plan — ₹415/month',
        prefill: {
          name: user.displayName,
          email: user.email,
        },
        theme: { color: '#0284c7' },
        handler: async (response) => {
          try {
            await callVerifyRazorpayPayment({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySubscriptionId: response.razorpay_subscription_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Welcome to Pro! All features are now unlocked.');
          } catch {
            toast.error(
              'Payment received but verification failed. Contact support if your account was charged.'
            );
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.on('payment.failed', (response) => {
        toast.error(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });

      rzp.open();
    } catch {
      toast.error('Could not start checkout. Please try again.');
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (
      !confirm(
        "Cancel your Pro subscription? You'll keep access until the end of your billing period."
      )
    )
      return;
    setCancelling(true);
    try {
      await callCancelRazorpaySubscription();
      toast.success("Subscription cancelled. You'll retain Pro access until period end.");
    } catch {
      toast.error('Cancellation failed. Please try again or contact support.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Upgrade to Pro</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Unlock the full Vibe Planner experience.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Free</p>
            <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">₹0</p>
            <p className="text-sm text-slate-400">forever</p>
            <ul className="mt-6 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl border-2 border-brand-500 bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-semibold text-white">
              Most Popular
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Pro
            </p>
            <div className="mt-2 flex items-end gap-1">
              <p className="text-4xl font-bold text-slate-900 dark:text-white">₹415</p>
              <p className="mb-1 text-sm text-slate-400">/month</p>
            </div>
            <p className="text-xs text-slate-400">
              ≈ $5 · UPI · Cards · Net Banking · Wallets · Cancel anytime
            </p>
            <ul className="mt-6 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 space-y-2">
              {isPro ? (
                <>
                  <div className="rounded-lg bg-green-50 px-4 py-2 text-center text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                    ✓ You&apos;re on Pro
                    {subscription.currentPeriodEnd && (
                      <span className="mt-0.5 block text-xs font-normal text-green-600 dark:text-green-500">
                        Renews{' '}
                        {toDate(subscription.currentPeriodEnd)?.toLocaleDateString('en-IN') ?? ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling || subscription.cancelAtPeriodEnd}
                    className="w-full rounded-xl border border-slate-200 py-2 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {cancelling
                      ? 'Cancelling…'
                      : subscription.cancelAtPeriodEnd
                        ? 'Cancels at period end'
                        : 'Cancel subscription'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <IndianRupee className="h-4 w-4" />
                      Upgrade Now
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Secured by Razorpay · UPI · Visa · Mastercard · Net Banking · Wallets
        </p>
      </div>
    </div>
  );
}
