'use client';

import { useState } from 'react';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { tasksRef } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { todayISO, priorityColor, priorityLabel } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Sparkles, Send, Trash2, ChevronDown, ChevronUp,
  Loader2, Plus, CheckCircle2, Zap, Clock, Tag,
} from 'lucide-react';
import type { AISuggestedTask } from '@/app/api/ai-helper/route';

type DraftTask = AISuggestedTask & { _id: string; selected: boolean };

const VISIBLE_COUNT = 5;
const PRIORITY_OPTIONS = [1, 2, 3, 4, 5] as const;
const RECURRENCE_OPTIONS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  mind: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  body: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  soul: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  work: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

const CATEGORY_EMOJI: Record<string, string> = { mind: '🧠', body: '💪', soul: '✨', work: '💼' };

function formatMinutes(mins?: number): string {
  if (!mins) return '';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function AIHelperView() {
  const user = usePlannerStore((s) => s.user);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);
  const [visible, setVisible] = useState<DraftTask[]>([]);
  const [queue, setQueue] = useState<DraftTask[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const today = todayISO();

  async function handleGenerate() {
    if (!text.trim()) return;
    setLoading(true);
    setVisible([]);
    setQueue([]);
    setSubmitted(false);
    setBulkStartTime('');
    setBulkEndTime('');
    try {
      const res = await fetch('/api/ai-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today }),
      });
      const data = (await res.json()) as { tasks?: AISuggestedTask[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed');
      const all: DraftTask[] = (data.tasks ?? []).map((t, i) => ({
        ...t,
        _id: `draft-${i}-${Date.now()}`,
        selected: true,
      }));
      setVisible(all.slice(0, VISIBLE_COUNT));
      setQueue(all.slice(VISIBLE_COUNT));
      if (all.length === 0) toast.info('No tasks found. Try describing what you need to do.');
    } catch (e) {
      toast.error((e as Error).message ?? 'AI call failed');
    } finally {
      setLoading(false);
    }
  }

  function dismissCard(id: string) {
    setVisible((prev) => {
      const next = prev.filter((d) => d._id !== id);
      // pop one from queue into visible
      setQueue((q) => {
        if (q.length === 0) return q;
        const [head, ...tail] = q;
        next.push(head);
        return tail;
      });
      return next;
    });
  }

  function updateDraft(id: string, patch: Partial<DraftTask>) {
    setVisible((prev) => prev.map((d) => (d._id === id ? { ...d, ...patch } : d)));
  }

  function loadMoreFromQueue() {
    setQueue((q) => {
      const batch = q.slice(0, VISIBLE_COUNT);
      const rest = q.slice(VISIBLE_COUNT);
      setVisible((v) => [...v, ...batch]);
      return rest;
    });
  }

  async function handleAddToPlanner() {
    if (!user || savingTasks) return;
    const selected = visible.filter((d) => d.selected);
    if (selected.length === 0) return;
    setSavingTasks(true);
    try {
      await Promise.all(
        selected.map((task) => {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            title: task.title.trim(),
            priority: task.priority,
            status: 'todo',
            recurrence: task.recurrence,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (task.description?.trim()) payload.description = task.description.trim();
          if (task.category && ['mind','body','soul','work'].includes(task.category)) payload.category = task.category;
          if (task.estimatedMinutes) payload.estimatedMinutes = task.estimatedMinutes;
          if (task.dueDate) payload.dueDate = task.dueDate;
          if (task.startTime) payload.startTime = task.startTime;
          if (task.endTime) payload.endTime = task.endTime;
          if (task.recurrence !== 'none') {
            const base = task.dueDate ?? today;
            const d = new Date(base + 'T00:00:00');
            d.setDate(d.getDate() + 30);
            payload.recurrenceEnd = { type: 'until', until: d.toISOString().slice(0, 10) };
          }
          return addDoc(tasksRef(user.uid), payload);
        })
      );
      const count = selected.length;
      setAddedCount((n) => n + count);
      toast.success(`${count} task${count > 1 ? 's' : ''} added to planner!`);
      // remove added tasks from visible; keep unselected ones
      setVisible((prev) => prev.filter((d) => !d.selected));
      // if visible is now empty and queue is empty, show success
      setVisible((prev) => {
        if (prev.length === 0 && queue.length === 0) {
          setSubmitted(true);
        }
        return prev;
      });
    } catch {
      toast.error('Failed to add tasks');
    } finally {
      setSavingTasks(false);
    }
  }

  const [bulkStartTime, setBulkStartTime] = useState('');
  const [bulkEndTime, setBulkEndTime] = useState('');

  function applyBulkTime() {
    if (!bulkStartTime) return;
    setVisible((prev) =>
      prev.map((d) =>
        d.selected
          ? { ...d, startTime: bulkStartTime, endTime: bulkEndTime || undefined }
          : d
      )
    );
    toast.success('Time applied to all selected tasks');
  }

  const selectedCount = visible.filter((d) => d.selected).length;
  const totalRemaining = visible.length + queue.length;

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/30">
              <Sparkles className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI Helper</h1>
              <p className="text-xs text-slate-400">Describe your plans — I'll turn them into tasks</p>
            </div>
          </div>
          {/* Groq speed badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 dark:border-amber-800/50 dark:bg-amber-950/30">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Powered by Groq · blazing fast</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        {/* Left — Input */}
        <div className="flex flex-col gap-4 lg:w-2/5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 animate-slide-in-left">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              What do you need to get done?
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`e.g. "Tomorrow I need to prepare the client presentation by 10am, then review the Q2 report, send a follow-up email to the design team, and book a dentist appointment sometime this week."`}
              rows={8}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <button
              onClick={() => void handleGenerate()}
              disabled={loading || !text.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating tasks…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Generate tasks
                </>
              )}
            </button>
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tips</p>
            <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <li>• Mention deadlines ("by Friday", "tomorrow 9am")</li>
              <li>• Describe urgency to set priority</li>
              <li>• Include recurring tasks ("every Monday")</li>
              <li>• Paste meeting notes, emails, or plans</li>
            </ul>
          </div>

          {/* Stats when tasks are present */}
          {(visible.length > 0 || addedCount > 0) && (
            <div className="flex gap-3 text-center">
              {addedCount > 0 && (
                <div className="flex-1 rounded-xl border border-green-100 bg-green-50 py-2 dark:border-green-900/30 dark:bg-green-950/20">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{addedCount}</p>
                  <p className="text-xs text-green-500">Added</p>
                </div>
              )}
              {totalRemaining > 0 && (
                <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 py-2 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{totalRemaining}</p>
                  <p className="text-xs text-slate-400">Remaining</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — Draft tasks */}
        <div className="flex flex-1 flex-col animate-slide-in-right">
          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-500" />
                <p className="mt-3 text-sm text-slate-400">Analysing your text…</p>
                <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Usually under 2 seconds</p>
              </div>
            </div>
          )}

          {!loading && submitted && visible.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center animate-scale-in">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                <p className="mt-3 text-lg font-semibold text-slate-800 dark:text-white">
                  {addedCount} task{addedCount !== 1 ? 's' : ''} added!
                </p>
                <p className="mt-1 text-sm text-slate-400">Check Day or Week view to see them.</p>
                <button
                  onClick={() => { setSubmitted(false); setAddedCount(0); }}
                  className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Generate more
                </button>
              </div>
            </div>
          )}

          {!loading && !submitted && visible.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <div className="text-center text-slate-400">
                <Sparkles className="mx-auto h-8 w-8 opacity-30" />
                <p className="mt-2 text-sm">Your tasks will appear here</p>
                <p className="mt-1 text-xs opacity-70">Up to 5 at a time — dismiss to see more</p>
              </div>
            </div>
          )}

          {!loading && visible.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* Bulk actions */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Showing {visible.length}{queue.length > 0 ? ` of ${totalRemaining}` : ''} task{visible.length > 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVisible((p) => p.map((d) => ({ ...d, selected: true })))}
                    className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Select all
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    onClick={() => setVisible((p) => p.map((d) => ({ ...d, selected: false })))}
                    className="text-xs text-slate-400 hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Bulk time setter — shown when 2+ tasks are visible */}
              {visible.length > 1 && (
                <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 dark:border-brand-900/40 dark:bg-brand-950/20">
                  <p className="mb-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                    Set same time for all selected tasks
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Start time</label>
                      <input
                        type="time"
                        value={bulkStartTime}
                        onChange={(e) => setBulkStartTime(e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">End time</label>
                      <input
                        type="time"
                        value={bulkEndTime}
                        onChange={(e) => setBulkEndTime(e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={applyBulkTime}
                      disabled={!bulkStartTime}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40 transition"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Apply to {selectedCount} selected
                    </button>
                  </div>
                </div>
              )}

              {/* Task cards */}
              <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                {visible.map((task, i) => (
                  <DraftTaskCard
                    key={task._id}
                    task={task}
                    index={i}
                    isExpanded={expanded === task._id}
                    onToggleExpand={() => setExpanded((e) => (e === task._id ? null : task._id))}
                    onUpdate={(patch) => updateDraft(task._id, patch)}
                    onRemove={() => dismissCard(task._id)}
                  />
                ))}
              </div>

              {/* Load more from queue */}
              {queue.length > 0 && (
                <button
                  onClick={loadMoreFromQueue}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 py-2 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950/20 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Load {Math.min(queue.length, VISIBLE_COUNT)} more ({queue.length} in queue)
                </button>
              )}

              {/* Submit */}
              <button
                onClick={() => void handleAddToPlanner()}
                disabled={selectedCount === 0 || savingTasks}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
              >
                {savingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {savingTasks ? 'Saving…' : `Add ${selectedCount} task${selectedCount !== 1 ? 's' : ''} to planner`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftTaskCard({
  task,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  task: DraftTask;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<DraftTask>) => void;
  onRemove: () => void;
}) {
  const categoryClass = task.category ? (CATEGORY_COLORS[task.category] ?? 'bg-slate-100 text-slate-600') : null;

  return (
    <div
      className={`rounded-xl border bg-white transition dark:bg-slate-900 animate-fade-in ${
        task.selected
          ? 'border-brand-200 dark:border-brand-800'
          : 'border-slate-100 opacity-60 dark:border-slate-800'
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.selected}
          onChange={(e) => onUpdate({ selected: e.target.checked })}
          className="h-4 w-4 rounded accent-brand-600 shrink-0"
        />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={task.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full bg-transparent text-sm font-medium text-slate-800 focus:outline-none dark:text-slate-200"
          />
          {/* Description preview when collapsed */}
          {!isExpanded && task.description && (
            <p className="mt-0.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">{task.description}</p>
          )}
          {/* Badges row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {categoryClass && task.category && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${categoryClass}`}>
                {CATEGORY_EMOJI[task.category ?? ''] ?? <Tag className="h-2.5 w-2.5" />}
                {task.category}
              </span>
            )}
            {task.estimatedMinutes && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Clock className="h-2.5 w-2.5" />
                {formatMinutes(task.estimatedMinutes)}
              </span>
            )}
            {task.dueDate && (
              <span className="text-xs text-slate-400">{task.dueDate}</span>
            )}
          </div>
        </div>

        {/* Priority badge */}
        <span className={`shrink-0 text-xs font-semibold ${priorityColor(task.priority)}`}>
          {priorityLabel(task.priority)}
        </span>

        {/* Expand / collapse */}
        <button
          onClick={onToggleExpand}
          className="shrink-0 rounded p-1 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Remove / dismiss */}
        <button
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-slate-300 hover:text-red-500"
          title="Dismiss"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Description */}
            <div className="col-span-2 sm:col-span-3">
              <label className="mb-1 block text-xs text-slate-400">Description</label>
              <textarea
                value={task.description ?? ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                rows={2}
                placeholder="Task details…"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-xs text-slate-400">Priority</label>
              <select
                value={task.priority}
                onChange={(e) => onUpdate({ priority: Number(e.target.value) as DraftTask['priority'] })}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p} — {priorityLabel(p)}</option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="mb-1 block text-xs text-slate-400">Due date</label>
              <input
                type="date"
                value={task.dueDate ?? ''}
                onChange={(e) => onUpdate({ dueDate: e.target.value || undefined } as Partial<DraftTask>)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Recurrence */}
            <div>
              <label className="mb-1 block text-xs text-slate-400">Repeat</label>
              <select
                value={task.recurrence}
                onChange={(e) => onUpdate({ recurrence: e.target.value as DraftTask['recurrence'] })}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {RECURRENCE_OPTIONS.map((r) => (
                  <option key={r} value={r} className="capitalize">{r}</option>
                ))}
              </select>
            </div>

            {/* Start time */}
            <div>
              <label className="mb-1 block text-xs text-slate-400">Start time</label>
              <input
                type="time"
                value={task.startTime ?? ''}
                onChange={(e) => onUpdate({ startTime: e.target.value || undefined } as Partial<DraftTask>)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* End time */}
            <div>
              <label className="mb-1 block text-xs text-slate-400">End time</label>
              <input
                type="time"
                value={task.endTime ?? ''}
                onChange={(e) => onUpdate({ endTime: e.target.value || undefined } as Partial<DraftTask>)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
