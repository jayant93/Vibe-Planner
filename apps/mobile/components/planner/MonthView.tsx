import { View, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { usePlannerStore } from '@/lib/store';
import { CATEGORY_COLORS, taskOccursOn } from '@/lib/utils';
import { ProGate } from '@/components/ui/ProGate';
import { router } from 'expo-router';

export function MonthView() {
  const { user, tasks, selectedDate, setSelectedDate } = usePlannerStore();
  const isPro = user?.subscription.plan === 'pro';

  if (!isPro) {
    return (
      <ProGate
        feature="Monthly View"
        reason="Monthly view is a Pro feature. Upgrade to see your full month at a glance."
      />
    );
  }

  // Build marked dates
  const markedDates: Record<string, { dots: { color: string }[]; selected?: boolean; selectedColor?: string }> = {};

  tasks.forEach((task) => {
    const dateStr = task.dueDate;
    if (!dateStr) return;
    const color = task.category ? CATEGORY_COLORS[task.category] : '#475569';
    if (!markedDates[dateStr]) markedDates[dateStr] = { dots: [] };
    if (markedDates[dateStr].dots.length < 3) {
      markedDates[dateStr].dots.push({ color });
    }
  });

  if (markedDates[selectedDate]) {
    markedDates[selectedDate].selected = true;
    markedDates[selectedDate].selectedColor = '#0ea5e9';
  } else {
    markedDates[selectedDate] = { dots: [], selected: true, selectedColor: '#0ea5e9' };
  }

  return (
    <View className="flex-1 bg-slate-950">
      <Calendar
        current={selectedDate}
        onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
        markingType="multi-dot"
        markedDates={markedDates}
        theme={{
          backgroundColor: '#0f172a',
          calendarBackground: '#0f172a',
          textSectionTitleColor: '#64748b',
          selectedDayBackgroundColor: '#0ea5e9',
          selectedDayTextColor: '#fff',
          todayTextColor: '#0ea5e9',
          dayTextColor: '#e2e8f0',
          textDisabledColor: '#334155',
          monthTextColor: '#fff',
          arrowColor: '#0ea5e9',
          dotColor: '#0ea5e9',
        }}
      />
      {/* Tasks for selected day */}
      <View className="border-t border-slate-800 px-4 pt-3">
        <Text className="mb-2 text-sm font-semibold text-slate-300">
          {selectedDate} tasks
        </Text>
        {tasks
          .filter((t) => taskOccursOn(t, selectedDate))
          .map((task) => (
            <View
              key={task.id}
              className="mb-2 rounded-xl bg-slate-800 px-3 py-2"
              style={{
                borderLeftWidth: 3,
                borderLeftColor: task.category ? CATEGORY_COLORS[task.category] : '#475569',
              }}
            >
              <Text className="text-sm text-white">{task.title}</Text>
            </View>
          ))}
      </View>
    </View>
  );
}
