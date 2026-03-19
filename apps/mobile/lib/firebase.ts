import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
// ─── Firebase Init ────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const db = getFirestore(app);
export const functions = getFunctions(app);

// ─── Firestore Refs ───────────────────────────────────────────────────────────

export const userRef = (uid: string) => doc(db, 'users', uid);
export const tasksRef = (uid: string) => collection(db, 'users', uid, 'tasks');
export const taskRef = (uid: string, taskId: string) => doc(db, 'users', uid, 'tasks', taskId);
export const habitsRef = (uid: string) => collection(db, 'users', uid, 'habits');
export const habitRef = (uid: string, habitId: string) =>
  doc(db, 'users', uid, 'habits', habitId);
export const timeLogsRef = (uid: string) => collection(db, 'users', uid, 'timeLogs');
export const timeLogRef = (uid: string, logId: string) =>
  doc(db, 'users', uid, 'timeLogs', logId);

// ─── Callable Cloud Functions ─────────────────────────────────────────────────

export async function callCreateRazorpaySubscription(): Promise<{
  subscriptionId: string;
  keyId: string;
}> {
  const fn = httpsCallable<Record<string, never>, { subscriptionId: string; keyId: string }>(
    functions,
    'createRazorpaySubscription'
  );
  const result = await fn({});
  return result.data;
}

export async function callVerifyRazorpayPayment(payload: {
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpaySignature: string;
}): Promise<{ success: boolean }> {
  const fn = httpsCallable<typeof payload, { success: boolean }>(
    functions,
    'verifyRazorpayPayment'
  );
  const result = await fn(payload);
  return result.data;
}

export async function callCancelRazorpaySubscription(): Promise<{ cancelled: boolean }> {
  const fn = httpsCallable<Record<string, never>, { cancelled: boolean }>(
    functions,
    'cancelRazorpaySubscription'
  );
  const result = await fn({});
  return result.data;
}

// ─── AI Helper (calls deployed web API) ──────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export async function callAIHelper(
  text: string,
  today: string
): Promise<{ tasks: unknown[] }> {
  const res = await fetch(`${API_BASE}/api/ai-helper`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, today }),
  });
  if (!res.ok) throw new Error('AI helper request failed');
  return res.json();
}
