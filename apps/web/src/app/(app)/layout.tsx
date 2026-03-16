'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onSnapshot } from 'firebase/firestore';
import { usePlannerStore } from '@/lib/store';
import { tasksRef, habitsRef } from '@/lib/firebase';
import { AppShell } from '@/components/ui/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { ThemeApplier } from '@/components/ui/ThemeApplier';
import type { Task, Habit } from 'shared/types';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, authLoading, setTasks, setHabits } = usePlannerStore((s) => ({
    user: s.user,
    authLoading: s.authLoading,
    setTasks: s.setTasks,
    setHabits: s.setHabits,
  }));
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Subscribe to tasks + habits in realtime
  useEffect(() => {
    if (!user) return;

    const unsubTasks = onSnapshot(tasksRef(user.uid), (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      setTasks(tasks);
    });

    const unsubHabits = onSnapshot(habitsRef(user.uid), (snap) => {
      const habits = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Habit));
      setHabits(habits);
    });

    return () => {
      unsubTasks();
      unsubHabits();
    };
  }, [user, setTasks, setHabits]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <ThemeApplier />
      <AppShell>{children}</AppShell>
    </>
  );
}
