import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import { usePlannerStore } from '@/lib/store';
import { CATEGORY_COLORS, taskOccursOn } from '@/lib/utils';
import type { Task } from '@/lib/types';

export function WeekView() {
  const { tasks, selectedDate, setSelectedDate } = usePlannerStore();

  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function getTasksForDay(dateStr: string) {
    return tasks.filter((t) => taskOccursOn(t, dateStr));
  }

  return (
    <ScrollView className="flex-1 bg-slate-950" showsVerticalScrollIndicator={false}>
      {/* Week header */}
      <View className="flex-row border-b border-slate-800 bg-slate-900">
        {days.map((day) => {
          const dateStr = day.toLocaleDateString('sv');
          const isSelected = dateStr === selectedDate;
          const todayDay = isToday(day);
          return (
            <TouchableOpacity
              key={dateStr}
              onPress={() => setSelectedDate(dateStr)}
              className="flex-1 items-center py-3"
              style={{
                borderBottomWidth: isSelected ? 2 : 0,
                borderBottomColor: '#0ea5e9',
              }}
            >
              <Text className="text-xs text-slate-500">{format(day, 'EEE')}</Text>
              <View
                className="mt-1 h-7 w-7 items-center justify-center rounded-full"
                style={{
                  backgroundColor: todayDay ? '#0ea5e9' : isSelected ? '#1e3a5f' : 'transparent',
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: todayDay || isSelected ? '#fff' : '#94a3b8' }}
                >
                  {format(day, 'd')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Task columns */}
      <View className="flex-row">
        {days.map((day) => {
          const dateStr = day.toLocaleDateString('sv');
          const dayTasks = getTasksForDay(dateStr);
          return (
            <View key={dateStr} className="flex-1 border-r border-slate-800 p-1">
              {dayTasks.slice(0, 4).map((task) => (
                <WeekTaskChip key={task.id} task={task} />
              ))}
              {dayTasks.length > 4 && (
                <Text className="mt-1 text-center text-xs text-slate-500">
                  +{dayTasks.length - 4}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function WeekTaskChip({ task }: { task: Task }) {
  const color = task.category ? CATEGORY_COLORS[task.category] : '#475569';
  return (
    <View
      className="mb-1 rounded px-1 py-0.5"
      style={{ backgroundColor: color + '33', borderLeftWidth: 2, borderLeftColor: color }}
    >
      <Text className="text-xs text-white" numberOfLines={1}>{task.title}</Text>
    </View>
  );
}
