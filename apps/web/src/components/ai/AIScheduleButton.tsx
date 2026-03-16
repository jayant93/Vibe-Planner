'use client';

import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { callOptimizeSchedule } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { canUse, FREE_TIER } from 'shared/utils/gates';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';
import { taskRef } from '@/lib/firebase';

interface AIScheduleButtonProps {
  date: string;
}

export function AIScheduleButton({ date }: AIScheduleButtonProps) {
  const [loading, setLoading] = useState(false);
  const user = usePlannerStore((s) => s.user);
  const tasks = usePlannerStore((s) => s.tasks);
  const subscription = usePlannerStore((s) => s.subscription());
  const isPro = usePlannerStore((s) => s.isPro());

  async function handleOptimize() {
    if (!user) return;

    // Check daily limit for free users
    if (!canUse('aiUnlimited', subscription)) {
      const usageRef = doc(db, 'users', user.uid, 'aiUsage', date);
      const snap = await getDoc(usageRef);
      const count = (snap.data() as { count?: number } | undefined)?.count ?? 0;
      if (count >= FREE_TIER.AI_CALLS_PER_DAY) {
        toast.error(`You've used all ${FREE_TIER.AI_CALLS_PER_DAY} free AI calls for today. Upgrade to Pro for unlimited scheduling.`);
        return;
      }
    }

    setLoading(true);
    try {
      const pendingTasks = tasks.filter((t) => t.dueDate === date && t.status !== 'done');
      const preferences = user.preferences;

      // Build available slots from work hours
      const availableSlots = [
        { start: `${preferences.workStartTime}`, end: `${preferences.workEndTime}` },
      ];

      const result = await callOptimizeSchedule({
        tasks: pendingTasks,
        availableSlots,
        preferences,
        date,
      });

      // Apply AI-suggested time blocks
      await Promise.all(
        result.scheduledTasks.map((s) =>
          updateDoc(taskRef(user.uid, s.taskId), {
            timeBlock: s.timeBlock,
            startTime: s.timeBlock.start,
            endTime: s.timeBlock.end,
            aiScore: s.aiScore,
          })
        )
      );

      if (result.suggestions.length > 0) {
        toast.success(`Schedule optimized! ${result.suggestions[0]}`);
      } else {
        toast.success('Schedule optimized!');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI optimization failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleOptimize}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300"
      title={isPro ? 'AI Schedule Optimizer (Pro)' : `AI Schedule (${FREE_TIER.AI_CALLS_PER_DAY} free/day)`}
    >
      <Zap className="h-4 w-4" />
      {loading ? 'Optimizing…' : 'AI Optimize'}
    </button>
  );
}
