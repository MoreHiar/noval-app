import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { darkTheme, lightTheme, type AppTheme } from '../components/palette';

export type AppearanceMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'noval.appearance.v1';
type AppearanceState = {
  mode: AppearanceMode;
  colorScheme: 'light' | 'dark';
  theme: AppTheme;
  ready: boolean;
  error: string;
  setMode(mode: AppearanceMode): void;
};
const AppearanceContext = createContext<AppearanceState | null>(null);

export function AppearanceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, updateMode] = useState<AppearanceMode>('system');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (mounted.current && (value === 'system' || value === 'light' || value === 'dark')) updateMode(value);
    }).catch(() => {
      if (mounted.current) setError('外观设置读取失败，暂时跟随系统。');
    }).finally(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (ready && Platform.OS !== 'web') Appearance.setColorScheme(mode === 'system' ? 'auto' : mode);
  }, [mode, ready]);

  const setMode = useCallback((next: AppearanceMode) => {
    updateMode(next);
    const operation = writes.current.then(() => AsyncStorage.setItem(STORAGE_KEY, next));
    writes.current = operation.catch(() => undefined);
    operation.then(() => { if (mounted.current) setError(''); })
      .catch(() => { if (mounted.current) setError('外观已切换，但保存失败，请重新选择以重试。'); });
  }, []);

  const colorScheme = mode === 'system' ? systemScheme === 'dark' ? 'dark' : 'light' : mode;
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colorScheme === 'dark' ? darkTheme.background : lightTheme.background).catch(() => undefined);
    if (Platform.OS === 'web') document.documentElement.style.colorScheme = colorScheme;
  }, [colorScheme]);
  const value = useMemo(() => ({ mode, colorScheme, theme: colorScheme === 'dark' ? darkTheme : lightTheme, ready, error, setMode }), [mode, colorScheme, ready, error, setMode]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppTheme 必须在 AppearanceProvider 中使用');
  return context;
}
