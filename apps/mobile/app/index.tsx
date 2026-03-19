import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { usePlannerStore } from '@/lib/store';

export default function Index() {
  const { user, authLoading } = usePlannerStore();

  if (authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(app)/dashboard" />;
}
