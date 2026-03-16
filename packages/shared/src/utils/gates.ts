import type { Subscription } from '../types/index.js';

// ─── Gate Keys ───────────────────────────────────────────────────────────────

export type GateKey =
  | 'monthlyView'
  | 'yearlyView'
  | 'gcalSync'
  | 'aiUnlimited'
  | 'timeBlockSuggestions'
  | 'smartPrioritization'
  | 'habitStreaks'
  | 'unlimitedHabits'
  | 'exportData'
  | 'offlineMode';

// All gated features require Pro
const PRO_ONLY_GATES = new Set<GateKey>([
  'monthlyView',
  'yearlyView',
  'gcalSync',
  'aiUnlimited',
  'timeBlockSuggestions',
  'smartPrioritization',
  'habitStreaks',
  'unlimitedHabits',
  'exportData',
  'offlineMode',
]);

const UPGRADE_REASONS: Record<GateKey, string> = {
  monthlyView: 'Monthly view is a Pro feature. Upgrade to see your full month at a glance.',
  yearlyView: 'Yearly view is a Pro feature. Upgrade to plan your entire year.',
  gcalSync: 'Google Calendar 2-way sync is a Pro feature. Upgrade to keep everything in sync.',
  aiUnlimited:
    "You've used all 5 free AI calls for today. Upgrade to Pro for unlimited AI scheduling.",
  timeBlockSuggestions: 'AI time-block suggestions are a Pro feature.',
  smartPrioritization: 'Smart AI prioritization is a Pro feature.',
  habitStreaks: 'Habit streaks are a Pro feature. Upgrade to track your momentum.',
  unlimitedHabits:
    'Free plan supports up to 3 habits. Upgrade to Pro for unlimited habit tracking.',
  exportData: 'Data export is a Pro feature.',
  offlineMode: 'Offline mode is a Pro feature.',
};

// ─── canUse ──────────────────────────────────────────────────────────────────

export function canUse(gate: GateKey, subscription: Subscription): boolean {
  if (!PRO_ONLY_GATES.has(gate)) return true;
  return subscription.plan === 'pro';
}

// ─── getUpgradeReason ─────────────────────────────────────────────────────────

export function getUpgradeReason(gate: GateKey): string {
  return UPGRADE_REASONS[gate];
}

// ─── Free tier limits ─────────────────────────────────────────────────────────

export const FREE_TIER = {
  AI_CALLS_PER_DAY: 5,
  MAX_HABITS: 3,
} as const;
