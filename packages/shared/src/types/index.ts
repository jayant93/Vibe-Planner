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
  date: string;         // YYYY-MM-DD
  category: LifeCategory;
  minutes: number;
  note?: string;
  createdAt: Date;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export type RecurrenceEndType = 'forever' | 'until' | 'count';

export interface RecurrenceEnd {
  type: RecurrenceEndType;
  until?: string; // YYYY-MM-DD — used when type === 'until'
  count?: number;  // number of occurrences — used when type === 'count'
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: 'todo' | 'in-progress' | 'done';
  dueDate?: string; // ISO date "YYYY-MM-DD"
  startTime?: string; // "HH:MM"
  endTime?: string; // "HH:MM"
  recurrence: 'none' | 'daily' | 'alternate' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEnd?: RecurrenceEnd; // only meaningful when recurrence !== 'none'
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
  startTime?: string;  // "HH:MM" — when to do it each day
  duration?: number;   // minutes, default 30
  color?: string;      // hex color for calendar display
  streak: { current: number; longest: number; lastCompleted?: string };
  completions: string[]; // ISO date strings
  createdAt: Date;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserPreferences {
  workStartTime: string; // "09:00"
  workEndTime: string;   // "18:00"
  theme: 'light' | 'dark' | 'system';
  weekStartsOn: 0 | 1;   // 0 = Sunday, 1 = Monday
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

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface AIUsage {
  count: number;
  date: string; // YYYY-MM-DD
}

export interface OptimizeScheduleRequest {
  tasks: Task[];
  availableSlots: Array<{ start: string; end: string }>;
  preferences: UserPreferences;
  date: string; // ISO date
}

export interface OptimizeScheduleResponse {
  scheduledTasks: Array<{
    taskId: string;
    timeBlock: { start: string; end: string; locked: boolean };
    aiScore: number;
    reasoning: string;
  }>;
  suggestions: string[];
}

// ─── Google Calendar ──────────────────────────────────────────────────────────

export interface GCalTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
}

export interface GCalEvent {
  googleEventId: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
}

// ─── Razorpay ─────────────────────────────────────────────────────────────────

export interface CreateSubscriptionResponse {
  subscriptionId: string; // Razorpay subscription_id — passed to checkout
  keyId: string;           // Razorpay Key ID (public) — passed to checkout
}

export interface VerifyPaymentRequest {
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpaySignature: string;
}

export interface CancelSubscriptionResponse {
  cancelled: boolean;
}
