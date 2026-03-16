'use client';

import { useState } from 'react';
import { addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { habitsRef, habitRef } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import type { Habit } from 'shared/types';

const HABIT_COLORS = [
  { value: '#0ea5e9', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#ec4899', label: 'Pink' },
];

interface HabitModalProps {
  habit?: Habit | undefined; // if provided, edit mode; otherwise add mode
  onClose: () => void;
}

export function HabitModal({ habit, onClose }: HabitModalProps) {
  const user = usePlannerStore((s) => s.user);
  const [title, setTitle] = useState(habit?.title ?? '');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(habit?.targetFrequency ?? 'daily');
  const [startTime, setStartTime] = useState(habit?.startTime ?? '');
  const [duration, setDuration] = useState(String(habit?.duration ?? 30));
  const [color, setColor] = useState(habit?.color ?? HABIT_COLORS[0]!.value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        userId: user.uid,
        title: title.trim(),
        targetFrequency: frequency,
        color,
      };
      if (startTime) payload.startTime = startTime;
      const dur = parseInt(duration, 10);
      if (!isNaN(dur) && dur > 0) payload.duration = dur;

      if (habit) {
        await updateDoc(habitRef(user.uid, habit.id), payload);
        toast.success('Habit updated');
      } else {
        await addDoc(habitsRef(user.uid), {
          ...payload,
          streak: { current: 0, longest: 0 },
          completions: [],
          createdAt: serverTimestamp(),
        });
        toast.success('Habit added');
      }
      onClose();
    } catch {
      toast.error('Failed to save habit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-scale-in">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {habit ? 'Edit Habit' : 'New Habit'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Habit name</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
              placeholder="e.g. Morning run"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'weekly'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize transition ${
                    frequency === f
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Time & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Start time (optional)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Duration (mins)</label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Color</label>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
            className="flex-1 rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : habit ? 'Save changes' : 'Add habit'}
          </button>
        </div>
      </div>
    </div>
  );
}
