import { Tabs, Redirect } from 'expo-router';
import { View, Text } from 'react-native';
import {
  LayoutDashboard,
  CalendarDays,
  Activity,
  Sparkles,
  Settings,
} from 'lucide-react-native';
import { usePlannerStore } from '@/lib/store';
import { FloatingTimer } from '@/components/planner/FloatingTimer';

function TabBarIcon({
  icon: Icon,
  color,
  size,
}: {
  icon: React.ElementType;
  color: string;
  size: number;
}) {
  return <Icon size={size} color={color} />;
}

export default function AppLayout() {
  const { user, authLoading, activeTimer } = usePlannerStore();

  if (!authLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1e293b',
            borderTopColor: '#334155',
            borderTopWidth: 1,
            paddingBottom: 4,
            paddingTop: 4,
            height: 60,
          },
          tabBarActiveTintColor: '#0ea5e9',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon icon={LayoutDashboard} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: 'Planner',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon icon={CalendarDays} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: 'Habits',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon icon={Activity} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai-helper"
          options={{
            title: 'AI',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon icon={Sparkles} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon icon={Settings} color={color} size={size} />
            ),
          }}
        />
        {/* Hidden screens */}
        <Tabs.Screen name="upgrade" options={{ href: null }} />
      </Tabs>

      {activeTimer && <FloatingTimer />}
    </View>
  );
}
