import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '../../components/Page';
import { BrandLogo } from '../../components/BrandLogo';
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
  const { mode, colorScheme, setMode, error, ready } = useAppTheme();
  const { shelf, sourceDefinitions } = useLibrary();
  const sources = sourceDefinitions.filter(isRuleSource).filter(entry => entry.enabled);
  return (
    <Page title="我的阅读" eyebrow="给自己，留一点阅读的时间" tabbed>
      <View style={styles.card}>
        <View style={styles.arcOne} pointerEvents="none" /><View style={styles.arcTwo} pointerEvents="none" /><View style={styles.arcThree} pointerEvents="none" />
        <Text style={styles.quote}>“</Text>
        <Text style={styles.greeting}>让故事，{`\n`}慢慢发生。</Text>
        <Text style={styles.description}>你的阅读空间已经准备好了。</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.value}>{shelf.length}</Text><Text style={styles.label}>书架藏书</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text style={styles.value}>{sources.length}</Text><Text style={styles.label}>已启用书源</Text></View>
      </View>
      <View style={styles.sourceSection}><Text style={styles.sectionTitle}>阅读与内容</Text><Pressable style={styles.sourceEntry} onPress={() => router.push('/source')} accessibilityRole="button" accessibilityLabel="书源管理"><View style={styles.sourceIcon}><TabBarIcon name="sources" color={styles.sourceIconText.color} size={18} /></View><View style={styles.sourceCopy}><Text style={styles.sourceEntryTitle}>书源管理</Text><Text style={styles.sourceEntryHint}>导入、启停与编辑小说和漫画书源</Text></View><Text style={styles.sourceChevron}>›</Text></Pressable></View>
      <View style={styles.localNote}><Text style={styles.bookmark}>♧</Text><View><Text style={styles.localTitle}>下次打开，接着读</Text><Text style={styles.note}>阅读进度自动保存在本机，{`\n`}打开书籍即可继续阅读。</Text></View></View>
      <View style={styles.signature}><BrandLogo size={32} /><Text style={styles.signatureName}>noval.</Text><Text style={styles.signatureTag}>ONE MORE PAGE, ONE MORE WORLD.</Text></View>
      <View style={styles.appearance}>
        <Text style={styles.sectionTitle}>外观</Text>
        <Text style={styles.appearanceHint}>当前为{colorScheme === 'dark' ? '深色' : '浅色'}模式 · 选择后自动保存</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="外观模式">
          {appearanceOptions.map(option => <Pressable key={option.mode} onPress={() => setMode(option.mode)} disabled={!ready}
            accessibilityRole="radio" aria-checked={mode === option.mode} accessibilityState={{ checked: mode === option.mode, disabled: !ready }}
            accessibilityLabel={option.label} accessibilityHint={option.description}
            style={({ pressed }) => [styles.appearanceOption, mode === option.mode && styles.selectedOption, pressed && styles.pressed]}>
            <Text style={styles.modeSymbol} accessibilityElementsHidden>{option.symbol}</Text>
            <View style={styles.optionCopy}><Text style={styles.optionTitle}>{option.label}</Text><Text style={styles.optionHint}>{option.description}</Text></View>
            <View style={[styles.radio, mode === option.mode && styles.selectedRadio]}>{mode === option.mode && <View style={styles.radioDot} />}</View>
          </Pressable>)}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </Page>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: { backgroundColor: theme.dark, padding: 25, borderRadius: 20, minHeight: 208, justifyContent: 'center', overflow: 'hidden' },
  arcOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 17, borderColor: '#FFFFFF10', right: -48, bottom: -76 },
  arcTwo: { position: 'absolute', width: 145, height: 145, borderRadius: 73, borderWidth: 14, borderColor: '#FFFFFF12', right: -32, bottom: -60 },
  arcThree: { position: 'absolute', width: 108, height: 108, borderRadius: 54, borderWidth: 10, borderColor: '#FFFFFF12', right: -12, bottom: -42 },
  quote: { color: '#B9D3BA', fontSize: 40, fontFamily: 'serif', lineHeight: 43 },
  greeting: { color: '#FFFFFF', fontSize: 23, lineHeight: 37, fontFamily: 'serif', marginTop: 10, marginBottom: 14 },
  description: { color: '#E7ECE6', fontSize: 12 },
  stats: { flexDirection: 'row', backgroundColor: theme.paper, borderRadius: 17, borderWidth: 1, borderColor: theme.line, marginTop: 18, paddingVertical: 24 },
  sourceSection: { marginTop: 28 }, sourceEntry: { flexDirection: 'row', alignItems: 'center', minHeight: 72, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 12 }, sourceIcon: { width: 36, height: 36, borderRadius: 7, backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center' }, sourceIconText: { color: theme.dark }, sourceCopy: { flex: 1, minWidth: 0 }, sourceEntryTitle: { color: theme.ink, fontSize: 14, fontWeight: '700' }, sourceEntryHint: { color: theme.muted, fontSize: 11, marginTop: 4 }, sourceChevron: { color: theme.muted, fontSize: 22 },
  stat: { flex: 1, alignItems: 'center' },
  value: { color: theme.ink, fontSize: 28, fontFamily: 'serif', marginBottom: 6 },
  label: { color: theme.muted, fontSize: 12 },
  divider: { width: 1, backgroundColor: theme.line },
  localNote: { flexDirection: 'row', gap: 14, marginTop: 30, paddingHorizontal: 5 },
  bookmark: { color: theme.dark, fontSize: 23, width: 22 },
  localTitle: { color: theme.ink, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  signature: { alignItems: 'center', marginTop: 54, marginBottom: 34, gap: 5 },
  signatureName: { color: theme.muted, fontSize: 30, fontFamily: 'serif', fontStyle: 'italic' },
  signatureTag: { color: theme.muted, fontSize: 9, letterSpacing: 2 },
  appearance: { backgroundColor: theme.paper, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: theme.line },
  sectionTitle: { color: theme.ink, fontSize: 18, fontWeight: '700', marginBottom: 7 },
  appearanceHint: { color: theme.muted, fontSize: 12, lineHeight: 20, marginBottom: 14 },
  appearanceOption: { minHeight: 74, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.line, marginBottom: 8 },
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
  note: { color: theme.muted, fontSize: 12, lineHeight: 22 },
});
