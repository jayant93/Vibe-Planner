import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { db } from '@/lib/firebase';
import {
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { CATEGORY_COLORS } from '@/lib/utils';
import type { Task, LifeCategory } from '@/lib/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  editTask: Task | null;
  defaultDate?: string;
  defaultHour?: number | null;
}

const CATEGORIES: { key: LifeCategory; label: string; emoji: string }[] = [
  { key: 'mind', label: 'Mind', emoji: '🧠' },
  { key: 'body', label: 'Body', emoji: '💪' },
  { key: 'soul', label: 'Soul', emoji: '✨' },
  { key: 'work', label: 'Work', emoji: '💼' },
];

const PRIORITIES: { value: 1 | 2 | 3 | 4 | 5; label: string; color: string }[] = [
  { value: 1, label: 'Low', color: '#22c55e' },
  { value: 2, label: 'Low-Med', color: '#84cc16' },
  { value: 3, label: 'Medium', color: '#f59e0b' },
  { value: 4, label: 'High', color: '#f97316' },
  { value: 5, label: 'Critical', color: '#ef4444' },
];

const RECURRENCE_OPTIONS: Task['recurrence'][] = [
  'none', 'daily', 'alternate', 'weekly', 'monthly', 'yearly',
];

export function TaskModal({ visible, onClose, editTask, defaultDate, defaultHour }: Props) {
  const { user } = usePlannerStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LifeCategory | undefined>();
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurrence, setRecurrence] = useState<Task['recurrence']>('none');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description ?? '');
      setCategory(editTask.category);
      setPriority(editTask.priority);
      setDueDate(editTask.dueDate ?? '');
      setStartTime(editTask.startTime ?? '');
      setEndTime(editTask.endTime ?? '');
      setRecurrence(editTask.recurrence);
      setEstimatedMinutes(String(editTask.estimatedMinutes ?? ''));
    } else {
      setTitle('');
      setDescription('');
      setCategory(undefined);
      setPriority(3);
      setDueDate(defaultDate ?? '');
      setStartTime(defaultHour != null ? `${defaultHour.toString().padStart(2, '0')}:00` : '');
      setEndTime(defaultHour != null ? `${(defaultHour + 1).toString().padStart(2, '0')}:00` : '');
      setRecurrence('none');
      setEstimatedMinutes('');
    }
  }, [editTask, visible, defaultDate, defaultHour]);

  async function save() {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const data = {
        userId: user.uid,
        title: title.trim(),
        description: description || undefined,
        category,
        priority,
        dueDate: dueDate || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        recurrence,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        updatedAt: serverTimestamp(),
      };

      if (editTask) {
        await updateDoc(doc(db, 'users', user.uid, 'tasks', editTask.id), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'tasks'), {
          ...data,
          status: 'todo',
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save task');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !editTask) return;
    Alert.alert('Delete task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'users', user.uid, 'tasks', editTask.id));
          onClose();
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-slate-900"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-slate-800 px-4 py-4">
          <Text className="text-lg font-bold text-white">
            {editTask ? 'Edit Task' : 'New Task'}
          </Text>
          <View className="flex-row items-center gap-3">
            {editTask && (
              <TouchableOpacity onPress={handleDelete}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {/* Title */}
          <TextInput
            className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-lg text-white"
            placeholder="Task title *"
            placeholderTextColor="#64748b"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <TextInput
            className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-white"
            placeholder="Description (optional)"
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={2}
            value={description}
            onChangeText={setDescription}
          />

          {/* Category */}
          <Text className="mb-2 text-sm text-slate-400">Category</Text>
          <View className="mb-4 flex-row gap-2">
            <TouchableOpacity
              onPress={() => setCategory(undefined)}
              className="flex-1 items-center rounded-xl py-2"
              style={{
                backgroundColor: !category ? '#1e3a5f' : '#1e293b',
                borderWidth: !category ? 1.5 : 0,
                borderColor: '#0ea5e9',
              }}
            >
              <Text className="text-xs text-white">None</Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                className="flex-1 items-center rounded-xl py-2"
                style={{
                  backgroundColor: category === cat.key ? CATEGORY_COLORS[cat.key] + '33' : '#1e293b',
                  borderWidth: category === cat.key ? 1.5 : 0,
                  borderColor: CATEGORY_COLORS[cat.key],
                }}
              >
                <Text>{cat.emoji}</Text>
                <Text className="text-xs text-white">{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority */}
          <Text className="mb-2 text-sm text-slate-400">Priority</Text>
          <View className="mb-4 flex-row gap-1">
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.value}
                onPress={() => setPriority(p.value)}
                className="flex-1 items-center rounded-lg py-2"
                style={{
                  backgroundColor: priority === p.value ? p.color + '33' : '#1e293b',
                  borderWidth: priority === p.value ? 1.5 : 0,
                  borderColor: p.color,
                }}
              >
                <Text className="text-xs" style={{ color: p.color }}>{p.value}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date & Time */}
          <View className="mb-4 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 text-sm text-slate-400">Due date</Text>
              <TextInput
                className="rounded-xl bg-slate-800 px-3 py-3 text-white"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-sm text-slate-400">Est. minutes</Text>
              <TextInput
                className="rounded-xl bg-slate-800 px-3 py-3 text-white"
                placeholder="e.g. 45"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={estimatedMinutes}
                onChangeText={setEstimatedMinutes}
              />
            </View>
          </View>

          <View className="mb-4 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 text-sm text-slate-400">Start time</Text>
              <TextInput
                className="rounded-xl bg-slate-800 px-3 py-3 text-white"
                placeholder="HH:MM"
                placeholderTextColor="#64748b"
                value={startTime}
                onChangeText={setStartTime}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-sm text-slate-400">End time</Text>
              <TextInput
                className="rounded-xl bg-slate-800 px-3 py-3 text-white"
                placeholder="HH:MM"
                placeholderTextColor="#64748b"
                value={endTime}
                onChangeText={setEndTime}
              />
            </View>
          </View>

          {/* Recurrence */}
          <Text className="mb-2 text-sm text-slate-400">Recurrence</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            <View className="flex-row gap-2">
              {RECURRENCE_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRecurrence(r)}
                  className="rounded-xl px-4 py-2"
                  style={{
                    backgroundColor: recurrence === r ? '#0ea5e933' : '#1e293b',
                    borderWidth: recurrence === r ? 1.5 : 0,
                    borderColor: '#0ea5e9',
                  }}
                >
                  <Text className="capitalize text-white text-sm">{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </ScrollView>

        {/* Save button */}
        <View className="border-t border-slate-800 px-4 py-4">
          <TouchableOpacity
            onPress={save}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-sky-500 py-4 items-center"
            style={{ opacity: saving || !title.trim() ? 0.5 : 1 }}
          >
            <Text className="font-semibold text-white">
              {saving ? 'Saving...' : editTask ? 'Save changes' : 'Create task'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
