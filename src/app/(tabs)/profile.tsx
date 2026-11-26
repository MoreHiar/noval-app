import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '../../components/Page';
import { BrandLogo } from '../../components/BrandLogo';
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
    <Page title="我的阅读" eyebrow="PERSONAL SPACE">
      <View style={styles.brandRow}>
        <BrandLogo size={52} />
        <View><Text style={styles.brandName}>Noval 阅读</Text><Text style={styles.brandCaption}>一页一世界</Text></View>
      </View>
      <View style={styles.card}>
        <Text style={styles.greeting}>让故事，慢慢发生。</Text>
        <Text style={styles.description}>你的阅读空间已经准备好了。</Text>
      </View>
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
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.value}>{shelf.length}</Text><Text style={styles.label}>书架藏书</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text style={styles.value}>{sources.length}</Text><Text style={styles.label}>已启用书源</Text></View>
      </View>
      <Text style={styles.note}>阅读进度自动保存在本机，打开书籍即可继续阅读。</Text>
    </Page>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  brandName: { color: theme.ink, fontSize: 21, fontWeight: '800', letterSpacing: 0.5 },
  brandCaption: { color: theme.muted, fontSize: 12, marginTop: 5, letterSpacing: 2 },
  card: { backgroundColor: theme.dark, padding: 27, borderRadius: 20, minHeight: 145, justifyContent: 'center' },
  greeting: { color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 9 },
  description: { color: '#CDD5CF', fontSize: 13 },
  stats: { flexDirection: 'row', backgroundColor: theme.paper, borderRadius: 17, marginTop: 18, paddingVertical: 22 },
  stat: { flex: 1, alignItems: 'center' },
  value: { color: theme.ink, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  label: { color: theme.muted, fontSize: 11 },
  divider: { width: 1, backgroundColor: theme.line },
  appearance: { marginTop: 26, backgroundColor: theme.paper, padding: 18, borderRadius: 18 },
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
  note: { color: theme.muted, textAlign: 'center', fontSize: 12, marginTop: 26 },
});
