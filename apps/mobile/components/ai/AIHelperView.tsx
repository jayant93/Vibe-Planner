import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Sparkles, Plus, ChevronDown, ChevronUp } from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { callAIHelper } from '@/lib/firebase';
import { CATEGORY_COLORS } from '@/lib/utils';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LifeCategory, Task } from '@/lib/types';

interface AISuggestedTask {
  title: string;
  description?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes?: number;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  recurrence?: Task['recurrence'];
  category?: LifeCategory;
}

export function AIHelperView() {
  const { user } = usePlannerStore();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<AISuggestedTask[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addedCount, setAddedCount] = useState(0);
  const [adding, setAdding] = useState(false);

  async function generate() {
    if (!text.trim() || !user) return;
    setLoading(true);
    setTasks([]);
    setSelected(new Set());
    setAddedCount(0);
    try {
      const today = new Date().toLocaleDateString('sv');
      const result = await callAIHelper(text, today);
      const aiTasks = (result.tasks ?? []) as AISuggestedTask[];
      setTasks(aiTasks);
      setSelected(new Set(aiTasks.map((_, i) => i)));
    } catch (e) {
      Alert.alert('Error', 'AI helper failed. Make sure the web app API is reachable.');
    } finally {
      setLoading(false);
    }
  }

  async function addSelected() {
    if (!user || selected.size === 0) return;
    setAdding(true);
    try {
      const selectedTasks = tasks.filter((_, i) => selected.has(i));
      await Promise.all(
        selectedTasks.map((t) =>
          addDoc(collection(db, 'users', user.uid, 'tasks'), {
            userId: user.uid,
            title: t.title,
            description: t.description ?? '',
            priority: t.priority ?? 3,
            status: 'todo',
            dueDate: t.dueDate,
            startTime: t.startTime,
            endTime: t.endTime,
            recurrence: t.recurrence ?? 'none',
            category: t.category,
            estimatedMinutes: t.estimatedMinutes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      );
      setAddedCount((prev) => prev + selected.size);
      setTasks((prev) => prev.filter((_, i) => !selected.has(i)));
      setSelected(new Set());
    } catch (e) {
      Alert.alert('Error', 'Failed to add tasks');
    } finally {
      setAdding(false);
    }
  }

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="border-b border-slate-800 px-4 py-4">
          <View className="flex-row items-center gap-2">
            <Sparkles size={20} color="#0ea5e9" />
            <Text className="text-xl font-bold text-white">AI Task Helper</Text>
          </View>
          <Text className="mt-1 text-sm text-slate-400">
            Describe your plans and AI will create structured tasks for you.
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Input */}
          <View className="mt-4 rounded-2xl bg-slate-800 p-4">
            <TextInput
              className="min-h-[100px] text-white"
              placeholder="e.g. I need to prepare for a client presentation on Thursday, exercise 3x this week, and learn React Native over the weekend..."
              placeholderTextColor="#64748b"
              multiline
              textAlignVertical="top"
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity
              onPress={generate}
              disabled={loading || !text.trim()}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-sky-500 py-3"
              style={{ opacity: loading || !text.trim() ? 0.5 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Sparkles size={16} color="#fff" />
              )}
              <Text className="font-semibold text-white">
                {loading ? 'Generating...' : 'Generate Tasks'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          {addedCount > 0 && (
            <View className="mt-3 rounded-xl bg-emerald-900/30 px-4 py-2">
              <Text className="text-sm text-emerald-400">✓ {addedCount} tasks added to planner</Text>
            </View>
          )}

          {/* Task cards */}
          {tasks.length > 0 && (
            <View className="mt-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="font-semibold text-slate-300">
                  {tasks.length} tasks generated · {selected.size} selected
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setSelected(
                      selected.size === tasks.length
                        ? new Set()
                        : new Set(tasks.map((_, i) => i))
                    )
                  }
                >
                  <Text className="text-sm text-sky-400">
                    {selected.size === tasks.length ? 'Deselect all' : 'Select all'}
                  </Text>
                </TouchableOpacity>
              </View>

              {tasks.map((task, idx) => {
                const isSelected = selected.has(idx);
                const isExpanded = expanded.has(idx);
                const color = task.category ? CATEGORY_COLORS[task.category] : '#475569';
                return (
                  <View
                    key={idx}
                    className="mb-2 rounded-2xl bg-slate-800 overflow-hidden"
                    style={{ borderLeftWidth: 3, borderLeftColor: color }}
                  >
                    <TouchableOpacity
                      onPress={() => toggleSelect(idx)}
                      className="flex-row items-center gap-3 p-4"
                    >
                      <View
                        className="h-5 w-5 rounded border-2 items-center justify-center"
                        style={{
                          borderColor: isSelected ? '#0ea5e9' : '#475569',
                          backgroundColor: isSelected ? '#0ea5e9' : 'transparent',
                        }}
                      >
                        {isSelected && <Text className="text-xs text-white">✓</Text>}
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-white">{task.title}</Text>
                        <View className="mt-1 flex-row flex-wrap gap-2">
                          {task.category && (
                            <Text className="text-xs capitalize text-slate-400">
                              {task.category}
                            </Text>
                          )}
                          {task.dueDate && (
                            <Text className="text-xs text-slate-500">{task.dueDate}</Text>
                          )}
                          {task.estimatedMinutes && (
                            <Text className="text-xs text-slate-500">
                              {task.estimatedMinutes}min
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => toggleExpand(idx)}>
                        {isExpanded ? (
                          <ChevronUp size={16} color="#64748b" />
                        ) : (
                          <ChevronDown size={16} color="#64748b" />
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>

                    {isExpanded && task.description && (
                      <View className="border-t border-slate-700 px-4 pb-4 pt-2">
                        <Text className="text-sm text-slate-400">{task.description}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View className="h-24" />
        </ScrollView>

        {/* Add button */}
        {tasks.length > 0 && selected.size > 0 && (
          <View className="border-t border-slate-800 px-4 py-4">
            <TouchableOpacity
              onPress={addSelected}
              disabled={adding}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-sky-500 py-4"
              style={{ opacity: adding ? 0.6 : 1 }}
            >
              {adding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Plus size={18} color="#fff" />
              )}
              <Text className="font-semibold text-white">
                {adding ? 'Adding...' : `Add ${selected.size} task${selected.size > 1 ? 's' : ''} to planner`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
