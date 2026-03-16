'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc, addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { callConnectGoogleCalendar, callSyncGoogleCalendar } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { canUse } from 'shared/utils/gates';
import { toDate } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, RefreshCw, ExternalLink } from 'lucide-react';

export function SettingsView() {
  const user = usePlannerStore((s) => s.user);
  const subscription = usePlannerStore((s) => s.subscription());
  const isPro = usePlannerStore((s) => s.isPro());
  const [syncing, setSyncing] = useState(false);
  const [connectingGCal, setConnectingGCal] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle OAuth callback — gcal_payload contains tokens to save to Firestore
  useEffect(() => {
    const payload = searchParams.get('gcal_payload');
    const gcalError = searchParams.get('gcal_error');

    if (gcalError) {
      toast.error(`Google Calendar error: ${gcalError}`);
      router.replace('/settings');
      return;
    }

    if (!payload || !user) return;

    async function saveGCalTokens() {
      try {
        const decoded = JSON.parse(atob(payload!.replace(/-/g, '+').replace(/_/g, '/'))) as {
          uid: string; accessToken: string; refreshToken: string; expiresAt: number;
        };
        await setDoc(
          doc(db, 'users', decoded.uid),
          {
            gcalLinked: true,
            gcalTokens: {
              accessToken: decoded.accessToken,
              refreshToken: decoded.refreshToken,
              expiresAt: decoded.expiresAt,
            },
          },
          { merge: true }
        );
        toast.success('Google Calendar connected!');
      } catch {
        toast.error('Failed to save Google Calendar tokens');
      } finally {
        router.replace('/settings');
      }
    }

    void saveGCalTokens();
  }, [searchParams, user, router]);

  async function handleConnectGCal() {
    if (!user) return;
    setConnectingGCal(true);
    try {
      const { authUrl } = await callConnectGoogleCalendar(user.uid);
      window.location.href = authUrl;
    } catch {
      toast.error('Failed to start Google Calendar connection.');
    } finally {
      setConnectingGCal(false);
    }
  }

  async function handleSyncGCal() {
    if (!user?.gcalTokens) {
      toast.error('Google Calendar not connected. Please connect first.');
      return;
    }
    setSyncing(true);
    try {
      const { events } = await callSyncGoogleCalendar({
        accessToken: user.gcalTokens.accessToken,
        refreshToken: user.gcalTokens.refreshToken,
        expiresAt: user.gcalTokens.expiresAt,
      });

      const tasksCol = collection(db, 'users', user.uid, 'tasks');
      let added = 0;
      for (const event of events) {
        if (!event.googleEventId || !event.title) continue;
        // Skip if already synced
        const existing = await getDocs(query(tasksCol, where('googleEventId', '==', event.googleEventId)));
        if (!existing.empty) continue;
        const taskData: Record<string, unknown> = {
          userId: user.uid,
          title: event.title,
          description: event.description ?? '',
          priority: 3,
          status: 'todo',
          recurrence: 'none',
          dueDate: event.dueDate,
          googleEventId: event.googleEventId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        // Only set time fields if they exist — Firestore rejects undefined values
        if (event.startTime) taskData['startTime'] = event.startTime;
        if (event.endTime) taskData['endTime'] = event.endTime;
        await addDoc(tasksCol, taskData);
        added++;
      }
      toast.success(`Synced ${added} new events from Google Calendar`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[GCal sync]', err);
      toast.error(`Sync failed: ${msg}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleThemeChange(theme: 'light' | 'dark' | 'system') {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { 'preferences.theme': theme });
    toast.success('Theme updated');
  }

  async function handleAccentChange(accent: 'blue' | 'purple' | 'green' | 'rose' | 'orange') {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { 'preferences.accentColor': accent });
    document.documentElement.setAttribute('data-theme', accent);
    toast.success('Accent color updated');
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">Settings</h1>

      <div className="max-w-lg space-y-6">
        {/* Profile */}
        <Section title="Profile">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img src={user.photoURL} className="h-12 w-12 rounded-full" alt="" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold">
                {user?.displayName?.[0]}
              </div>
            )}
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{user?.displayName}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
        </Section>

        {/* Plan */}
        <Section title="Plan & Billing">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                {subscription.plan} Plan
              </p>
              {isPro && subscription.currentPeriodEnd && (
                <p className="text-xs text-slate-400">
                  Renews {toDate(subscription.currentPeriodEnd)?.toLocaleDateString() ?? ''}
                </p>
              )}
            </div>
            <Link
              href="/upgrade"
              className={
                isPro
                  ? 'text-sm text-brand-600 hover:underline dark:text-brand-400'
                  : 'rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700'
              }
            >
              {isPro ? 'Manage subscription' : 'Upgrade — ₹415/mo'}
            </Link>
          </div>
        </Section>

        {/* Google Calendar */}
        <Section title="Google Calendar Sync">
          {!canUse('gcalSync', subscription) ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                2-way sync is a Pro feature.
              </p>
              <Link
                href="/upgrade"
                className="text-sm text-brand-600 hover:underline dark:text-brand-400"
              >
                Upgrade
              </Link>
            </div>
          ) : user?.gcalLinked ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Calendar className="h-4 w-4" />
                Google Calendar connected
              </div>
              <button
                onClick={handleSyncGCal}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGCal}
              disabled={connectingGCal}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <ExternalLink className="h-4 w-4" />
              {connectingGCal ? 'Connecting…' : 'Connect Google Calendar'}
            </button>
          )}
        </Section>

        {/* Preferences */}
        <Section title="Appearance">
          <p className="mb-2 text-xs text-slate-400">Color mode</p>
          <div className="mb-5 flex items-center gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => void handleThemeChange(t)}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                  user?.preferences.theme === t
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs text-slate-400">Accent color</p>
          <div className="flex flex-wrap gap-3">
            {([
              { value: 'blue',   hex: '#0ea5e9', label: 'Blue'   },
              { value: 'purple', hex: '#a855f7', label: 'Purple' },
              { value: 'green',  hex: '#22c55e', label: 'Green'  },
              { value: 'rose',   hex: '#f43f5e', label: 'Rose'   },
              { value: 'orange', hex: '#f97316', label: 'Orange' },
            ] as const).map(({ value, hex, label }) => {
              const active = (user?.preferences.accentColor ?? 'blue') === value;
              return (
                <button
                  key={value}
                  title={label}
                  onClick={() => void handleAccentChange(value)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                    active ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-110' : ''
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {active && (
                    <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </div>
  );
}
