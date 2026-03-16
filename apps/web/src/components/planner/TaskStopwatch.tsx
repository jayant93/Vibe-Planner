'use client';

import { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { usePlannerStore } from '@/lib/store';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { timeLogsRef } from '@/lib/firebase';
import { toast } from 'sonner';
import type { Task } from 'shared/types';

// Keywords that trigger the stopwatch button on a task card
const TIMER_KEYWORDS = [
  'meditat', 'run', 'running', 'exercise', 'gym', 'workout', 'yoga',
  'walk', 'walking', 'cycling', 'swim', 'swimming', 'stretch', 'breathe',
  'breathing', 'journal', 'journaling', 'hiit', 'pilates', 'zumba',
];

export function shouldShowStopwatch(task: Task): boolean {
  if (task.category === 'body' || task.category === 'soul') return true;
  const lower = task.title.toLowerCase();
  return TIMER_KEYWORDS.some((kw) => lower.includes(kw));
}

interface TaskStopwatchProps {
  task: Task;
}

export function TaskStopwatch({ task }: TaskStopwatchProps) {
  const user = usePlannerStore((s) => s.user);
  const activeTimer = usePlannerStore((s) => s.activeTimer);
  const startTimer = usePlannerStore((s) => s.startTimer);
  const stopTimer = usePlannerStore((s) => s.stopTimer);
  const selectedDate = usePlannerStore((s) => s.selectedDate);

  const isRunning = activeTimer?.taskId === task.id;
  const [elapsed, setElapsed] = useState(0); // seconds

  // Tick every second while this task's timer is active
  useEffect(() => {
    if (!isRunning || !activeTimer) return;
    const update = () => setElapsed(Math.floor((Date.now() - activeTimer.startedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRunning, activeTimer]);

  function fmt(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function handleStart(e: React.MouseEvent) {
    e.stopPropagation();
    if (activeTimer && activeTimer.taskId !== task.id) {
      toast.warning(`"${activeTimer.taskTitle}" timer is already running`);
      return;
    }
    startTimer({ taskId: task.id, taskTitle: task.title, startedAt: Date.now(), category: task.category });
    setElapsed(0);
  }

  async function handleStop(e: React.MouseEvent) {
    e.stopPropagation();
    if (!activeTimer || !user) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    stopTimer();
    setElapsed(0);

    // Save to TimeLog
    try {
      await addDoc(timeLogsRef(user.uid), {
        userId: user.uid,
        date: selectedDate,
        category: task.category ?? 'body',
        minutes,
        note: task.title,
        createdAt: serverTimestamp(),
      });
      toast.success(`Logged ${minutes} min for "${task.title}"`);
    } catch {
      toast.error('Failed to save time log');
    }
  }

  if (isRunning) {
    return (
      <button
        onClick={(e) => void handleStop(e)}
        className="flex items-center gap-1 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
        title="Stop timer & log time"
      >
        <Square className="h-3 w-3 fill-current" />
        {fmt(elapsed)}
      </button>
    );
  }

  return (
    <button
      onClick={handleStart}
      className="rounded-lg p-1 text-slate-300 opacity-0 transition hover:text-brand-500 group-hover:opacity-100 dark:text-slate-600"
      title="Start timer"
    >
      <Play className="h-3.5 w-3.5 fill-current" />
    </button>
  );
}
