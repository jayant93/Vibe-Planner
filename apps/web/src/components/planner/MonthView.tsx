'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { usePlannerStore } from '@/lib/store';
import { canUse } from 'shared/utils/gates';
import { ProGate } from '@/components/ui/ProGate';
import { taskOccursOn } from '@/lib/utils';
import { useState } from 'react';
import type { Task } from 'shared/types';
import { TaskModal } from './TaskModal';

export function MonthView() {
  const subscription = usePlannerStore((s) => s.subscription());
  const tasks = usePlannerStore((s) => s.tasks);
  const [modalTask, setModalTask] = useState<Partial<Task> | null>(null);

  if (!canUse('monthlyView', subscription)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <ProGate feature="monthlyView" className="max-w-md w-full" />
      </div>
    );
  }

  // Expand recurring tasks across the visible month (+/- buffer)
  const monthStart = new Date();
  monthStart.setDate(1);
  const days: string[] = [];
  for (let i = -7; i <= 45; i++) {
    const d = new Date(monthStart);
    d.setDate(monthStart.getDate() + i);
    days.push(d.toLocaleDateString('sv')); // local YYYY-MM-DD
  }

  const events = tasks
    .filter((t) => t.dueDate != null)
    .flatMap((t) => {
      if (t.recurrence === 'none') {
        return [{ id: t.id, title: t.title, date: t.dueDate as string,
          backgroundColor: priorityEventColor(t.priority), borderColor: 'transparent',
          extendedProps: { task: t } }];
      }
      return days
        .filter((date) => taskOccursOn(t, date))
        .map((date) => ({ id: `${t.id}-${date}`, title: t.title, date,
          backgroundColor: priorityEventColor(t.priority), borderColor: 'transparent',
          extendedProps: { task: t } }));
    });

  return (
    <div className="flex h-full flex-col p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Month Planner</h1>
      </div>
      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          selectable
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          events={events}
          eventClick={(arg) => setModalTask(arg.event.extendedProps['task'] as Task)}
          dateClick={(arg) => setModalTask({ dueDate: arg.dateStr, status: 'todo', priority: 3, recurrence: 'none' })}
          height="100%"
        />
      </div>
      {modalTask !== null && <TaskModal task={modalTask} onClose={() => setModalTask(null)} />}
    </div>
  );
}

function priorityEventColor(priority: 1 | 2 | 3 | 4 | 5): string {
  const colors: Record<number, string> = { 1: '#94a3b8', 2: '#60a5fa', 3: '#fbbf24', 4: '#fb923c', 5: '#ef4444' };
  return colors[priority] ?? '#0ea5e9';
}
