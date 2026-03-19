import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { Crown, Check, X, ChevronLeft } from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { callCreateRazorpaySubscription, callVerifyRazorpayPayment } from '@/lib/firebase';

const FREE_FEATURES = [
  'Day & Week planners',
  'Unlimited tasks',
  'Up to 3 habits',
  '5 AI calls per day',
  'Basic dashboard',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Monthly & Yearly views',
  'Unlimited habits',
  'Habit streaks & insights',
  'Unlimited AI scheduling',
  'Google Calendar sync',
  'Smart time-block suggestions',
  'Priority support',
];

export default function UpgradeScreen() {
  const { user } = usePlannerStore();
  const [loading, setLoading] = useState(false);
  const isPro = user?.subscription.plan === 'pro';

  async function handleSubscribe() {
    if (!user) return;
    setLoading(true);
    try {
      const { subscriptionId, keyId } = await callCreateRazorpaySubscription();

      // Note: react-native-razorpay must be installed for native checkout
      // For now show the subscription ID and guide user
      Alert.alert(
        'Subscription Created',
        `Subscription ID: ${subscriptionId}\n\nOpen the Razorpay link to complete payment. Integration with native Razorpay SDK requires adding react-native-razorpay package.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to start subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-row items-center gap-2 border-b border-slate-800 px-4 py-4">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ChevronLeft size={22} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Upgrade to Pro</Text>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="mt-6 items-center">
          <View className="mb-3 h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20">
            <Crown size={32} color="#f59e0b" />
          </View>
          <Text className="text-2xl font-bold text-white">Vibe Planner Pro</Text>
          <Text className="mt-2 text-center text-slate-400">
            Unlock your full productivity potential
          </Text>
        </View>

        {/* Pricing */}
        <View className="mt-6 flex-row gap-3">
          {/* Free card */}
          <View className="flex-1 rounded-2xl bg-slate-800 p-4">
            <Text className="text-lg font-bold text-white">Free</Text>
            <Text className="mt-1 text-2xl font-bold text-white">₹0</Text>
            <Text className="mb-3 text-xs text-slate-500">forever</Text>
            {FREE_FEATURES.map((f) => (
              <View key={f} className="mb-2 flex-row items-start gap-2">
                <Check size={14} color="#22c55e" style={{ marginTop: 2 }} />
                <Text className="flex-1 text-xs text-slate-400">{f}</Text>
              </View>
            ))}
          </View>

          {/* Pro card */}
          <View
            className="flex-1 rounded-2xl p-4"
            style={{
              backgroundColor: '#1e3a5f',
              borderWidth: 1.5,
              borderColor: '#0ea5e9',
            }}
          >
            <View className="flex-row items-center gap-1 mb-1">
              <Text className="text-lg font-bold text-white">Pro</Text>
              <Crown size={14} color="#f59e0b" />
            </View>
            <Text className="text-2xl font-bold text-white">₹415</Text>
            <Text className="mb-3 text-xs text-sky-400">per month</Text>
            {PRO_FEATURES.map((f) => (
              <View key={f} className="mb-2 flex-row items-start gap-2">
                <Check size={14} color="#0ea5e9" style={{ marginTop: 2 }} />
                <Text className="flex-1 text-xs text-slate-200">{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View className="mt-6">
          {isPro ? (
            <View className="rounded-2xl bg-emerald-900/30 p-4 items-center">
              <Text className="text-emerald-400 font-semibold">You're on Pro ✓</Text>
              <Text className="text-xs text-slate-400 mt-1">
                {user?.subscription.cancelAtPeriodEnd
                  ? 'Your subscription will not renew.'
                  : 'Subscription active'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleSubscribe}
              disabled={loading}
              className="rounded-2xl bg-sky-500 py-4 items-center"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-lg font-bold text-white">Upgrade · ₹415/month</Text>
              )}
            </TouchableOpacity>
          )}
          <Text className="mt-3 text-center text-xs text-slate-500">
            Cancel anytime · Secure payment via Razorpay
          </Text>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
