import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import type { Habit } from 'shared/types';

/**
 * Runs daily at midnight UTC.
 * For each Pro user, recalculates habit streaks based on completion history.
 */
export const updateHabitStreaks = onSchedule(
  {
    schedule: 'every day 00:00',
    timeZone: 'UTC',
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);

    // Only process Pro users (free users don't have streaks)
    const proUsersSnap = await db
      .collection('users')
      .where('subscription.plan', '==', 'pro')
      .get();

    const batchPromises = proUsersSnap.docs.map(async (userDoc) => {
      const uid = userDoc.id;
      const habitsSnap = await db.collection(`users/${uid}/habits`).get();

      const updates = habitsSnap.docs.map(async (habitDoc) => {
        const habit = { id: habitDoc.id, ...habitDoc.data() } as Habit;
        const { completions, streak } = habit;

        const completedYesterday = completions.includes(yesterdayISO);
        const newCurrent = completedYesterday ? streak.current + 1 : 0;
        const newLongest = Math.max(streak.longest, newCurrent);

        if (newCurrent !== streak.current || newLongest !== streak.longest) {
          await habitDoc.ref.update({
            'streak.current': newCurrent,
            'streak.longest': newLongest,
            'streak.lastCompleted': completedYesterday ? yesterdayISO : streak.lastCompleted,
          });
        }
      });

      await Promise.all(updates);
    });

    await Promise.all(batchPromises);
    console.log(`[Streaks] Updated streaks for ${proUsersSnap.size} Pro users`);
  }
);
