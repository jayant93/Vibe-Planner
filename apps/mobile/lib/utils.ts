import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import type { LifeCategory, Task } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function toLocalISO(date: Date): string {
  return date.toLocaleDateString('sv');
}

export function formatDateLabel(isoDate: string): string {
  const d = parseISO(isoDate);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, MMM d');
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

// ─── Category helpers ─────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<LifeCategory, string> = {
  mind: '#a855f7',
  body: '#22c55e',
  soul: '#f59e0b',
  work: '#0ea5e9',
};

export const CATEGORY_BG: Record<LifeCategory, string> = {
  mind: '#f3e8ff',
  body: '#dcfce7',
  soul: '#fef3c7',
  work: '#e0f2fe',
};

export const CATEGORY_EMOJIS: Record<LifeCategory, string> = {
  mind: '🧠',
  body: '💪',
  soul: '✨',
  work: '💼',
};

// ─── Priority helpers ─────────────────────────────────────────────────────────

export const PRIORITY_COLORS = ['', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];
export const PRIORITY_LABELS = ['', 'Low', 'Low-Med', 'Medium', 'High', 'Critical'];

// ─── Task recurrence helpers ──────────────────────────────────────────────────

export function taskOccursOn(task: Task, dateStr: string): boolean {
  if (!task.dueDate) return false;
  if (task.recurrence === 'none') return task.dueDate === dateStr;

  const base = parseISO(task.dueDate);
  const target = parseISO(dateStr);
  if (target < base) return false;

  const diffDays = Math.floor((target.getTime() - base.getTime()) / 86400000);

  switch (task.recurrence) {
    case 'daily':
      return true;
    case 'alternate':
      return diffDays % 2 === 0;
    case 'weekly':
      return diffDays % 7 === 0;
    case 'monthly':
      return (
        target.getDate() === base.getDate() &&
        (target.getFullYear() * 12 + target.getMonth()) >
          (base.getFullYear() * 12 + base.getMonth() - 1)
      );
    case 'yearly':
      return target.getDate() === base.getDate() && target.getMonth() === base.getMonth();
    default:
      return task.dueDate === dateStr;
  }
}

// ─── Elapsed time ─────────────────────────────────────────────────────────────

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
