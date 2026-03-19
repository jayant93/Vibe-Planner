import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Timer } from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { CATEGORY_COLORS, CATEGORY_EMOJIS, formatDateLabel, taskOccursOn } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TaskModal } from './TaskModal';

const HOURS = Array.from({ length: 20 }, (_, i) => i + 4); // 04:00 – 23:00

export function DayView() {
  const { user, tasks, habits, selectedDate, setSelectedDate, startTimer } = usePlannerStore();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [prefillHour, setPrefillHour] = useState<number | null>(null);

  const dayTasks = tasks.filter((t) => taskOccursOn(t, selectedDate));
  const allDayTasks = dayTasks.filter((t) => !t.startTime);
  const timedTasks = dayTasks.filter((t) => t.startTime);
  const todayHabits = habits.filter((h) => h.targetFrequency === 'daily');

  async function cycleStatus(task: Task) {
    if (!user) return;
    const next =
      task.status === 'todo' ? 'in-progress' : task.status === 'in-progress' ? 'done' : 'todo';
    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
      status: next,
      updatedAt: serverTimestamp(),
    });
  }

  async function toggleHabit(habitId: string, completions: string[]) {
    if (!user) return;
    const todayStr = selectedDate;
    const isDone = completions.includes(todayStr);
    const next = isDone
      ? completions.filter((d) => d !== todayStr)
      : [...completions, todayStr];
    await updateDoc(doc(db, 'users', user.uid, 'habits', habitId), { completions: next });
  }

  function goDay(delta: number) {
    const d = parseISO(selectedDate);
    setSelectedDate((delta > 0 ? addDays(d, 1) : subDays(d, 1)).toLocaleDateString('sv'));
  }

  function getTasksForHour(hour: number) {
    return timedTasks.filter((t) => {
      if (!t.startTime) return false;
      return parseInt(t.startTime.split(':')[0]) === hour;
    });
  }

  return (
    <View className="flex-1 bg-slate-950">
      {/* Date nav */}
      <View className="flex-row items-center justify-between border-b border-slate-800 px-4 py-3">
        <TouchableOpacity onPress={() => goDay(-1)} className="p-2">
          <ChevronLeft size={20} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="font-semibold text-white">{formatDateLabel(selectedDate)}</Text>
        <TouchableOpacity onPress={() => goDay(1)} className="p-2">
          <ChevronRight size={20} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* All-day tasks */}
        <View className="border-b border-slate-800 px-4 py-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              All-day
            </Text>
            <TouchableOpacity onPress={() => { setEditTask(null); setPrefillHour(null); setShowTaskModal(true); }}>
              <Plus size={16} color="#0ea5e9" />
            </TouchableOpacity>
          </View>
          {allDayTasks.length === 0 && (
            <Text className="text-sm text-slate-600">No all-day tasks</Text>
          )}
          {allDayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onPress={() => cycleStatus(task)}
              onLongPress={() => { setEditTask(task); setShowTaskModal(true); }}
              onTimerPress={() => startTimer({ taskId: task.id, taskTitle: task.title, startedAt: Date.now(), category: task.category })}
            />
          ))}
        </View>

        {/* Habits */}
        {todayHabits.length > 0 && (
          <View className="border-b border-slate-800 px-4 py-3">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Habits
            </Text>
            <View className="gap-2">
              {todayHabits.map((habit) => {
                const done = habit.completions.includes(selectedDate);
                return (
                  <TouchableOpacity
                    key={habit.id}
                    onPress={() => toggleHabit(habit.id, habit.completions)}
                    className="flex-row items-center gap-3 rounded-xl bg-slate-800 p-3"
                  >
                    <View
                      className="h-5 w-5 rounded-full border-2 items-center justify-center"
                      style={{
                        borderColor: done ? habit.color ?? '#0ea5e9' : '#475569',
                        backgroundColor: done ? habit.color ?? '#0ea5e9' : 'transparent',
                      }}
                    >
                      {done && <Text className="text-xs text-white">✓</Text>}
                    </View>
                    <Text className="text-sm text-white" style={{ textDecorationLine: done ? 'line-through' : 'none' }}>
                      {habit.title}
                    </Text>
                    {habit.startTime && (
                      <Text className="ml-auto text-xs text-slate-500">{habit.startTime}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Time grid */}
        <View className="px-4 py-2">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Schedule
          </Text>
          {HOURS.map((hour) => {
            const hourTasks = getTasksForHour(hour);
            return (
              <TouchableOpacity
                key={hour}
                onPress={() => { setEditTask(null); setPrefillHour(hour); setShowTaskModal(true); }}
                className="flex-row"
                style={{ minHeight: 52 }}
                activeOpacity={0.7}
              >
                <Text className="w-12 pt-1 text-xs text-slate-600">
                  {hour.toString().padStart(2, '0')}:00
                </Text>
                <View className="flex-1 border-t border-slate-800 pt-1 gap-1 pb-1">
                  {hourTasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => cycleStatus(task)}
                      onLongPress={() => { setEditTask(task); setShowTaskModal(true); }}
                      className="rounded-lg px-2 py-1.5"
                      style={{
                        backgroundColor: task.category
                          ? CATEGORY_COLORS[task.category] + '33'
                          : '#1e293b',
                        borderLeftWidth: 3,
                        borderLeftColor: task.category
                          ? CATEGORY_COLORS[task.category]
                          : '#475569',
                      }}
                    >
                      <Text className="text-xs font-medium text-white">{task.title}</Text>
                      <Text className="text-xs text-slate-400">
                        {task.startTime}{task.endTime ? ` – ${task.endTime}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View className="h-8" />
      </ScrollView>

      <TaskModal
        visible={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditTask(null); }}
        editTask={editTask}
        defaultDate={selectedDate}
        defaultHour={prefillHour}
      />
    </View>
  );
}

function TaskRow({
  task,
  onPress,
  onLongPress,
  onTimerPress,
}: {
  task: Task;
  onPress: () => void;
  onLongPress: () => void;
  onTimerPress: () => void;
}) {
  const color = task.category ? CATEGORY_COLORS[task.category] : '#475569';
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      className="mb-2 flex-row items-center gap-3 rounded-xl bg-slate-800 p-3"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <View
        className="h-5 w-5 rounded-full border-2 items-center justify-center"
        style={{
          borderColor: task.status === 'done' ? '#22c55e' : task.status === 'in-progress' ? '#f59e0b' : '#475569',
          backgroundColor: task.status === 'done' ? '#22c55e' : 'transparent',
        }}
      >
        {task.status === 'done' && <Text className="text-xs text-white">✓</Text>}
        {task.status === 'in-progress' && <View className="h-2 w-2 rounded-full bg-amber-400" />}
      </View>
      <View className="flex-1">
        <Text
          className="text-sm font-medium text-white"
          style={{ textDecorationLine: task.status === 'done' ? 'line-through' : 'none' }}
        >
          {task.title}
        </Text>
        {task.estimatedMinutes && (
          <Text className="text-xs text-slate-500">{task.estimatedMinutes}m estimated</Text>
        )}
      </View>
      <TouchableOpacity onPress={onTimerPress} className="p-1">
        <Timer size={16} color="#64748b" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
