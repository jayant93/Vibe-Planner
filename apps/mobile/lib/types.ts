// ─── Plan & Subscription ─────────────────────────────────────────────────────

export type Plan = 'free' | 'pro';

export interface Subscription {
  plan: Plan;
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

// ─── Life Categories ─────────────────────────────────────────────────────────

export type LifeCategory = 'mind' | 'body' | 'soul' | 'work';

// ─── Time Log ────────────────────────────────────────────────────────────────

export interface TimeLog {
  id: string;
  userId: string;
  date: string;
  category: LifeCategory;
  minutes: number;
  note?: string;
  createdAt: Date;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: 'todo' | 'in-progress' | 'done';
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  recurrence: 'none' | 'daily' | 'alternate' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEnd?: { type: 'forever' | 'until' | 'count'; until?: string; count?: number };
  category?: LifeCategory;
  estimatedMinutes?: number;
  googleEventId?: string;
  timeBlock?: { start: string; end: string; locked: boolean };
  aiScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Habit ───────────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  userId: string;
  title: string;
  targetFrequency: 'daily' | 'weekly';
  startTime?: string;
  duration?: number;
  color?: string;
  streak: { current: number; longest: number; lastCompleted?: string };
  completions: string[];
  createdAt: Date;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  workStartTime: string;
  workEndTime: string;
  theme: 'light' | 'dark' | 'system';
  weekStartsOn: 0 | 1;
  accentColor?: 'blue' | 'purple' | 'green' | 'rose' | 'orange';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  timezone: string;
  subscription: Subscription;
  gcalLinked: boolean;
  gcalTokens?: { accessToken: string; refreshToken: string; expiresAt: number };
  preferences: UserPreferences;
  createdAt: Date;
}

// ─── Gates ───────────────────────────────────────────────────────────────────

export type GateKey =
  | 'monthlyView'
  | 'yearlyView'
  | 'gcalSync'
  | 'aiUnlimited'
  | 'habitStreaks'
  | 'unlimitedHabits'
  | 'exportData'
  | 'offlineMode';

export function canUse(gate: GateKey, subscription: Subscription): boolean {
  return subscription.plan === 'pro';
}

export const FREE_TIER = {
  AI_CALLS_PER_DAY: 5,
  MAX_HABITS: 3,
} as const;
