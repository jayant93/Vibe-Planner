import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('No ID token returned');

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const { uid, email, displayName, photoURL } = userCredential.user;

      // Create user doc if first sign-in
      const userDocRef = doc(db, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const newUser: Omit<UserProfile, 'createdAt'> & { createdAt: unknown } = {
          uid,
          email: email ?? '',
          displayName: displayName ?? 'Planner User',
          photoURL: photoURL ?? undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          subscription: { plan: 'free' },
          gcalLinked: false,
          preferences: {
            workStartTime: '09:00',
            workEndTime: '18:00',
            theme: 'system',
            weekStartsOn: 1,
            accentColor: 'blue',
          },
          createdAt: serverTimestamp(),
        };
        await setDoc(userDocRef, newUser);
      }

      router.replace('/(app)/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      Alert.alert('Sign-in failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo / Brand */}
        <View className="mb-12 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-sky-500">
            <Text className="text-4xl">✨</Text>
          </View>
          <Text className="text-3xl font-bold text-white">Vibe Planner</Text>
          <Text className="mt-2 text-center text-slate-400">
            AI-powered daily, weekly & monthly planner
          </Text>
        </View>

        {/* Feature highlights */}
        <View className="mb-12 w-full gap-3">
          {[
            { icon: '📅', label: 'Day, Week & Month planners' },
            { icon: '🤖', label: 'AI task scheduling & optimization' },
            { icon: '🔄', label: 'Google Calendar sync' },
            { icon: '🏃', label: 'Habit tracking with streaks' },
          ].map((f) => (
            <View key={f.label} className="flex-row items-center gap-3">
              <Text className="text-xl">{f.icon}</Text>
              <Text className="text-slate-300">{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Sign-in button */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex-row items-center justify-center gap-3 rounded-2xl bg-white py-4"
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#1e293b" />
          ) : (
            <>
              <Text className="text-xl">G</Text>
              <Text className="text-base font-semibold text-slate-800">
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text className="mt-6 text-center text-xs text-slate-500">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
