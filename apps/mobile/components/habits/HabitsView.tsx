import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Plus, Lock, Flame, Edit2, Trash2 } from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { canUse, FREE_TIER } from '@/lib/types';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HabitModal } from './HabitModal';
import type { Habit } from '@/lib/types';

export function HabitsView() {
  const { user, habits, selectedDate } = usePlannerStore();
  const [showModal, setShowModal] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);

  const isPro = user?.subscription.plan === 'pro';
  const todayStr = new Date().toLocaleDateString('sv');

  async function toggleCompletion(habit: Habit) {
    if (!user) return;
    const done = habit.completions.includes(todayStr);
    const next = done
      ? habit.completions.filter((d) => d !== todayStr)
      : [...habit.completions, todayStr];

    let streak = habit.streak;
    if (!done) {
      streak = { ...streak, current: streak.current + 1, lastCompleted: todayStr };
      if (streak.current > streak.longest) streak.longest = streak.current;
    } else {
      streak = { ...streak, current: Math.max(0, streak.current - 1) };
    }

    await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), {
      completions: next,
      streak,
    });
  }

  async function deleteHabit(habitId: string) {
    if (!user) return;
    Alert.alert('Delete habit', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteDoc(doc(db, 'users', user.uid, 'habits', habitId)),
      },
    ]);
  }

  function handleAdd() {
    if (!isPro && habits.length >= FREE_TIER.MAX_HABITS) {
      Alert.alert(
        'Pro Required',
        `Free plan supports up to ${FREE_TIER.MAX_HABITS} habits. Upgrade to Pro for unlimited habit tracking.`
      );
      return;
    }
    setEditHabit(null);
    setShowModal(true);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-row items-center justify-between border-b border-slate-800 px-4 py-4">
        <Text className="text-xl font-bold text-white">Habits</Text>
        <TouchableOpacity
          onPress={handleAdd}
          className="flex-row items-center gap-1 rounded-xl bg-sky-500 px-3 py-2"
        >
          <Plus size={16} color="#fff" />
          <Text className="text-sm font-semibold text-white">Add</Text>
        </TouchableOpacity>
      </View>

      {!isPro && (
        <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl bg-amber-900/30 px-3 py-2">
          <Lock size={14} color="#f59e0b" />
          <Text className="flex-1 text-xs text-amber-400">
            {habits.length}/{FREE_TIER.MAX_HABITS} habits · Upgrade for unlimited
          </Text>
        </View>
      )}

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {habits.length === 0 && (
          <View className="mt-12 items-center">
            <Text className="text-4xl">🏃</Text>
            <Text className="mt-3 text-slate-400">No habits yet</Text>
            <Text className="text-sm text-slate-600">Tap + to add your first habit</Text>
          </View>
        )}

        {habits.map((habit) => {
          const done = habit.completions.includes(todayStr);
          return (
            <View
              key={habit.id}
              className="mb-3 rounded-2xl bg-slate-800 p-4"
              style={{ borderLeftWidth: 3, borderLeftColor: habit.color ?? '#0ea5e9' }}
            >
              <View className="flex-row items-start gap-3">
                {/* Completion toggle */}
                <TouchableOpacity
                  onPress={() => toggleCompletion(habit)}
                  className="mt-0.5 h-6 w-6 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: done ? habit.color ?? '#0ea5e9' : '#475569',
                    backgroundColor: done ? habit.color ?? '#0ea5e9' : 'transparent',
                  }}
                >
                  {done && <Text className="text-xs text-white">✓</Text>}
                </TouchableOpacity>

                {/* Info */}
                <View className="flex-1">
                  <Text
                    className="font-semibold text-white"
                    style={{ textDecorationLine: done ? 'line-through' : 'none' }}
                  >
                    {habit.title}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-3">
                    <Text className="text-xs capitalize text-slate-400">
                      {habit.targetFrequency}
                    </Text>
                    {habit.startTime && (
                      <Text className="text-xs text-slate-500">{habit.startTime}</Text>
                    )}
                    {habit.duration && (
                      <Text className="text-xs text-slate-500">{habit.duration}min</Text>
                    )}
                  </View>

                  {/* Streak */}
                  <View className="mt-2 flex-row items-center gap-1">
                    {isPro ? (
                      <>
                        <Flame size={14} color="#f97316" />
                        <Text className="text-sm font-semibold text-orange-400">
                          {habit.streak.current}
                        </Text>
                        <Text className="text-xs text-slate-500">
                          day streak · best {habit.streak.longest}
                        </Text>
                      </>
                    ) : (
                      <View className="flex-row items-center gap-1">
                        <Lock size={12} color="#64748b" />
                        <Text className="text-xs text-slate-600">Streaks (Pro)</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View className="gap-2">
                  <TouchableOpacity onPress={() => { setEditHabit(habit); setShowModal(true); }}>
                    <Edit2 size={16} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteHabit(habit.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View className="h-6" />
      </ScrollView>

      <HabitModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditHabit(null); }}
        editHabit={editHabit}
      />
    </SafeAreaView>
  );
}
