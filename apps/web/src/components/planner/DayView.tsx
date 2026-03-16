'use client';

import { useCallback, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { taskRef, habitRef } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { AIScheduleButton } from '@/components/ai/AIScheduleButton';
import { TaskModal } from '@/components/planner/TaskModal';
import { CheckCircle2, Circle, Clock, Flame, Plus, CalendarClock } from 'lucide-react';
import { TaskStopwatch, shouldShowStopwatch } from '@/components/planner/TaskStopwatch';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { taskOccursOn } from '@/lib/utils';
import type { Task } from 'shared/types';

export function DayView() {
  const user = usePlannerStore((s) => s.user);
  const tasks = usePlannerStore((s) => s.tasks);
  const habits = usePlannerStore((s) => s.habits);
  const selectedDate = usePlannerStore((s) => s.selectedDate);
  const setSelectedDate = usePlannerStore((s) => s.setSelectedDate);
  const [modalTask, setModalTask] = useState<Partial<Task> | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const formattedDate = format(parseISO(selectedDate), 'EEEE, MMMM d');

  // All-day tasks: occurs on selectedDate (handles recurrence) and no start time
  const allDayTasks = tasks.filter((t) => taskOccursOn(t, selectedDate) && !t.startTime);
  const doneCount = allDayTasks.filter((t) => t.status === 'done').length;

  // Timed tasks for FullCalendar
  const timedEvents = tasks
    .filter((t) => t.startTime && taskOccursOn(t, selectedDate))
    .map((t) => ({
      id: t.id,
      title: t.title,
      start: `${selectedDate}T${t.startTime}`,
      end: `${selectedDate}T${t.endTime ?? t.startTime}`,
      backgroundColor: t.status === 'done' ? '#94a3b8' : priorityColor(t.priority),
      borderColor: 'transparent',
      classNames: t.status === 'done' ? ['opacity-60'] : [],
      extendedProps: { task: t },
    }));

  function nextStatus(s: Task['status']): Task['status'] {
    if (s === 'todo') return 'in-progress';
    if (s === 'in-progress') return 'done';
    return 'todo';
  }

  async function toggleTask(task: Task) {
    if (!user) return;
    setCompleting(task.id);
    try {
      await updateDoc(taskRef(user.uid, task.id), {
        status: nextStatus(task.status),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    } finally {
      setCompleting(null);
    }
  }

  async function toggleHabit(habitId: string, completedToday: boolean) {
    if (!user) return;
    try {
      await updateDoc(habitRef(user.uid, habitId), {
        completions: completedToday ? arrayRemove(selectedDate) : arrayUnion(selectedDate),
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update habit');
    }
  }

  // Sync FullCalendar navigation → Zustand selectedDate
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setSelectedDate(arg.startStr.slice(0, 10));
    },
    [setSelectedDate]
  );

  const handleDateSelect = useCallback(
    (arg: DateSelectArg) => {
      setModalTask({
        startTime: arg.startStr.slice(11, 16),
        endTime: arg.endStr.slice(11, 16),
        dueDate: selectedDate,
        status: 'todo',
        priority: 3,
        recurrence: 'none',
      });
    },
    [selectedDate]
  );

  const handleEventClick = useCallback((arg: EventClickArg) => {
    setModalTask(arg.event.extendedProps['task'] as Task);
  }, []);

  return (
    <div className="flex h-full flex-col gap-0 bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="animate-fade-in min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-white">{formattedDate}</h1>
          <p className="text-xs text-slate-400">
            {allDayTasks.length > 0
              ? `${doneCount} of ${allDayTasks.length} done`
              : 'No tasks yet'}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <AIScheduleButton date={selectedDate} />
          <button
            onClick={() =>
              setModalTask({ dueDate: selectedDate, status: 'todo', priority: 3, recurrence: 'none' })
            }
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4 md:flex-row md:overflow-hidden">
        {/* Left panel */}
        <div className="flex w-full flex-shrink-0 flex-col gap-4 md:w-64 md:overflow-y-auto">

          {/* Progress ring + tasks */}
          <div className="animate-slide-in-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {/* Mini progress bar */}
            {allDayTasks.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Progress</span>
                  <span className="text-xs font-semibold text-brand-600">
                    {Math.round((doneCount / allDayTasks.length) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${(doneCount / allDayTasks.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tasks
            </p>

            {allDayTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CalendarClock className="h-8 w-8 text-slate-200 dark:text-slate-700" />
                <p className="text-xs text-slate-400">
                  No tasks today.
                  <br />
                  Click <strong>Add Task</strong> to start.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {allDayTasks.map((task, i) => (
                  <li
                    key={task.id}
                    className="group flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => setModalTask(task)}
                  >
                    <button
                      className={`mt-0.5 flex-shrink-0 transition-transform ${completing === task.id ? 'animate-check-pop' : 'hover:scale-110'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleTask(task);
                      }}
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : task.status === 'in-progress' ? (
                        <Clock className="h-4 w-4 text-brand-500 animate-pulse" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-300 group-hover:text-brand-400 dark:text-slate-600" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-xs leading-relaxed transition-colors ${
                        task.status === 'done'
                          ? 'text-slate-400 line-through dark:text-slate-600'
                          : 'font-medium text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {task.title}
                    </span>
                    {shouldShowStopwatch(task) && task.status !== 'done' && (
                      <TaskStopwatch task={task} />
                    )}
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full mt-1.5"
                      style={{ backgroundColor: priorityColor(task.priority) }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Habits */}
          {habits.length > 0 && (
            <div
              className="animate-slide-in-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              style={{ animationDelay: '60ms' }}
            >
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                Habits
              </p>
              <ul className="space-y-1">
                {habits.map((habit, i) => {
                  const done = habit.completions.includes(selectedDate);
                  return (
                    <li
                      key={habit.id}
                      className="group flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                      style={{ animationDelay: `${80 + i * 40}ms` }}
                      onClick={() => void toggleHabit(habit.id, done)}
                    >
                      <span className="flex-shrink-0 transition-transform hover:scale-110">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-300 group-hover:text-orange-400 dark:text-slate-600" />
                        )}
                      </span>
                      <span
                        className={`flex-1 text-xs leading-relaxed transition-colors ${
                          done
                            ? 'text-slate-400 line-through dark:text-slate-600'
                            : 'font-medium text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {habit.title}
                      </span>
                      {done && (
                        <span className="text-xs">🔥</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Right: FullCalendar */}
        <div className="animate-slide-in-right min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:min-h-0">
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridDay"
            initialDate={selectedDate}
            selectable
            editable
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            events={timedEvents}
            select={handleDateSelect}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="100%"
            slotMinTime="04:00:00"
            slotMaxTime="23:59:00"
            scrollTime="07:00:00"
            slotDuration="00:30:00"
            nowIndicator
            allDaySlot={false}
          />
        </div>
      </div>

      {modalTask !== null && (
        <TaskModal task={modalTask} onClose={() => setModalTask(null)} />
      )}
    </div>
  );
}

function priorityColor(priority: 1 | 2 | 3 | 4 | 5): string {
  const colors: Record<number, string> = {
    1: '#94a3b8',
    2: '#60a5fa',
    3: '#fbbf24',
    4: '#fb923c',
    5: '#ef4444',
  };
  return colors[priority] ?? '#0ea5e9';
}
