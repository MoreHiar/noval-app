import { Stack } from 'expo-router';
import { LibraryProvider } from '../state/library';
import { theme } from '../components/theme';
import { SourceBrowser } from '../components/SourceBrowser';

export default function RootLayout() {
  return (
    <LibraryProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.ink, headerShadowVisible: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="source/edit" options={{ title: '书源信息' }} />
        <Stack.Screen name="source/import" options={{ title: '导入书源' }} />
        <Stack.Screen name="book/[sourceId]/[bookId]" options={{ title: '书籍详情' }} />
        <Stack.Screen name="reader/[sourceId]/[bookId]/[chapterId]" options={{ title: '阅读', gestureEnabled: false, animation: 'none' }} />
      </Stack>
      <SourceBrowser />
    </LibraryProvider>
  );
}
