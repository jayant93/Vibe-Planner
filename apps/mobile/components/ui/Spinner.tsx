import { ActivityIndicator, View } from 'react-native';

export function Spinner({ size = 'large', color = '#0ea5e9' }: { size?: 'small' | 'large'; color?: string }) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}
