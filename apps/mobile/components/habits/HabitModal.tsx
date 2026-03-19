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
import { X } from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { db } from '@/lib/firebase';
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { Habit } from '@/lib/types';

const COLORS = ['#0ea5e9', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#f97316', '#ec4899', '#14b8a6'];

interface Props {
  visible: boolean;
  onClose: () => void;
  editHabit: Habit | null;
}

export function HabitModal({ visible, onClose, editHabit }: Props) {
  const { user } = usePlannerStore();

  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [color, setColor] = useState('#0ea5e9');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editHabit) {
      setTitle(editHabit.title);
      setFrequency(editHabit.targetFrequency);
      setStartTime(editHabit.startTime ?? '');
      setDuration(String(editHabit.duration ?? 30));
      setColor(editHabit.color ?? '#0ea5e9');
    } else {
      setTitle('');
      setFrequency('daily');
      setStartTime('');
      setDuration('30');
      setColor('#0ea5e9');
    }
  }, [editHabit, visible]);

  async function save() {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const data = {
        userId: user.uid,
        title: title.trim(),
        targetFrequency: frequency,
        startTime: startTime || undefined,
        duration: Number(duration) || 30,
        color,
      };

      if (editHabit) {
        await updateDoc(doc(db, 'users', user.uid, 'habits', editHabit.id), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'habits'), {
          ...data,
          completions: [],
          streak: { current: 0, longest: 0 },
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save habit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-slate-900"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between border-b border-slate-800 px-4 py-4">
          <Text className="text-lg font-bold text-white">
            {editHabit ? 'Edit Habit' : 'New Habit'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {/* Title */}
          <Text className="mb-1 text-sm text-slate-400">Habit name *</Text>
          <TextInput
            className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-white"
            placeholder="e.g. Morning run"
            placeholderTextColor="#64748b"
            value={title}
            onChangeText={setTitle}
          />

          {/* Frequency */}
          <Text className="mb-2 text-sm text-slate-400">Frequency</Text>
          <View className="mb-4 flex-row gap-2">
            {(['daily', 'weekly'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFrequency(f)}
                className="flex-1 items-center rounded-xl py-3"
                style={{
                  backgroundColor: frequency === f ? '#0ea5e933' : '#1e293b',
                  borderWidth: 1.5,
                  borderColor: frequency === f ? '#0ea5e9' : 'transparent',
                }}
              >
                <Text className="capitalize text-white">{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time */}
          <Text className="mb-1 text-sm text-slate-400">Start time (optional)</Text>
          <TextInput
            className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-white"
            placeholder="HH:MM e.g. 07:00"
            placeholderTextColor="#64748b"
            value={startTime}
            onChangeText={setStartTime}
          />

          {/* Duration */}
          <Text className="mb-1 text-sm text-slate-400">Duration (minutes)</Text>
          <TextInput
            className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-white"
            placeholder="30"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
          />

          {/* Color picker */}
          <Text className="mb-2 text-sm text-slate-400">Color</Text>
          <View className="mb-6 flex-row flex-wrap gap-3">
            {COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                className="h-9 w-9 rounded-full items-center justify-center"
                style={{
                  backgroundColor: c,
                  borderWidth: color === c ? 3 : 0,
                  borderColor: '#fff',
                }}
              />
            ))}
          </View>
        </ScrollView>

        <View className="border-t border-slate-800 px-4 py-4">
          <TouchableOpacity
            onPress={save}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-sky-500 py-4 items-center"
            style={{ opacity: saving || !title.trim() ? 0.5 : 1 }}
          >
            <Text className="font-semibold text-white">
              {saving ? 'Saving...' : editHabit ? 'Save changes' : 'Create habit'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
