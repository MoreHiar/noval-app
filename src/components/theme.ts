import { useMemo } from 'react';
import { useAppTheme } from '../state/appearance';
import type { AppTheme } from './palette';

export { lightTheme, darkTheme, type AppTheme } from './palette';

// Each screen keeps its layout while colors follow the shared appearance state.
export function useThemedStyles<T>(createStyles: (theme: AppTheme) => T): T {
  const { theme } = useAppTheme();
  return useMemo(() => createStyles(theme), [createStyles, theme]);
}
