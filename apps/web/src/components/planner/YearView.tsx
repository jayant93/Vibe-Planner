'use client';

import { usePlannerStore } from '@/lib/store';
import { canUse } from 'shared/utils/gates';
import { ProGate } from '@/components/ui/ProGate';
import { eachMonthOfInterval, startOfYear, endOfYear, format, parseISO, isSameMonth } from 'date-fns';

export function YearView() {
  const subscription = usePlannerStore((s) => s.subscription());
  const tasks = usePlannerStore((s) => s.tasks);

  if (!canUse('yearlyView', subscription)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <ProGate feature="yearlyView" className="max-w-md w-full" />
      </div>
    );
  }

  const year = new Date().getFullYear();
  const months = eachMonthOfInterval({
    start: startOfYear(new Date(year, 0, 1)),
    end: endOfYear(new Date(year, 0, 1)),
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">
        Year {year}
      </h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => {
          const monthTasks = tasks.filter(
            (t) => t.dueDate && isSameMonth(parseISO(t.dueDate), month)
          );
          const done = monthTasks.filter((t) => t.status === 'done').length;
          const total = monthTasks.length;

          return (
            <div
              key={month.toISOString()}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {format(month, 'MMMM')}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
              <p className="text-xs text-slate-400">{done} completed</p>
              {total > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.round((done / total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
