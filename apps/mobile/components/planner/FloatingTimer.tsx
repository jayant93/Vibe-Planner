import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { Timer, Square } from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { db, timeLogsRef } from '@/lib/firebase';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { formatElapsed } from '@/lib/utils';
import type { LifeCategory } from '@/lib/types';

export function FloatingTimer() {
  const { activeTimer, stopTimer, user } = usePlannerStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - activeTimer.startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  async function handleStop() {
    if (!activeTimer || !user) return;
    const minutes = Math.round(elapsed / 60000);

    if (minutes > 0 && activeTimer.category) {
      try {
        await addDoc(timeLogsRef(user.uid), {
          userId: user.uid,
          date: new Date().toLocaleDateString('sv'),
          category: activeTimer.category as LifeCategory,
          minutes,
          note: `Timer: ${activeTimer.taskTitle}`,
          createdAt: serverTimestamp(),
        });
      } catch {}
    }

    stopTimer();
    setElapsed(0);
  }

  if (!activeTimer) return null;

  return (
    <View
      className="absolute bottom-20 right-4 flex-row items-center gap-2 rounded-2xl bg-slate-800 px-4 py-3"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Timer size={16} color="#0ea5e9" />
      <View>
        <Text className="text-xs text-slate-400" numberOfLines={1} style={{ maxWidth: 120 }}>
          {activeTimer.taskTitle}
        </Text>
        <Text className="font-mono text-base font-bold text-white">
          {formatElapsed(elapsed)}
        </Text>
      </View>
      <TouchableOpacity onPress={handleStop} className="ml-2 rounded-lg bg-red-500/20 p-2">
        <Square size={14} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}
