'use client';

import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, userRef } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import type { UserProfile } from 'shared/types';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setUser = usePlannerStore((s) => s.setUser);
  const setAuthLoading = usePlannerStore((s) => s.setAuthLoading);
  // Ref to Firestore listener so it can be cleaned up when auth changes
  const unsubDocRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous Firestore listener on every auth change
      unsubDocRef.current?.();
      unsubDocRef.current = null;

      if (!firebaseUser) {
        setUser(null);
        setAuthLoading(false);
        document.cookie = 'auth-token=; Max-Age=0; path=/';
        document.cookie = 'user-plan=; Max-Age=0; path=/';
        return;
      }

      // Set auth cookie for middleware
      // SameSite=Lax (not Strict) so the cookie is sent when Google OAuth redirects back
      void firebaseUser.getIdToken().then((token) => {
        document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Lax`;
      });

      // Subscribe to user profile in Firestore
      unsubDocRef.current = onSnapshot(userRef(firebaseUser.uid), async (snap) => {
        if (!snap.exists()) {
          // First sign-in: create user doc
          const newProfile: Omit<UserProfile, 'createdAt'> & {
            createdAt: ReturnType<typeof serverTimestamp>;
          } = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? '',
            ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            subscription: { plan: 'free' },
            gcalLinked: false,
            preferences: {
              workStartTime: '09:00',
              workEndTime: '18:00',
              theme: 'system',
              weekStartsOn: 1,
            },
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef(firebaseUser.uid), newProfile, { merge: true });
          return;
        }

        const data = snap.data() as UserProfile;
        setUser(data);
        setAuthLoading(false);

        const plan = data.subscription?.plan ?? 'free';
        document.cookie = `user-plan=${plan}; path=/; max-age=3600; SameSite=Lax`;
      });
    });

    return () => {
      unsubAuth();
      unsubDocRef.current?.();
    };
  }, [setUser, setAuthLoading]);

  return <>{children}</>;
}
