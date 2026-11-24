import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Book } from '../domain/books';
import { useLibrary } from '../state/library';
import { theme } from './theme';

export function ShelfButton({ book, compact = false, removeOnly = false }: { book: Book; compact?: boolean; removeOnly?: boolean }) {
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
      <Pressable onPress={change} disabled={!ready || saving} style={({ pressed }) => [styles.button, collected && styles.collected, compact && styles.compact,
        (pressed || saving || !ready) && styles.pressed]} accessibilityRole="button" accessibilityLabel={`将${book.title}${collected || removeOnly ? '移出书架' : '加入书架'}`} accessibilityState={{ disabled: !ready || saving, busy: saving }}>
        {saving ? <ActivityIndicator size="small" color={collected ? theme.accent : theme.paper} /> : <Svg width={18} height={20} viewBox="0 0 24 24" fill="none" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
          <Path d="M6 3.5h12v17l-6-4-6 4v-17Z" stroke={collected ? theme.accent : theme.paper} strokeWidth={1.7} strokeLinejoin="round" fill={collected ? '#DCE8DE' : 'none'} />
          <Path d={collected ? 'm9 9 2 2 4-4' : 'M9 9h6m-3-3v6'} stroke={collected ? theme.accent : theme.paper} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>}
        <Text style={[styles.label, collected && styles.collectedLabel]}>{label}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: theme.accent, borderWidth: 1, borderColor: theme.accent },
  collected: { backgroundColor: '#EDF2EB', borderColor: '#CFDACE' },
  label: { fontSize: 14, fontWeight: '700', color: theme.paper },
  collectedLabel: { color: theme.accent },
  compactContainer: { alignSelf: 'flex-end', marginTop: 10 },
  compact: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14 },
  pressed: { opacity: 0.6 },
  error: { color: '#A44036', fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 280 },
});
