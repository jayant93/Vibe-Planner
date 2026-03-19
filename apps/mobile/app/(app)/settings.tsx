import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { format } from 'date-fns';
import {
  User,
  CreditCard,
  Calendar,
  LogOut,
  ChevronRight,
  Crown,
  ExternalLink,
} from 'lucide-react-native';
import { callCancelRazorpaySubscription } from '@/lib/firebase';

export default function SettingsScreen() {
  const { user, setUser } = usePlannerStore();
  const isPro = user?.subscription.plan === 'pro';

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          setUser(null);
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  async function handleCancelSubscription() {
    Alert.alert(
      'Cancel subscription',
      'Your Pro access will continue until the end of the current period.',
      [
        { text: 'Keep Pro', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await callCancelRazorpaySubscription();
              Alert.alert('Done', 'Subscription cancelled');
            } catch {
              Alert.alert('Error', 'Failed to cancel subscription');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="border-b border-slate-800 px-4 py-4">
        <Text className="text-xl font-bold text-white">Settings</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View className="mx-4 mt-4 rounded-2xl bg-slate-800 p-4">
          <View className="flex-row items-center gap-4">
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-600">
                <User size={32} color="#94a3b8" />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-lg font-semibold text-white">{user?.displayName}</Text>
              <Text className="text-sm text-slate-400">{user?.email}</Text>
              <View className="mt-1 flex-row items-center gap-1">
                {isPro ? (
                  <>
                    <Crown size={12} color="#f59e0b" />
                    <Text className="text-xs text-amber-400 font-medium">Pro</Text>
                  </>
                ) : (
                  <Text className="text-xs text-slate-500">Free plan</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Plan & Billing */}
        <Text className="mx-4 mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Plan & Billing
        </Text>
        <View className="mx-4 rounded-2xl bg-slate-800 overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-4">
            <View className="flex-row items-center gap-3">
              <CreditCard size={18} color="#94a3b8" />
              <View>
                <Text className="text-white font-medium">
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </Text>
                {isPro && user?.subscription.currentPeriodEnd && (
                  <Text className="text-xs text-slate-400">
                    Renews {format(user.subscription.currentPeriodEnd as unknown as Date, 'MMM d, yyyy')}
                  </Text>
                )}
              </View>
            </View>
            {!isPro && (
              <TouchableOpacity
                onPress={() => router.push('/(app)/upgrade')}
                className="rounded-lg bg-sky-500 px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-white">Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>

          {isPro && (
            <TouchableOpacity
              onPress={handleCancelSubscription}
              className="border-t border-slate-700 flex-row items-center justify-between px-4 py-4"
            >
              <Text className="text-sm text-red-400">Cancel subscription</Text>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Google Calendar */}
        <Text className="mx-4 mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Integrations
        </Text>
        <View className="mx-4 rounded-2xl bg-slate-800 overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-4">
            <View className="flex-row items-center gap-3">
              <Calendar size={18} color="#94a3b8" />
              <View>
                <Text className="text-white font-medium">Google Calendar</Text>
                <Text className="text-xs text-slate-400">
                  {user?.gcalLinked ? 'Connected' : 'Not connected · Pro required'}
                </Text>
              </View>
            </View>
            {isPro ? (
              <View className="flex-row items-center gap-1">
                <View
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: user?.gcalLinked ? '#22c55e' : '#64748b' }}
                />
                <Text className="text-xs text-slate-400">
                  {user?.gcalLinked ? 'Linked' : 'Not linked'}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-slate-600">🔒</Text>
              </View>
            )}
          </View>
        </View>

        {/* About */}
        <Text className="mx-4 mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          About
        </Text>
        <View className="mx-4 rounded-2xl bg-slate-800 overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-4">
            <Text className="text-white">Version</Text>
            <Text className="text-slate-400">1.0.0</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          className="mx-4 mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-800 py-4"
        >
          <LogOut size={18} color="#ef4444" />
          <Text className="font-semibold text-red-400">Sign out</Text>
        </TouchableOpacity>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
