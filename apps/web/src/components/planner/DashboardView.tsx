'use client';

import { useState, useEffect } from 'react';
import { updateDoc, serverTimestamp, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { taskRef, timeLogsRef } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { formatDate, todayISO, priorityColor } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, startOfMonth } from 'date-fns';
import {
  CheckCircle2, Circle, Clock, Flame, Plus,
  ChevronDown, ChevronUp, Timer, BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Task, LifeCategory, TimeLog } from 'shared/types';
import { taskOccursOn } from '@/lib/utils';

// ─── Category Config ───────────────────────────────────────────────────────────

const CATS: {
  key: LifeCategory;
  label: string;
  emoji: string;
  color: string;
  bgLight: string;
  border: string;
  text: string;
  desc: string;
}[] = [
  {
    key: 'mind',
    label: 'Mind',
    emoji: '🧠',
    color: '#818cf8',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-800',
    text: 'text-indigo-600 dark:text-indigo-400',
    desc: 'Reading, Writing & Learning',
  },
  {
    key: 'body',
    label: 'Body',
    emoji: '💪',
    color: '#4ade80',
    bgLight: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-600 dark:text-green-400',
    desc: 'Exercise & Physical Health',
  },
  {
    key: 'soul',
    label: 'Soul',
    emoji: '✨',
    color: '#fbbf24',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
    desc: 'Meditation & Family Time',
  },
  {
    key: 'work',
    label: 'Work',
    emoji: '💼',
    color: '#60a5fa',
    bgLight: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-600 dark:text-blue-400',
    desc: 'Professional Tasks',
  },
];

function fmtMins(mins: number): string {
  if (mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function nextStatus(s: Task['status']): Task['status'] {
  if (s === 'todo') return 'in-progress';
  if (s === 'in-progress') return 'done';
  return 'todo';
}

function StatusIcon({ status }: { status: Task['status'] }) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'in-progress') return <Clock className="h-4 w-4 text-brand-500 animate-pulse" />;
  return <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />;
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const sweep = endDeg - startDeg;
  if (sweep <= 0) return '';
  const o1 = polar(cx, cy, outerR, startDeg);
  const o2 = polar(cx, cy, outerR, endDeg);
  const i1 = polar(cx, cy, innerR, startDeg);
  const i2 = polar(cx, cy, innerR, endDeg);
  const large = sweep > 180 ? 1 : 0;
  return `M ${o1.x} ${o1.y} A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${innerR} ${innerR} 0 ${large} 0 ${i1.x} ${i1.y} Z`;
}

function DonutChart({ data }: { data: Array<{ key: LifeCategory; minutes: number; color: string; label: string; emoji: string }> }) {
  const total = data.reduce((s, d) => s + d.minutes, 0);

  if (total === 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
        <BarChart2 className="h-8 w-8 text-slate-200 dark:text-slate-700" />
        <p className="text-sm text-slate-400">Complete tasks or log time<br />to see your balance</p>
      </div>
    );
  }

  const cx = 64, cy = 64, outerR = 54, innerR = 36;
  let angle = -90;
  const segments = data
    .filter((d) => d.minutes > 0)
    .map((d) => {
      const start = angle;
      const sweep = (d.minutes / total) * 360;
      angle += sweep;
      return { ...d, start, end: angle };
    });

  const totalH = Math.floor(total / 60);
  const totalM = total % 60;
  const totalLabel = totalH > 0 ? `${totalH}h${totalM > 0 ? ` ${totalM}m` : ''}` : `${total}m`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: 128, height: 128 }}>
        <svg viewBox="0 0 128 128" width={128} height={128}>
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="currentColor" strokeWidth={outerR - innerR} className="text-slate-100 dark:text-slate-800" />
          {segments.map((seg, i) => (
            <path key={i} d={sectorPath(cx, cy, outerR, innerR, seg.start, seg.end)} fill={seg.color} opacity={0.85} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold text-slate-900 dark:text-white">{totalLabel}</span>
          <span className="text-xs text-slate-400">total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="w-full space-y-2">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.minutes / total) * 100) : 0;
          return (
            <div key={d.key} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-slate-600 dark:text-slate-400">{d.emoji} {d.label}</span>
              <div className="mx-1 flex-1 rounded-full bg-slate-100 dark:bg-slate-800" style={{ height: 4 }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-10 text-right">{fmtMins(d.minutes)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Log Time Form ─────────────────────────────────────────────────────────────

function LogTimePanel({ uid, today }: { uid: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<LifeCategory>('work');
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const h = parseInt(hours || '0', 10);
    const m = parseInt(mins || '0', 10);
    const total = h * 60 + m;
    if (total <= 0) { toast.error('Enter at least 1 minute'); return; }
    setSaving(true);
    try {
      await addDoc(timeLogsRef(uid), {
        userId: uid,
        date: today,
        category: cat,
        minutes: total,
        note: note.trim() || null,
        createdAt: serverTimestamp(),
      });
      toast.success('Time logged!');
      setHours(''); setMins(''); setNote(''); setOpen(false);
    } catch {
      toast.error('Failed to log time');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Timer className="h-4 w-4 text-brand-500" />
          Log Time for Today
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 space-y-3">
          {/* Category picker */}
          <div className="grid grid-cols-4 gap-2">
            {CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border-2 py-2 text-xs font-medium transition ${
                  cat === c.key
                    ? `${c.border} ${c.bgLight} ${c.text}`
                    : 'border-slate-200 text-slate-400 dark:border-slate-700'
                }`}
              >
                <span className="text-base">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>

          {/* Time input */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-center focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-xs text-slate-500 shrink-0">h</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min={0}
                max={59}
                value={mins}
                onChange={(e) => setMins(e.target.value)}
                placeholder="30"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-center focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-xs text-slate-500 shrink-0">m</span>
            </div>
          </div>

          {/* Note */}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />

          <button
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Log Time'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function DashboardView() {
  const user = usePlannerStore((s) => s.user);
  const tasks = usePlannerStore((s) => s.tasks);
  const habits = usePlannerStore((s) => s.habits);
  const isPro = usePlannerStore((s) => s.isPro());

  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');
  const [catFilter, setCatFilter] = useState<LifeCategory | 'all'>('all');

  const today = todayISO();

  // ── Fetch time logs (real-time) ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const periodStart =
      chartPeriod === 'week'
        ? format(startOfWeek(new Date(), { weekStartsOn: user.preferences?.weekStartsOn ?? 1 }), 'yyyy-MM-dd')
        : format(startOfMonth(new Date()), 'yyyy-MM-dd');

    const q = query(timeLogsRef(user.uid), where('date', '>=', periodStart));
    const unsub = onSnapshot(q, (snap) => {
      setTimeLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeLog)));
    });
    return unsub;
  }, [user, chartPeriod]);

  // ── Period dates ────────────────────────────────────────────────────────────
  const periodStart =
    chartPeriod === 'week'
      ? format(startOfWeek(new Date(), { weekStartsOn: user?.preferences?.weekStartsOn ?? 1 }), 'yyyy-MM-dd')
      : format(startOfMonth(new Date()), 'yyyy-MM-dd');

  // ── Date ranges ─────────────────────────────────────────────────────────────
  const weekStartsOn = user?.preferences?.weekStartsOn ?? 1;
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn }), 'yyyy-MM-dd');

  // Build array of all days in the current week for recurring task expansion
  const weekDaysArr: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + i);
    weekDaysArr.push(d.toLocaleDateString('sv'));
  }

  // ── Today's tasks (for stat counters only) ──────────────────────────────────
  const todayTasks = tasks.filter((t) => taskOccursOn(t, today));
  const doneTasks = todayTasks.filter((t) => t.status === 'done');
  const inProgressTasks = todayTasks.filter((t) => t.status === 'in-progress');

  // ── All tasks visible on dashboard: this week + unscheduled ─────────────────
  const weekAndUnscheduled = tasks
    .filter((t) => {
      if (!t.dueDate) return true; // unscheduled always shown
      if (t.recurrence === 'none') return t.dueDate >= weekStart && t.dueDate <= weekEnd;
      // recurring: show if it occurs on any day this week
      return weekDaysArr.some((day) => taskOccursOn(t, day));
    })
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  // ── Category card data (period: week / month) ───────────────────────────────
  const periodTasks = tasks.filter((t) => {
    if (!t.dueDate) return false;
    if (t.recurrence === 'none') return t.dueDate >= periodStart;
    // recurring: include if still active (not ended before periodStart)
    if (t.recurrenceEnd?.type === 'until' && t.recurrenceEnd.until && t.recurrenceEnd.until < periodStart) return false;
    return t.dueDate <= today; // started on or before today
  });
  const catCardData = CATS.map((cat) => {
    const catTasks = periodTasks.filter((t) => t.category === cat.key);
    const weekCatCount = weekAndUnscheduled.filter((t) => t.category === cat.key && t.status !== 'done').length;
    const doneMins = catTasks
      .filter((t) => t.status === 'done')
      .reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
    const logMins = timeLogs.filter((l) => l.category === cat.key).reduce((s, l) => s + l.minutes, 0);
    return { ...cat, weekCatCount, totalMins: doneMins + logMins };
  });

  // ── Donut chart data ────────────────────────────────────────────────────────
  const chartData = CATS.map((cat) => {
    const taskMins = periodTasks
      .filter((t) => t.status === 'done' && t.category === cat.key)
      .reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
    const logMins = timeLogs.filter((l) => l.category === cat.key).reduce((s, l) => s + l.minutes, 0);
    return { key: cat.key, label: cat.label, emoji: cat.emoji, color: cat.color, minutes: taskMins + logMins };
  });

  // ── Filtered task list ──────────────────────────────────────────────────────
  const filteredTasks =
    catFilter === 'all'
      ? weekAndUnscheduled
      : weekAndUnscheduled.filter((t) => t.category === catFilter);

  async function cycleStatus(task: Task) {
    if (!user) return;
    try {
      await updateDoc(taskRef(user.uid, task.id), { status: nextStatus(task.status), updatedAt: serverTimestamp() });
    } catch {
      toast.error('Failed to update task');
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Good {getGreeting()}, {user?.displayName?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {formatDate(today, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* 4 Life Category Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in" style={{ animationDelay: '40ms' }}>
        {catCardData.map((cat, i) => (
          <button
            key={cat.key}
            onClick={() => setCatFilter((f) => (f === cat.key ? 'all' : cat.key))}
            className={`rounded-2xl border-2 p-4 text-left transition hover:shadow-md active:scale-95 ${
              catFilter === cat.key
                ? `${cat.border} ${cat.bgLight}`
                : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{cat.emoji}</span>
              {catFilter === cat.key && (
                <span className={`text-xs font-medium ${cat.text}`}>active</span>
              )}
            </div>
            <p className="font-bold text-slate-900 dark:text-white">{cat.label}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{cat.desc}</p>
            <div className="mt-3 space-y-1">
              <p className="text-xs text-slate-500">
                <span className={`font-semibold ${cat.text}`}>{cat.weekCatCount}</span> task{cat.weekCatCount !== 1 ? 's' : ''} this week
              </p>
              {cat.totalMins > 0 && (
                <p className="text-xs text-slate-500">
                  <span className={`font-semibold ${cat.text}`}>{fmtMins(cat.totalMins)}</span>{' '}
                  this {chartPeriod}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left — This Week's Tasks (3/5) */}
        <div className="lg:col-span-3 space-y-4 animate-slide-in-left">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              This Week
              {catFilter !== 'all' && (
                <span className="ml-2 normal-case font-normal text-xs">
                  — {CATS.find((c) => c.key === catFilter)?.emoji}{' '}
                  {CATS.find((c) => c.key === catFilter)?.label}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{doneTasks.length}/{todayTasks.length} done today</span>
              <Link href="/planner/day" className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400">
                <Plus className="h-3 w-3" /> Add
              </Link>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
              <p className="text-sm text-slate-400">
                {catFilter === 'all'
                  ? 'No tasks this week — use AI Helper to generate some!'
                  : `No ${CATS.find((c) => c.key === catFilter)?.label} tasks this week`}
              </p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {filteredTasks.map((task) => {
                const catCfg = CATS.find((c) => c.key === task.category);
                const dayLabel = !task.dueDate
                  ? 'Unscheduled'
                  : task.dueDate === today
                    ? 'Today'
                    : format(new Date(task.dueDate + 'T00:00:00'), 'EEE d MMM');
                const isToday = task.dueDate === today;
                const isPast = task.dueDate && task.dueDate < today;
                return (
                  <li
                    key={task.id}
                    className={`flex items-start gap-3 rounded-xl border bg-white p-3 transition dark:bg-slate-900 ${
                      task.status === 'done'
                        ? 'border-slate-100 opacity-50 dark:border-slate-800'
                        : isToday
                          ? 'border-brand-200 dark:border-brand-800'
                          : 'border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => void cycleStatus(task)}
                      className="mt-0.5 shrink-0 transition-transform hover:scale-110 active:scale-95"
                    >
                      <StatusIcon status={task.status} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {task.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {/* Day label */}
                        <span className={`text-xs font-medium ${
                          isToday ? 'text-brand-600 dark:text-brand-400' :
                          isPast && task.status !== 'done' ? 'text-red-500' :
                          'text-slate-400'
                        }`}>
                          {dayLabel}
                        </span>
                        {catCfg && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catCfg.bgLight} ${catCfg.text}`}>
                            {catCfg.emoji} {catCfg.label}
                          </span>
                        )}
                        {task.startTime && (
                          <span className="text-xs text-slate-400">
                            {task.startTime}{task.endTime ? ` – ${task.endTime}` : ''}
                          </span>
                        )}
                        {task.estimatedMinutes && (
                          <span className="text-xs text-slate-400">{fmtMins(task.estimatedMinutes)}</span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${priorityColor(task.priority)}`}>
                      P{task.priority}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{doneTasks.length}/{todayTasks.length}</p>
              <p className="text-xs text-slate-400">done today</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{inProgressTasks.length}</p>
              <p className="text-xs text-slate-400">in progress</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-lg font-bold flex items-center justify-center gap-1 text-orange-500">
                <Flame className="h-4 w-4" />
                {habits.filter((h) => h.completions.includes(today)).length}/{habits.length}
              </p>
              <p className="text-xs text-slate-400">habits done</p>
            </div>
          </div>
        </div>

        {/* Right — Chart + Log (2/5) */}
        <div className="lg:col-span-2 space-y-4 animate-slide-in-right">
          {/* Time Distribution */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Time Balance</h2>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden dark:border-slate-700 text-xs">
                <button
                  onClick={() => setChartPeriod('week')}
                  className={`px-2.5 py-1 transition ${chartPeriod === 'week' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  Week
                </button>
                <button
                  onClick={() => setChartPeriod('month')}
                  className={`px-2.5 py-1 transition ${chartPeriod === 'month' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  Month
                </button>
              </div>
            </div>
            <DonutChart data={chartData} />
          </div>

          {/* Log Time */}
          {user && <LogTimePanel uid={user.uid} today={today} />}

          {/* Habits summary */}
          {habits.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Flame className="h-3.5 w-3.5 text-orange-400" /> Habits
                </h2>
                <Link href="/habits" className="text-xs text-brand-600 hover:underline dark:text-brand-400">View all</Link>
              </div>
              <ul className="space-y-1.5">
                {habits.slice(0, 5).map((habit) => {
                  const done = habit.completions.includes(today);
                  return (
                    <li key={habit.id} className="flex items-center gap-2">
                      {done
                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                        : <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />}
                      <span className={`flex-1 text-xs ${done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {habit.title}
                      </span>
                      {isPro && (
                        <span className="text-xs text-orange-500 flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5" />{habit.streak.current}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
