'use client';

import { useState } from 'react';
import { updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { habitRef } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { canUse, FREE_TIER } from 'shared/utils/gates';
import { ProGate } from '@/components/ui/ProGate';
import { HabitModal } from './HabitModal';
import { toast } from 'sonner';
import { todayISO } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, Flame, Plus, Trash2, Lock, Pencil } from 'lucide-react';
import type { Habit } from 'shared/types';

export function HabitsView() {
  const user = usePlannerStore((s) => s.user);
  const habits = usePlannerStore((s) => s.habits);
  const subscription = usePlannerStore((s) => s.subscription());
  const isPro = usePlannerStore((s) => s.isPro());
  const [modalHabit, setModalHabit] = useState<Habit | true | null>(null);

  const today = todayISO();
  const canAddMore = isPro || habits.length < FREE_TIER.MAX_HABITS;

  async function toggleCompletion(habit: Habit) {
    if (!user) return;
    const isCompleted = habit.completions.includes(today);
    try {
      await updateDoc(habitRef(user.uid, habit.id), {
        completions: isCompleted ? arrayRemove(today) : arrayUnion(today),
      });
    } catch {
      toast.error('Failed to update habit');
    }
  }

  async function deleteHabit(habitId: string) {
    if (!user) return;
    try {
      await deleteDoc(habitRef(user.uid, habitId));
      toast.success('Habit deleted');
    } catch {
      toast.error('Failed to delete habit');
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Habits</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPro ? 'Unlimited habits' : `${habits.length} / ${FREE_TIER.MAX_HABITS} habits`}
          </p>
        </div>
        <button
          onClick={() => canAddMore && setModalHabit(true)}
          disabled={!canAddMore}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New habit
        </button>
      </div>

      {!isPro && habits.length >= FREE_TIER.MAX_HABITS && (
        <div className="mb-4">
          <ProGate feature="unlimitedHabits" />
        </div>
      )}

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="mb-3 text-sm text-slate-400">No habits yet.</p>
          <button
            onClick={() => setModalHabit(true)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add your first habit
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {habits.map((habit) => {
            const completedToday = habit.completions.includes(today);
            return (
              <li
                key={habit.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:gap-4 sm:p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: habit.color ?? '#0ea5e9' }}
                />

                <button
                  onClick={() => void toggleCompletion(habit)}
                  className="flex-shrink-0 transition hover:scale-110"
                >
                  {completedToday ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      completedToday
                        ? 'text-slate-400 line-through dark:text-slate-600'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {habit.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="capitalize">{habit.targetFrequency}</span>
                    {habit.startTime && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {habit.startTime}
                          {habit.duration ? ` (${habit.duration}m)` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {canUse('habitStreaks', subscription) ? (
                  <div className="flex items-center gap-1 text-orange-500">
                    <Flame className="h-4 w-4" />
                    <span className="text-sm font-semibold">{habit.streak.current}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-300 dark:text-slate-600" title="Streaks are a Pro feature">
                    <Lock className="h-3.5 w-3.5" />
                    <Flame className="h-4 w-4" />
                  </div>
                )}

                <button
                  onClick={() => setModalHabit(habit)}
                  className="rounded p-1.5 text-slate-300 hover:text-brand-500 dark:text-slate-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  onClick={() => void deleteHabit(habit.id)}
                  className="rounded p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {modalHabit !== null && (
        <HabitModal
          habit={modalHabit === true ? undefined : modalHabit}
          onClose={() => setModalHabit(null)}
        />
      )}
    </div>
  );
}
