import { View, Text, ScrollView } from 'react-native';
import { usePlannerStore } from '@/lib/store';
import { ProGate } from '@/components/ui/ProGate';
import { format, parseISO } from 'date-fns';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function YearView() {
  const { user, tasks } = usePlannerStore();
  const isPro = user?.subscription.plan === 'pro';

  if (!isPro) {
    return (
      <ProGate
        feature="Yearly View"
        reason="Yearly view is a Pro feature. Upgrade to plan your entire year."
      />
    );
  }

  const year = new Date().getFullYear();

  function getMonthStats(monthIdx: number) {
    const prefix = `${year}-${(monthIdx + 1).toString().padStart(2, '0')}`;
    const monthTasks = tasks.filter((t) => t.dueDate?.startsWith(prefix));
    return {
      total: monthTasks.length,
      done: monthTasks.filter((t) => t.status === 'done').length,
    };
  }

  return (
    <ScrollView className="flex-1 bg-slate-950 px-4" showsVerticalScrollIndicator={false}>
      <Text className="mb-4 mt-4 text-lg font-bold text-white">{year} Overview</Text>
      <View className="flex-row flex-wrap gap-3">
        {MONTHS.map((month, idx) => {
          const stats = getMonthStats(idx);
          const pct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
          const isCurrent = idx === new Date().getMonth();
          return (
            <View
              key={month}
              className="w-[47%] rounded-2xl bg-slate-800 p-4"
              style={isCurrent ? { borderWidth: 1.5, borderColor: '#0ea5e9' } : {}}
            >
              <Text className="font-semibold text-white">{month}</Text>
              <Text className="mt-1 text-xs text-slate-400">
                {stats.done}/{stats.total} tasks
              </Text>
              <View className="mt-2 h-1.5 rounded-full bg-slate-700">
                <View
                  className="h-1.5 rounded-full bg-sky-500"
                  style={{ width: `${pct}%` }}
                />
              </View>
              <Text className="mt-1 text-right text-xs text-slate-500">
                {Math.round(pct)}%
              </Text>
            </View>
          );
        })}
      </View>
      <View className="h-8" />
    </ScrollView>
  );
}
