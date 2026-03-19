import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  onSnapshot,
  collection,
  doc,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import type { UserProfile, Task, Habit } from '@/lib/types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthLoading, setTasks, setHabits } = usePlannerStore();
  const unsubTasksRef = useRef<(() => void) | null>(null);
  const unsubHabitsRef = useRef<(() => void) | null>(null);
  const unsubUserRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        unsubTasksRef.current?.();
        unsubHabitsRef.current?.();
        unsubUserRef.current?.();
        setUser(null);
        setTasks([]);
        setHabits([]);
        setAuthLoading(false);
        return;
      }

      const uid = firebaseUser.uid;

      // Subscribe to user profile
      unsubUserRef.current = onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) {
          setUser({ uid: snap.id, ...snap.data() } as UserProfile);
        }
        setAuthLoading(false);
      });

      // Subscribe to tasks
      unsubTasksRef.current = onSnapshot(
        query(collection(db, 'users', uid, 'tasks'), orderBy('createdAt', 'desc')),
        (snap) => {
          const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[];
          setTasks(tasks);
        }
      );

      // Subscribe to habits
      unsubHabitsRef.current = onSnapshot(
        query(collection(db, 'users', uid, 'habits'), orderBy('createdAt', 'asc')),
        (snap) => {
          const habits = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Habit[];
          setHabits(habits);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubTasksRef.current?.();
      unsubHabitsRef.current?.();
      unsubUserRef.current?.();
    };
  }, []);

  return <>{children}</>;
}
