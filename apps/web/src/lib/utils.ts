import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import type { Task } from 'shared/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(isoDate: string, pattern = 'MMM d, yyyy'): string {
  return format(parseISO(isoDate), pattern);
}

export function todayISO(): string {
  return new Date().toLocaleDateString('sv'); // local YYYY-MM-DD
}

export function priorityLabel(priority: 1 | 2 | 3 | 4 | 5): string {
  const labels: Record<number, string> = {
    1: 'Lowest',
    2: 'Low',
    3: 'Medium',
    4: 'High',
    5: 'Urgent',
  };
  return labels[priority] ?? 'Medium';
}

/** Safely convert a Firestore Timestamp or JS Date to a JS Date */
export function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns true if a task should appear on the given ISO date,
 * taking recurrence rules into account.
 */
export function taskOccursOn(task: Task, date: string): boolean {
  if (!task.dueDate) return false;

  // Never show before the task's start (due) date
  if (date < task.dueDate) return false;

  // Check recurrence end date
  if (task.recurrenceEnd?.type === 'until' && task.recurrenceEnd.until) {
    if (date > task.recurrenceEnd.until) return false;
  }

  if (task.recurrence === 'none') {
    return date === task.dueDate;
  }

  // Day difference from the original due date
  const startMs = new Date(task.dueDate + 'T00:00:00').getTime();
  const targetMs = new Date(date + 'T00:00:00').getTime();
  const diffDays = Math.round((targetMs - startMs) / 86_400_000);

  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'alternate') return diffDays % 2 === 0;
  if (task.recurrence === 'weekly') return diffDays % 7 === 0;
  if (task.recurrence === 'monthly') {
    return new Date(task.dueDate + 'T00:00:00').getDate() ===
           new Date(date + 'T00:00:00').getDate();
  }
  if (task.recurrence === 'yearly') {
    const s = new Date(task.dueDate + 'T00:00:00');
    const t = new Date(date + 'T00:00:00');
    return s.getMonth() === t.getMonth() && s.getDate() === t.getDate();
  }

  return date === task.dueDate;
}

export function priorityColor(priority: 1 | 2 | 3 | 4 | 5): string {
  const colors: Record<number, string> = {
    1: 'text-slate-400',
    2: 'text-blue-400',
    3: 'text-yellow-400',
    4: 'text-orange-400',
    5: 'text-red-500',
  };
  return colors[priority] ?? 'text-yellow-400';
}
