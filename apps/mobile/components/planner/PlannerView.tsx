import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlannerStore } from '@/lib/store';
import { canUse } from '@/lib/types';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { YearView } from './YearView';

type ViewMode = 'day' | 'week' | 'month' | 'year';

export function PlannerView() {
  const [view, setView] = useState<ViewMode>('day');
  const { user } = usePlannerStore();
  const isPro = user?.subscription.plan === 'pro';

  const tabs: { key: ViewMode; label: string; pro?: boolean }[] = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month', pro: true },
    { key: 'year', label: 'Year', pro: true },
  ];

  function handleTabPress(tab: { key: ViewMode; pro?: boolean }) {
    if (tab.pro && !isPro) {
      // Switch to view anyway, it will show the ProGate inside
    }
    setView(tab.key);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      {/* Tab bar */}
      <View className="flex-row border-b border-slate-800 bg-slate-900 px-4 pt-4 pb-0">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => handleTabPress(tab)}
            className="mr-1 flex-row items-center gap-1 rounded-t-xl px-4 py-2"
            style={{
              backgroundColor: view === tab.key ? '#0f172a' : 'transparent',
              borderTopWidth: view === tab.key ? 2 : 0,
              borderTopColor: '#0ea5e9',
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: view === tab.key ? '#0ea5e9' : '#64748b' }}
            >
              {tab.label}
            </Text>
            {tab.pro && !isPro && <Text className="text-xs">🔒</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View className="flex-1">
        {view === 'day' && <DayView />}
        {view === 'week' && <WeekView />}
        {view === 'month' && <MonthView />}
        {view === 'year' && <YearView />}
      </View>
    </SafeAreaView>
  );
}
