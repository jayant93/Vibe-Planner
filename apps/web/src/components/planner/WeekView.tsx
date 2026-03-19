'use client';

import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg } from '@fullcalendar/core';
import { usePlannerStore } from '@/lib/store';
import { useState, useCallback } from 'react';
import { taskOccursOn } from '@/lib/utils';
import type { Task } from 'shared/types';
import { TaskModal } from './TaskModal';

/** Generate ISO date strings for a range [startStr, endStr) from FullCalendar datesSet */
function rangedays(startStr: string, endStr: string): string[] {
  const days: string[] = [];
  const d = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (d < end) {
    days.push(d.toLocaleDateString('sv'));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function WeekView() {
  const tasks = usePlannerStore((s) => s.tasks);
  const habits = usePlannerStore((s) => s.habits);
  const selectedDate = usePlannerStore((s) => s.selectedDate);
  const setSelectedDate = usePlannerStore((s) => s.setSelectedDate);
  const [modalTask, setModalTask] = useState<Partial<Task> | null>(null);
  // Track the exact visible range FullCalendar reports
  const [visibleDays, setVisibleDays] = useState<string[]>(() => rangedays(selectedDate, (() => {
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 7); return d.toLocaleDateString('sv');
  })()));

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const start = arg.startStr.slice(0, 10);
      const end = arg.endStr.slice(0, 10);
      setSelectedDate(start);
      setVisibleDays(rangedays(start, end));
    },
    [setSelectedDate]
  );

  // Use the actual FullCalendar visible days for event expansion
  const weekDays = visibleDays;

  const taskEvents = tasks
    .filter((t) => t.dueDate)
    .flatMap((t) => {
      if (t.recurrence === 'none') {
        // Only show on its exact due date (if that date is in this week)
        if (!weekDays.includes(t.dueDate!)) return [];
        return [{
          id: t.id,
          title: t.title,
          start: t.startTime ? `${t.dueDate}T${t.startTime}` : t.dueDate!,
          ...(t.startTime && t.endTime ? { end: `${t.dueDate}T${t.endTime}` } : {}),
          allDay: !t.startTime,
          backgroundColor: t.status === 'done' ? '#94a3b8' : priorityEventColor(t.priority),
          borderColor: 'transparent',
          classNames: t.status === 'done' ? ['opacity-50'] : [],
          extendedProps: { task: t },
        }];
      }
      // Recurring: emit one event for each day in the week where it occurs
      return weekDays
        .filter((date) => taskOccursOn(t, date))
        .map((date) => ({
          id: `${t.id}-${date}`,
          title: t.title,
          start: t.startTime ? `${date}T${t.startTime}` : date,
          ...(t.startTime && t.endTime ? { end: `${date}T${t.endTime}` } : {}),
          allDay: !t.startTime,
          backgroundColor: t.status === 'done' ? '#94a3b8' : priorityEventColor(t.priority),
          borderColor: 'transparent',
          classNames: t.status === 'done' ? ['opacity-50'] : [],
          extendedProps: { task: t },
        }));
    });
  const habitEvents = habits
    .filter((h) => h.startTime)
    .flatMap((h) =>
      weekDays.map((date) => {
        const start = `${date}T${h.startTime}`;
        const durationMs = (h.duration ?? 30) * 60 * 1000;
        const endDate = new Date(new Date(start).getTime() + durationMs);
        const end = `${endDate.toLocaleDateString('sv')}T${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`;
        return {
          id: `habit-${h.id}-${date}`,
          title: `🔥 ${h.title}`,
          start,
          end,
          backgroundColor: h.color ?? '#0ea5e9',
          borderColor: 'transparent',
          extendedProps: { isHabit: true },
        };
      })
    );

  const events = [...taskEvents, ...habitEvents];

  return (
    <div className="flex h-full flex-col p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Week Planner</h1>
        <button
          onClick={() => setModalTask({ dueDate: selectedDate, status: 'todo', priority: 3, recurrence: 'none' })}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Task
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate={selectedDate}
          selectable
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' }}
          events={events}
          datesSet={handleDatesSet}
          eventClick={(arg) => {
            const t = arg.event.extendedProps['task'] as Task | undefined;
            if (t) setModalTask(t);
          }}
          height="100%"
          slotMinTime="04:00:00"
          slotMaxTime="23:59:00"
          scrollTime="07:00:00"
          nowIndicator
          dayMaxEvents={3}
          eventDisplay="block"
        />
      </div>

      {modalTask !== null && (
        <TaskModal task={modalTask} onClose={() => setModalTask(null)} />
      )}
    </div>
  );
}

function priorityEventColor(priority: 1 | 2 | 3 | 4 | 5): string {
  const colors: Record<number, string> = { 1: '#94a3b8', 2: '#60a5fa', 3: '#fbbf24', 4: '#fb923c', 5: '#ef4444' };
  return colors[priority] ?? '#0ea5e9';
}
