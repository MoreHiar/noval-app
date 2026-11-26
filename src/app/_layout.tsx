import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LibraryProvider } from '../state/library';
import { AppearanceProvider, useAppTheme } from '../state/appearance';
import { SourceBrowser } from '../components/SourceBrowser';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <AppNavigation />
    </AppearanceProvider>
  );
}

function AppNavigation() {
  const { theme, colorScheme, ready } = useAppTheme();
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, primary: theme.accent, background: theme.background, card: theme.paper, text: theme.ink, border: theme.line } }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <LibraryProvider>
        <Stack screenOptions={{ headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.ink, headerShadowVisible: false, contentStyle: { backgroundColor: theme.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="source/edit" options={{ title: '书源信息' }} />
          <Stack.Screen name="source/import" options={{ title: '导入书源' }} />
          <Stack.Screen name="book/[sourceId]/[bookId]" options={{ title: '书籍详情' }} />
          <Stack.Screen name="reader/[sourceId]/[bookId]/[chapterId]" options={{ headerShown: false, gestureEnabled: false, animation: 'none' }} />
        </Stack>
        <SourceBrowser />
      </LibraryProvider>
    </ThemeProvider>
  );
}
