import { Tabs } from 'expo-router';
import { GlassTabBar } from '../../components/GlassTabBar';

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="discover" options={{ title: '发现' }} />
      <Tabs.Screen name="index" options={{ title: '书架' }} />
      <Tabs.Screen name="sources" options={{ title: '书源' }} />
      <Tabs.Screen name="profile" options={{ title: '我的' }} />
    </Tabs>
  );
}
