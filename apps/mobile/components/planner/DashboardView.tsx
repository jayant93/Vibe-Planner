import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { format } from 'date-fns';
import { usePlannerStore } from '@/lib/store';
import { CATEGORY_COLORS, CATEGORY_EMOJIS, formatDateLabel } from '@/lib/utils';
import type { LifeCategory, Task, TimeLog } from '@/lib/types';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { db, timeLogsRef } from '@/lib/firebase';

const CATEGORIES: LifeCategory[] = ['mind', 'body', 'soul', 'work'];

export function DashboardView() {
  const { user, tasks, habits, selectedDate, isPro } = usePlannerStore();
  const [logCategory, setLogCategory] = useState<LifeCategory>('work');
  const [logMinutes, setLogMinutes] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logging, setLogging] = useState(false);

  const todayStr = new Date().toLocaleDateString('sv');
  const todayTasks = tasks.filter(
    (t) => t.dueDate === todayStr || (t.recurrence !== 'none' && t.dueDate && t.dueDate <= todayStr)
  );

  const doneCount = todayTasks.filter((t) => t.status === 'done').length;
  const inProgressCount = todayTasks.filter((t) => t.status === 'in-progress').length;
  const todayHabits = habits.filter((h) => h.targetFrequency === 'daily');
  const doneHabits = todayHabits.filter((h) => h.completions.includes(todayStr)).length;

  function getCategoryStats(cat: LifeCategory) {
    const catTasks = todayTasks.filter((t) => t.category === cat);
    return {
      total: catTasks.length,
      done: catTasks.filter((t) => t.status === 'done').length,
    };
  }

  async function logTime() {
    if (!user || !logMinutes || isNaN(Number(logMinutes))) return;
    setLogging(true);
    try {
      await addDoc(timeLogsRef(user.uid), {
        userId: user.uid,
        date: todayStr,
        category: logCategory,
        minutes: Number(logMinutes),
        note: logNote || undefined,
        createdAt: serverTimestamp(),
      });
      setLogMinutes('');
      setLogNote('');
    } catch (e) {
      Alert.alert('Error', 'Failed to log time');
    } finally {
      setLogging(false);
    }
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6 mt-4">
          <Text className="text-2xl font-bold text-white">
            {greeting()}, {user?.displayName?.split(' ')[0] ?? 'there'} 👋
          </Text>
          <Text className="mt-1 text-slate-400">
            {format(new Date(), 'EEEE, MMMM d')}
          </Text>
        </View>

        {/* Quick stats */}
        <View className="mb-6 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-slate-800 p-4">
            <Text className="text-2xl font-bold text-white">{doneCount}</Text>
            <Text className="text-xs text-slate-400">Done today</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-slate-800 p-4">
            <Text className="text-2xl font-bold text-amber-400">{inProgressCount}</Text>
            <Text className="text-xs text-slate-400">In progress</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-slate-800 p-4">
            <Text className="text-2xl font-bold text-emerald-400">{doneHabits}</Text>
            <Text className="text-xs text-slate-400">Habits done</Text>
          </View>
        </View>

        {/* Life category cards */}
        <Text className="mb-3 text-base font-semibold text-slate-300">Life Balance</Text>
        <View className="mb-6 flex-row flex-wrap gap-3">
          {CATEGORIES.map((cat) => {
            const stats = getCategoryStats(cat);
            const color = CATEGORY_COLORS[cat];
            return (
              <View
                key={cat}
                className="w-[47%] rounded-2xl bg-slate-800 p-4"
                style={{ borderLeftWidth: 3, borderLeftColor: color }}
              >
                <Text className="text-lg">{CATEGORY_EMOJIS[cat]}</Text>
                <Text className="mt-1 font-semibold capitalize text-white">{cat}</Text>
                <Text className="text-xs text-slate-400">
                  {stats.done}/{stats.total} tasks
                </Text>
                {stats.total > 0 && (
                  <View className="mt-2 h-1.5 rounded-full bg-slate-700">
                    <View
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${(stats.done / stats.total) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Today's tasks */}
        <Text className="mb-3 text-base font-semibold text-slate-300">
          Today's Tasks ({todayTasks.length})
        </Text>
        <View className="mb-6 gap-2">
          {todayTasks.length === 0 && (
            <View className="rounded-2xl bg-slate-800 p-6 items-center">
              <Text className="text-slate-500">No tasks for today 🎉</Text>
            </View>
          )}
          {todayTasks.slice(0, 5).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {todayTasks.length > 5 && (
            <Text className="text-center text-sm text-slate-500">
              +{todayTasks.length - 5} more tasks
            </Text>
          )}
        </View>

        {/* Time log */}
        <Text className="mb-3 text-base font-semibold text-slate-300">Log Time</Text>
        <View className="mb-6 rounded-2xl bg-slate-800 p-4">
          {/* Category selector */}
          <View className="mb-3 flex-row gap-2">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setLogCategory(cat)}
                className="flex-1 items-center rounded-xl py-2"
                style={{
                  backgroundColor:
                    logCategory === cat ? CATEGORY_COLORS[cat] + '33' : '#334155',
                  borderWidth: logCategory === cat ? 1.5 : 0,
                  borderColor: logCategory === cat ? CATEGORY_COLORS[cat] : 'transparent',
                }}
              >
                <Text className="text-xs capitalize text-white">{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 rounded-xl bg-slate-700 px-3 py-2 text-white"
              placeholder="Minutes"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={logMinutes}
              onChangeText={setLogMinutes}
            />
            <TextInput
              className="flex-[2] rounded-xl bg-slate-700 px-3 py-2 text-white"
              placeholder="Note (optional)"
              placeholderTextColor="#64748b"
              value={logNote}
              onChangeText={setLogNote}
            />
          </View>
          <TouchableOpacity
            onPress={logTime}
            disabled={logging || !logMinutes}
            className="mt-3 rounded-xl bg-sky-500 py-3 items-center"
            style={{ opacity: logging || !logMinutes ? 0.5 : 1 }}
          >
            <Text className="font-semibold text-white">Log Time</Text>
          </TouchableOpacity>
        </View>

        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskRow({ task }: { task: Task }) {
  const color = task.category ? CATEGORY_COLORS[task.category] : '#64748b';
  return (
    <View
      className="flex-row items-center gap-3 rounded-xl bg-slate-800 p-3"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <View
        className="h-5 w-5 rounded-full border-2"
        style={{
          borderColor: task.status === 'done' ? '#22c55e' : '#475569',
          backgroundColor: task.status === 'done' ? '#22c55e' : 'transparent',
        }}
      />
      <View className="flex-1">
        <Text
          className="text-sm font-medium text-white"
          style={{ textDecorationLine: task.status === 'done' ? 'line-through' : 'none' }}
        >
          {task.title}
        </Text>
        {task.startTime && (
          <Text className="text-xs text-slate-500">{task.startTime}</Text>
        )}
      </View>
    </View>
  );
}
