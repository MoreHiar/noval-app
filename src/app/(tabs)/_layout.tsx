import { Tabs } from 'expo-router';
import { GlassTabBar } from '../../components/GlassTabBar';

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '书架' }} />
      <Tabs.Screen name="novels" options={{ title: '小说' }} />
      <Tabs.Screen name="comics" options={{ title: '漫画' }} />
      <Tabs.Screen name="profile" options={{ title: '我的' }} />
    </Tabs>
  );
}
