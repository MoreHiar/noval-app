export type TurnAnimation = 'slide' | 'fade' | 'none';
export type ReaderPreferences = { fontSize: number; lineSpacing: number; animation: TurnAnimation };

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = { fontSize: 18, lineSpacing: 1.9, animation: 'slide' };
export const LINE_SPACING_OPTIONS = [{ value: 1.5, label: '紧凑' }, { value: 1.9, label: '适中' }, { value: 2.3, label: '宽松' }] as const;
export const TURN_ANIMATION_OPTIONS: { value: TurnAnimation; label: string }[] = [{ value: 'slide', label: '滑动' }, { value: 'fade', label: '淡入淡出' }, { value: 'none', label: '无动画' }];

export function parseReaderPreferences(value: unknown): ReaderPreferences {
  const data = value && typeof value === 'object' ? value as Partial<ReaderPreferences> : {};
  return {
    fontSize: typeof data.fontSize === 'number' && Number.isFinite(data.fontSize) ? Math.min(30, Math.max(14, Math.round(data.fontSize))) : DEFAULT_READER_PREFERENCES.fontSize,
    lineSpacing: LINE_SPACING_OPTIONS.some(option => option.value === data.lineSpacing) ? data.lineSpacing! : DEFAULT_READER_PREFERENCES.lineSpacing,
    animation: TURN_ANIMATION_OPTIONS.some(option => option.value === data.animation) ? data.animation! : DEFAULT_READER_PREFERENCES.animation,
  };
}
