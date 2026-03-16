import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type {
  OptimizeScheduleRequest,
  OptimizeScheduleResponse,
  CreateSubscriptionResponse,
  VerifyPaymentRequest,
  CancelSubscriptionResponse,
} from 'shared/types';

// ─── Firebase Init ────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('https://www.googleapis.com/auth/calendar');

// ─── Firestore Refs ───────────────────────────────────────────────────────────

export const userRef = (uid: string) => doc(db, 'users', uid);
export const tasksRef = (uid: string) => collection(db, 'users', uid, 'tasks');
export const taskRef = (uid: string, taskId: string) =>
  doc(db, 'users', uid, 'tasks', taskId);
export const habitsRef = (uid: string) => collection(db, 'users', uid, 'habits');
export const habitRef = (uid: string, habitId: string) =>
  doc(db, 'users', uid, 'habits', habitId);
export const aiUsageRef = (uid: string, date: string) =>
  doc(db, 'users', uid, 'aiUsage', date);
export const timeLogsRef = (uid: string) => collection(db, 'users', uid, 'timeLogs');
export const timeLogRef = (uid: string, logId: string) =>
  doc(db, 'users', uid, 'timeLogs', logId);

// ─── Callable Cloud Functions ─────────────────────────────────────────────────

export async function callOptimizeSchedule(
  payload: OptimizeScheduleRequest
): Promise<OptimizeScheduleResponse> {
  const fn = httpsCallable<OptimizeScheduleRequest, OptimizeScheduleResponse>(
    functions,
    'optimizeSchedule'
  );
  const result = await fn(payload);
  return result.data;
}

export async function callCreateRazorpaySubscription(): Promise<CreateSubscriptionResponse> {
  const fn = httpsCallable<Record<string, never>, CreateSubscriptionResponse>(
    functions,
    'createRazorpaySubscription'
  );
  const result = await fn({});
  return result.data;
}

export async function callVerifyRazorpayPayment(
  payload: VerifyPaymentRequest
): Promise<{ success: boolean }> {
  const fn = httpsCallable<VerifyPaymentRequest, { success: boolean }>(
    functions,
    'verifyRazorpayPayment'
  );
  const result = await fn(payload);
  return result.data;
}

export async function callCancelRazorpaySubscription(): Promise<CancelSubscriptionResponse> {
  const fn = httpsCallable<Record<string, never>, CancelSubscriptionResponse>(
    functions,
    'cancelRazorpaySubscription'
  );
  const result = await fn({});
  return result.data;
}

export async function callConnectGoogleCalendar(uid: string): Promise<{ authUrl: string }> {
  const res = await fetch(`/api/gcal/auth?uid=${encodeURIComponent(uid)}`);
  if (!res.ok) throw new Error('Failed to get auth URL');
  return res.json() as Promise<{ authUrl: string }>;
}

export async function callSyncGoogleCalendar(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}): Promise<{ events: Array<{ googleEventId: string | null | undefined; title: string | null | undefined; description: string; dueDate: string | undefined; startTime: string | undefined; endTime: string | undefined }> }> {
  const res = await fetch('/api/gcal/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Sync failed (HTTP ${res.status})`);
  }
  return res.json();
}
