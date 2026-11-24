import { StyleSheet, Text, View } from 'react-native';
import { Page } from '../../components/Page';
import { theme } from '../../components/theme';
import { isRuleSource } from '../../sources/legado';
import { useLibrary } from '../../state/library';

export default function ProfileScreen() {
  const { shelf, sourceDefinitions } = useLibrary();
  const sources = sourceDefinitions.filter(isRuleSource).filter(entry => entry.enabled);
  return (
    <Page title="我的阅读" eyebrow="PERSONAL SPACE">
      <View style={styles.card}>
        <Text style={styles.greeting}>让故事，慢慢发生。</Text>
        <Text style={styles.description}>你的阅读空间已经准备好了。</Text>
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

const styles = StyleSheet.create({
  card: { backgroundColor: theme.dark, padding: 27, borderRadius: 20, minHeight: 145, justifyContent: 'center' },
  greeting: { color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 9 },
  description: { color: '#CDD5CF', fontSize: 13 },
  stats: { flexDirection: 'row', backgroundColor: theme.paper, borderRadius: 17, marginTop: 18, paddingVertical: 22 },
  stat: { flex: 1, alignItems: 'center' },
  value: { color: theme.ink, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  label: { color: theme.muted, fontSize: 11 },
  divider: { width: 1, backgroundColor: theme.line },
  note: { color: theme.muted, textAlign: 'center', fontSize: 12, marginTop: 26 },
});
