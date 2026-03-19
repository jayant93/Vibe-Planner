import { View, Text, TouchableOpacity } from 'react-native';
import { Lock, Crown } from 'lucide-react-native';
import { router } from 'expo-router';

interface Props {
  feature: string;
  reason: string;
}

export function ProGate({ feature, reason }: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-950 px-8">
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/20">
        <Lock size={36} color="#f59e0b" />
      </View>
      <Text className="mb-2 text-xl font-bold text-white">{feature}</Text>
      <Text className="mb-8 text-center text-slate-400">{reason}</Text>
      <TouchableOpacity
        onPress={() => router.push('/(app)/upgrade')}
        className="w-full flex-row items-center justify-center gap-2 rounded-2xl bg-sky-500 py-4"
      >
        <Crown size={18} color="#fff" />
        <Text className="font-bold text-white">Upgrade to Pro</Text>
      </TouchableOpacity>
      <Text className="mt-3 text-xs text-slate-600">₹415/month · Cancel anytime</Text>
    </View>
  );
}
