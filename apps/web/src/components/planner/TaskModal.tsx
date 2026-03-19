'use client';

import { useState } from 'react';
import { addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { taskRef, tasksRef } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { toast } from 'sonner';
import { X, Trash2 } from 'lucide-react';
import type { Task, LifeCategory } from 'shared/types';

interface TaskModalProps {
  task: Partial<Task>;
  onClose: () => void;
}

export function TaskModal({ task, onClose }: TaskModalProps) {
  const user = usePlannerStore((s) => s.user);
  const [title, setTitle] = useState(task.title ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(task.priority ?? 3);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [startTime, setStartTime] = useState(task.startTime ?? '');
  const [endTime, setEndTime] = useState(task.endTime ?? '');
  const [category, setCategory] = useState<LifeCategory | ''>(task.category ?? '');
  const [recurrence, setRecurrence] = useState<Task['recurrence']>(task.recurrence ?? 'none');
  // Default end date: 30 days from dueDate or today
  const defaultEndDate = (() => {
    if (task.recurrenceEnd?.until) return task.recurrenceEnd.until;
    const base = task.dueDate ?? new Date().toISOString().slice(0, 10);
    const d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();
  const [recEndUntil, setRecEndUntil] = useState(defaultEndDate);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(task.id);

  async function handleSave() {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      // Firestore rejects undefined values — only include fields that have a value
      const payload: Record<string, unknown> = {
        userId: user.uid,
        title: title.trim(),
        priority,
        status: task.status ?? 'todo',
        recurrence,
        updatedAt: serverTimestamp(),
      };
      if (description.trim()) payload.description = description.trim();
      if (category) payload.category = category;
      if (dueDate) payload.dueDate = dueDate;
      if (startTime) payload.startTime = startTime;
      if (endTime) payload.endTime = endTime;

      // Recurrence end — always use 'until' date when recurrence is active
      if (recurrence !== 'none' && recEndUntil) {
        payload.recurrenceEnd = { type: 'until', until: recEndUntil };
      }

      if (isEdit && task.id) {
        await updateDoc(taskRef(user.uid, task.id), payload);
        toast.success('Task updated');
      } else {
        await addDoc(tasksRef(user.uid), { ...payload, createdAt: serverTimestamp() });
        toast.success('Task added');
      }
      onClose();
    } catch (err) {
      console.error('Failed to save task:', err);
      toast.error('Failed to save task');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !task.id) return;
    try {
      await deleteDoc(taskRef(user.uid, task.id));
      toast.success('Task deleted');
      onClose();
    } catch {
      toast.error('Failed to delete task');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Life Category</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { key: 'mind', emoji: '🧠', label: 'Mind', color: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
                { key: 'body', emoji: '💪', label: 'Body', color: 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-300' },
                { key: 'soul', emoji: '✨', label: 'Soul', color: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                { key: 'work', emoji: '💼', label: 'Work', color: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
              ] as const).map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(category === cat.key ? '' : cat.key)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-xs font-medium transition ${
                    category === cat.key
                      ? cat.color + ' ring-2 ring-offset-1'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={1}>1 – Lowest</option>
                <option value={2}>2 – Low</option>
                <option value={3}>3 – Medium</option>
                <option value={4}>4 – High</option>
                <option value={5}>5 – Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Task['recurrence'])}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="none">None (one-time)</option>
                <option value="daily">Daily</option>
                <option value="alternate">Alternate Days (every 2 days)</option>
              </select>
            </div>

            {/* End date — only shown when recurrence is active */}
            {recurrence !== 'none' && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
                <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Ends on</label>
                <input
                  type="date"
                  value={recEndUntil}
                  onChange={(e) => setRecEndUntil(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {isEdit ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
