import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { UserProfile, Task, Habit, Subscription } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveTimer {
  taskId: string;
  taskTitle: string;
  startedAt: number;
  category?: string;
}

interface PlannerState {
  user: UserProfile | null;
  authLoading: boolean;
  tasks: Task[];
  habits: Habit[];
  selectedDate: string;
  plannerView: 'day' | 'week' | 'month' | 'year';
  activeTimer: ActiveTimer | null;

  subscription: () => Subscription;
  isPro: () => boolean;
  todaysTasks: () => Task[];

  setUser: (user: UserProfile | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setTasks: (tasks: Task[]) => void;
  setHabits: (habits: Habit[]) => void;
  setSelectedDate: (date: string) => void;
  setPlannerView: (view: PlannerState['plannerView']) => void;
  upsertTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
  upsertHabit: (habit: Habit) => void;
  removeHabit: (habitId: string) => void;
  startTimer: (timer: ActiveTimer) => void;
  stopTimer: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const today = new Date().toLocaleDateString('sv');

export const usePlannerStore = create<PlannerState>()(
  subscribeWithSelector((set, get) => ({
    user: null,
    authLoading: true,
    tasks: [],
    habits: [],
    selectedDate: today,
    plannerView: 'day',
    activeTimer: null,

    subscription: () => get().user?.subscription ?? { plan: 'free' },
    isPro: () => get().user?.subscription.plan === 'pro',
    todaysTasks: () => {
      const { tasks, selectedDate } = get();
      return tasks.filter((t) => t.dueDate === selectedDate || t.startTime !== undefined);
    },

    setUser: (user) => set({ user }),
    setAuthLoading: (authLoading) => set({ authLoading }),
    setTasks: (tasks) => set({ tasks }),
    setHabits: (habits) => set({ habits }),
    setSelectedDate: (selectedDate) => set({ selectedDate }),
    setPlannerView: (plannerView) => set({ plannerView }),

    upsertTask: (task) =>
      set((state) => {
        const idx = state.tasks.findIndex((t) => t.id === task.id);
        if (idx === -1) return { tasks: [...state.tasks, task] };
        const next = [...state.tasks];
        next[idx] = task;
        return { tasks: next };
      }),

    removeTask: (taskId) =>
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) })),

    upsertHabit: (habit) =>
      set((state) => {
        const idx = state.habits.findIndex((h) => h.id === habit.id);
        if (idx === -1) return { habits: [...state.habits, habit] };
        const next = [...state.habits];
        next[idx] = habit;
        return { habits: next };
      }),

    removeHabit: (habitId) =>
      set((state) => ({ habits: state.habits.filter((h) => h.id !== habitId) })),

    startTimer: (timer) => set({ activeTimer: timer }),
    stopTimer: () => set({ activeTimer: null }),
  }))
);
