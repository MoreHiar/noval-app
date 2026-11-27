import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '../../components/Page';
import { TabBarIcon } from '../../components/TabBarIcon';
import { useThemedStyles, type AppTheme } from '../../components/theme';
import { isRuleSource } from '../../sources/legado';
import { useLibrary } from '../../state/library';
import { useAppTheme, type AppearanceMode } from '../../state/appearance';

const appearanceOptions: { mode: AppearanceMode; label: string; symbol: string; description: string }[] = [
  { mode: 'system', label: '跟随系统', symbol: '◐', description: '随设备外观自动切换' },
  { mode: 'light', label: '浅色模式', symbol: '☀', description: '温暖明亮的纸张色彩' },
  { mode: 'dark', label: '深色模式', symbol: '☾', description: '柔和暗色，适合夜读' },
];

export default function ProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { mode, setMode, error, ready } = useAppTheme();
  const { shelf, sourceDefinitions } = useLibrary();
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const sources = sourceDefinitions.filter(isRuleSource).filter(entry => entry.enabled);
  const activeAppearance = appearanceOptions.find(option => option.mode === mode) ?? appearanceOptions[0];

  return (
    <Page title="我的阅读" eyebrow="给自己，留一点阅读的时间" tabbed>
      <View style={styles.card}>
        <Text style={styles.quote}>“</Text>
        <Text style={styles.greeting}>让故事，{`\n`}慢慢发生。</Text>
        <Text style={styles.description}>小说与漫画，都在你的阅读空间。</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.value}>{shelf.length}</Text><Text style={styles.label}>书架收藏</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text style={styles.value}>{sources.length}</Text><Text style={styles.label}>已启用书源</Text></View>
      </View>
      <View style={styles.sourceSection}>
        <Text style={styles.sectionTitle}>阅读与内容</Text>
        <Pressable style={styles.sourceEntry} onPress={() => router.push('/source')} accessibilityRole="button" accessibilityLabel="书源管理">
          <View style={styles.sourceIcon}><TabBarIcon name="sources" color={styles.sourceIconText.color} size={18} /></View>
          <View style={styles.sourceCopy}><Text style={styles.sourceEntryTitle}>书源管理</Text><Text style={styles.sourceEntryHint}>导入、启停与编辑小说和漫画书源</Text></View>
          <Text style={styles.sourceChevron}>›</Text>
        </Pressable>
        <View style={styles.sourceEntry}>
          <View style={styles.sourceIcon}><TabBarIcon name="novels" color={styles.sourceIconText.color} size={18} /></View>
          <View style={styles.sourceCopy}><Text style={styles.sourceEntryTitle}>本机阅读进度</Text><Text style={styles.sourceEntryHint}>打开作品即可继续阅读</Text></View>
        </View>
      </View>
      <View style={styles.appearance}>
        <Text style={styles.sectionTitle}>外观</Text>
        <Pressable style={styles.sourceEntry} onPress={() => setAppearanceExpanded(value => !value)} accessibilityRole="button" accessibilityLabel={`外观，${activeAppearance.label}`} accessibilityState={{ expanded: appearanceExpanded }}>
          <View style={styles.sourceIcon}><Text style={styles.appearanceSymbol}>◐</Text></View>
          <View style={styles.sourceCopy}><Text style={styles.sourceEntryTitle}>{activeAppearance.label}</Text><Text style={styles.sourceEntryHint}>浅色、深色模式在正式应用中保留</Text></View>
          <Text style={[styles.sourceChevron, appearanceExpanded && styles.expandedChevron]}>›</Text>
        </Pressable>
        {appearanceExpanded && <View accessibilityRole="radiogroup" accessibilityLabel="外观模式" style={styles.appearanceOptions}>
          {appearanceOptions.map(option => <Pressable key={option.mode} onPress={() => setMode(option.mode)} disabled={!ready}
            accessibilityRole="radio" aria-checked={mode === option.mode} accessibilityState={{ checked: mode === option.mode, disabled: !ready }}
            accessibilityLabel={option.label} accessibilityHint={option.description}
            style={({ pressed }) => [styles.appearanceOption, mode === option.mode && styles.selectedOption, pressed && styles.pressed]}>
            <Text style={styles.modeSymbol} accessibilityElementsHidden>{option.symbol}</Text>
            <View style={styles.optionCopy}><Text style={styles.optionTitle}>{option.label}</Text><Text style={styles.optionHint}>{option.description}</Text></View>
            <View style={[styles.radio, mode === option.mode && styles.selectedRadio]}>{mode === option.mode && <View style={styles.radioDot} />}</View>
          </Pressable>)}
        </View>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </Page>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: { backgroundColor: theme.dark, padding: 22, borderRadius: 8, minHeight: 169, justifyContent: 'center', overflow: 'hidden' },
  quote: { color: '#B9D3BA', fontSize: 22, fontFamily: 'serif', lineHeight: 25 },
  greeting: { color: '#FFFFFF', fontSize: 22, lineHeight: 32, fontFamily: 'serif', marginTop: 9, marginBottom: 5 },
  description: { color: '#E7ECE6', fontSize: 11 },
  stats: { flexDirection: 'row', backgroundColor: theme.paper, borderRadius: 8, borderWidth: 1, borderColor: theme.line, marginTop: 16, paddingVertical: 17 },
  sourceSection: { marginTop: 27 },
  sourceEntry: { flexDirection: 'row', alignItems: 'center', minHeight: 67, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 12 },
  sourceIcon: { width: 34, height: 34, borderRadius: 6, backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center' },
  sourceIconText: { color: theme.dark },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceEntryTitle: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  sourceEntryHint: { color: theme.muted, fontSize: 10, marginTop: 4 },
  sourceChevron: { color: theme.muted, fontSize: 22 },
  stat: { flex: 1, alignItems: 'center' },
  value: { color: theme.ink, fontSize: 26, fontFamily: 'serif', marginBottom: 3 },
  label: { color: theme.muted, fontSize: 11 },
  divider: { width: 1, backgroundColor: theme.line },
  appearance: { marginTop: 26 },
  appearanceSymbol: { color: theme.dark, fontSize: 17 },
  expandedChevron: { transform: [{ rotate: '90deg' }] },
  appearanceOptions: { paddingTop: 10 },
  sectionTitle: { color: theme.ink, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  appearanceOption: { minHeight: 62, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.line, marginBottom: 8 },
  selectedOption: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  modeSymbol: { color: theme.accent, fontSize: 25, width: 30, textAlign: 'center' },
  optionCopy: { flex: 1 },
  optionTitle: { color: theme.ink, fontSize: 14, fontWeight: '600' },
  optionHint: { color: theme.muted, fontSize: 11, lineHeight: 18, marginTop: 4 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: theme.muted, alignItems: 'center', justifyContent: 'center' },
  selectedRadio: { borderColor: theme.accent },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.accent },
  pressed: { opacity: 0.65 },
  error: { color: theme.danger, fontSize: 12, lineHeight: 20, marginTop: 8 },
});
