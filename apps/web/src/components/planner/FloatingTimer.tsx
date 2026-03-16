'use client';

import { useEffect, useState } from 'react';
import { Square, Timer } from 'lucide-react';
import { usePlannerStore } from '@/lib/store';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { timeLogsRef } from '@/lib/firebase';
import { toast } from 'sonner';

export function FloatingTimer() {
  const user = usePlannerStore((s) => s.user);
  const activeTimer = usePlannerStore((s) => s.activeTimer);
  const stopTimer = usePlannerStore((s) => s.stopTimer);
  const selectedDate = usePlannerStore((s) => s.selectedDate);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeTimer) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - activeTimer.startedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  if (!activeTimer) return null;

  function fmt(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function handleStop() {
    if (!user || !activeTimer) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    stopTimer();
    try {
      await addDoc(timeLogsRef(user.uid), {
        userId: user.uid,
        date: selectedDate,
        category: activeTimer.category ?? 'body',
        minutes,
        note: activeTimer.taskTitle,
        createdAt: serverTimestamp(),
      });
      toast.success(`Logged ${minutes} min for "${activeTimer.taskTitle}"`);
    } catch {
      toast.error('Failed to save time log');
    }
  }

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-fade-in md:bottom-6">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-white px-5 py-3 shadow-xl dark:border-brand-800 dark:bg-slate-900">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
          <Timer className="h-4 w-4 animate-pulse text-brand-500" />
        </div>
        <div className="min-w-0">
          <p className="max-w-[160px] truncate text-xs font-medium text-slate-600 dark:text-slate-400">
            {activeTimer.taskTitle}
          </p>
          <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {fmt(elapsed)}
          </p>
        </div>
        <button
          onClick={() => void handleStop()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
          title="Stop & log time"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      </div>
    </div>
  );
}
