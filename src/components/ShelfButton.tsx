import { useAppTheme } from '../state/appearance';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Book } from '../domain/books';
import { useLibrary } from '../state/library';
import { useThemedStyles, type AppTheme } from './theme';

export function ShelfButton({ book, compact = false, removeOnly = false, detail = false }: { book: Book; compact?: boolean; removeOnly?: boolean; detail?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useAppTheme();
  const { isOnShelf, setBookOnShelf, ready } = useLibrary();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const collected = isOnShelf(book);
  const label = saving ? '正在保存' : collected || removeOnly ? '移出书架' : '加入书架';
  const change = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try { await setBookOnShelf(book, removeOnly ? false : !collected); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); }
    finally { setSaving(false); }
  };
  return (
    <View style={compact ? styles.compactContainer : undefined}>
      <Pressable onPress={change} disabled={!ready || saving} style={({ pressed }) => [styles.button, (collected || detail) && styles.collected, compact && styles.compact, detail && styles.detail, removeOnly && styles.removeOnly,
        (pressed || saving || !ready) && styles.pressed]} accessibilityRole="button" accessibilityLabel={`将${book.title}${collected || removeOnly ? '移出书架' : '加入书架'}`} accessibilityState={{ disabled: !ready || saving, busy: saving }}>
        {saving ? <ActivityIndicator size="small" color={collected || detail ? theme.dark : theme.onAccent} /> : removeOnly ? null : <Svg width={18} height={20} viewBox="0 0 24 24" fill="none" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
          <Path d="M6 3.5h12v17l-6-4-6 4v-17Z" stroke={collected || detail ? theme.dark : theme.onAccent} strokeWidth={1.7} strokeLinejoin="round" fill={collected ? theme.successSoft : 'none'} />
          <Path d={collected ? 'm9 9 2 2 4-4' : 'M9 9h6m-3-3v6'} stroke={collected || detail ? theme.dark : theme.onAccent} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>}
        <Text style={[styles.label, (collected || detail) && styles.collectedLabel, removeOnly && styles.removeText]}>{label}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  button: { minHeight: 50, borderRadius: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: theme.dark, borderWidth: 1, borderColor: theme.dark },
  collected: { backgroundColor: theme.paper, borderColor: theme.line },
  label: { fontSize: 14, fontWeight: '700', color: theme.onAccent },
  collectedLabel: { color: theme.dark },
  compactContainer: { alignSelf: 'center' },
  compact: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14 },
  detail: { minWidth: 124 },
  removeOnly: { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 10 },
  removeText: { color: theme.muted, fontSize: 12, fontWeight: '500' },
  pressed: { opacity: 0.6 },
  error: { color: theme.danger, fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 280 },
});
