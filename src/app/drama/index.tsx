import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RemoteImage } from '../../components/RemoteImage';
import { TabBarIcon } from '../../components/TabBarIcon';
import { useThemedStyles, type AppTheme } from '../../components/theme';
import { discoverDramas, searchDramas, type Drama } from '../../dramas/hongguo';

type Result = { items: Drama[]; hasMore: boolean; error: string; page: number };
const initial: Result = { items: [], hasMore: false, error: '', page: 0 };

export default function DramasScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result>(initial);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      setResult({ ...initial, error: '浏览器跨域限制了红果直连。请在 Android 或 iOS 应用中使用短剧。' });
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setResult(initial);
    const task = query ? searchDramas(query, 1, controller.signal).then(page => ({ ...page, error: '' }))
      : discoverDramas(controller.signal).then(items => ({ items, page: 1, hasMore: false, error: '' }));
    task.then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(error => { if (!controller.signal.aborted) setResult({ ...initial, error: error instanceof Error ? error.message : '短剧加载失败' }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision]);

  const loadMore = useCallback(async () => {
    if (!query || loading || moreLoading || !result.hasMore || result.page >= 50) return;
    setMoreLoading(true);
    try {
      const page = await searchDramas(query, result.page + 1);
      setResult(current => ({ ...current, items: [...current.items, ...page.items.filter(item => !current.items.some(existing => existing.id === item.id))], page: page.page, hasMore: page.hasMore, error: '' }));
    } catch (error) {
      setResult(current => ({ ...current, hasMore: false, error: error instanceof Error ? error.message : '下一页加载失败' }));
    } finally { setMoreLoading(false); }
  }, [query, loading, moreLoading, result.hasMore, result.page]);

  const submit = () => {
    const next = input.trim();
    if (next === query) setRevision(value => value + 1);
    else setQuery(next);
  };

  return <FlatList
    style={styles.page}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom + 28, 44) }]}
    data={result.items}
    numColumns={2}
    columnWrapperStyle={styles.row}
    keyExtractor={item => item.id}
    onEndReached={loadMore}
    onEndReachedThreshold={0.4}
    renderItem={({ item }) => <Pressable style={styles.card} onPress={() => router.push({ pathname: '/drama/[seriesId]', params: { seriesId: item.id } })} accessibilityRole="button" accessibilityLabel={`查看短剧${item.title}`}>
      <View style={styles.poster}>{item.cover ? <RemoteImage uri={item.cover} style={StyleSheet.absoluteFill} recyclingKey={item.id} accessibilityLabel={`${item.title}封面`} /> : null}</View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardMeta} numberOfLines={1}>{item.episodeCount ? `${item.episodeCount} 集` : '短剧'}{item.category ? ` · ${item.category}` : ''}</Text>
    </Pressable>}
    ListHeaderComponent={<>
      <View style={styles.heading}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="返回我的" style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>短剧</Text><Pressable onPress={() => router.push('/drama/settings')} accessibilityRole="button" accessibilityLabel="短剧设置" style={styles.settings}><Text style={styles.settingsText}>设置</Text></Pressable></View>
      <View style={styles.searchBar}>
        <TabBarIcon name="search" color={styles.muted.color} size={19} />
        <TextInput style={styles.input} value={input} onChangeText={setInput} onSubmitEditing={submit} returnKeyType="search" placeholder="搜索剧名或演员" placeholderTextColor={styles.muted.color} accessibilityLabel="搜索短剧" />
        {input ? <Pressable onPress={() => { setInput(''); setQuery(''); }} accessibilityRole="button" accessibilityLabel="清空搜索"><Text style={styles.clear}>×</Text></Pressable> : null}
        <Pressable onPress={submit} style={styles.searchAction} accessibilityRole="button"><Text style={styles.searchActionText}>搜索</Text></Pressable>
      </View>
      <View style={styles.section}><Text style={styles.sectionTitle}>{query ? `“${query}”的结果` : '热播短剧'}</Text><Text style={styles.sectionCount}>{result.items.length ? `${result.items.length} 部` : ''}</Text></View>
      {loading ? <ActivityIndicator style={styles.status} color={styles.dark.color} /> : null}
      {!loading && result.error ? <View style={styles.message}><Text style={styles.messageText}>{result.error}</Text>{Platform.OS !== 'web' ? <Pressable onPress={() => setRevision(value => value + 1)} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>重试</Text></Pressable> : null}</View> : null}
      {!loading && !result.error && !result.items.length ? <Text style={styles.empty}>没有找到短剧</Text> : null}
    </>}
    ListFooterComponent={moreLoading ? <ActivityIndicator style={styles.status} color={styles.dark.color} /> : undefined}
  />;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: 20, maxWidth: 760, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  back: { width: 38, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  backText: { color: theme.ink, fontSize: 32, lineHeight: 38 },
  title: { color: theme.ink, fontSize: 27, lineHeight: 36, fontWeight: '700' },
  settings: { minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  settingsText: { color: theme.dark, fontSize: 13, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 50, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, borderRadius: 8, paddingLeft: 13, marginBottom: 24 },
  input: { flex: 1, minWidth: 0, color: theme.ink, fontSize: 14, paddingVertical: 9 },
  clear: { color: theme.muted, fontSize: 24, width: 30, textAlign: 'center' },
  searchAction: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  searchActionText: { color: theme.dark, fontSize: 13, fontWeight: '700' },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 },
  sectionTitle: { color: theme.ink, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  sectionCount: { color: theme.muted, fontSize: 12 },
  row: { gap: 12 },
  card: { flex: 1, minWidth: 0, maxWidth: '50%', marginBottom: 22 },
  poster: { width: '100%', aspectRatio: 0.72, borderRadius: 5, overflow: 'hidden', backgroundColor: theme.secondary },
  cardTitle: { color: theme.ink, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 8, minHeight: 38 },
  cardMeta: { color: theme.muted, fontSize: 11, marginTop: 3 },
  status: { marginVertical: 44 },
  message: { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 16 },
  messageText: { color: theme.muted, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  retry: { minHeight: 44, minWidth: 90, marginTop: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.line, borderRadius: 6 },
  retryText: { color: theme.dark, fontSize: 13, fontWeight: '700' },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 45 },
  muted: { color: theme.muted }, dark: { color: theme.dark },
});
