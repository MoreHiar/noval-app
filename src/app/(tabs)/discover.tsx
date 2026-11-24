import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCard } from '../../components/BookCard';
import { theme } from '../../components/theme';
import { searchSources, SearchResult, summarizeSearch } from '../../sources/search';
import { useLibrary } from '../../state/library';

type SearchState = { query: string; results: SearchResult[]; done: boolean };

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { enabledSources: sources, ready } = useLibrary();
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [search, setSearch] = useState<SearchState>({ query: '', results: [], done: false });

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const results = new Map<string, SearchResult>();
    const snapshot = (done: boolean): SearchState => ({ query, results: sources.flatMap(source => {
      const result = results.get(source.info.id);
      return result ? [result] : [];
    }), done });
    const timer = setTimeout(() => {
      setSearch(snapshot(false));
      searchSources(sources, query, controller.signal, result => {
        results.set(result.source.info.id, result);
        setSearch(snapshot(false));
      }).then(() => {
        if (!controller.signal.aborted) setSearch(snapshot(true));
      });
    }, query.trim() ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sources, query, attempt, ready]);

  const current = search.query === query;
  const results = current ? search.results : [];
  const books = results.flatMap(result => result.books.map(book => ({ book, sourceName: result.source.info.name })));
  const errors = results.filter(result => result.error);
  const onlineResults = results.filter(result => result.source.info.kind === 'legado');
  const loading = !ready || !current || !search.done;
  const total = sources.filter(source => source.info.kind === 'legado').length;
  const summary = summarizeSearch(results);

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]}
      data={books}
      keyExtractor={({ book }) => `${book.sourceId}/${book.id}`}
      renderItem={({ item }) => <BookCard book={item.book} sourceName={item.sourceName} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View>
      <View style={styles.heading}><Text style={styles.eyebrow}>DISCOVER STORIES</Text><Text style={styles.title}>发现好书</Text></View>
      <View style={styles.search}><Text style={styles.icon}>⌕</Text><TextInput style={styles.input} value={query} onChangeText={text => { setQuery(text); setShowDetails(false); }} placeholder="搜索书名或作者" placeholderTextColor="#A4AAA3" accessibilityLabel="搜索书籍" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => setAttempt(value => value + 1)} /></View>
      <Text style={styles.caption} accessibilityLiveRegion="polite">{query.trim() ? `${books.length - summary.demoBooks} 本在线结果 · ${loading ? `正在搜索 ${summary.settled}/${total}` : `${summary.matched} 个书源有结果 · ${summary.empty} 个未匹配 · ${summary.failed} 个失败 · ${summary.unsupported} 个规则未支持`}${summary.demoBooks ? ` · ${summary.demoBooks} 本离线示例` : ''}` : `${summary.demoBooks} 本离线示例`}</Text>
      <Text style={styles.caption}>{query.trim() ? '正在使用已启用书源。在线结果目前支持查看搜索信息，目录与正文还在接入中。' : '输入书名或作者搜索已启用书源，以下为离线示例。'}</Text>
      {!!query.trim() && onlineResults.length > 0 && <View style={styles.errorPanel}>
        <Pressable onPress={() => setShowDetails(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: showDetails }}><Text style={styles.error}>查看各书源搜索情况{errors.length ? `（${errors.length} 个失败或未支持）` : ''} {showDetails ? '⌃' : '⌄'}</Text></Pressable>
        {showDetails && onlineResults.map(result => <Text key={result.source.info.id} style={styles.errorDetail}>{result.source.info.name}：{result.error ?? (result.books.length ? `找到 ${result.books.length} 本` : '已响应，未提取到匹配结果')}</Text>)}
        {!loading && <Pressable onPress={() => setAttempt(value => value + 1)} accessibilityRole="button"><Text style={styles.retry}>重新搜索</Text></Pressable>}
      </View>}
      </View>}
      ListEmptyComponent={<Text style={styles.empty}>{loading ? '正在搜索，请稍候…' : !total && query.trim() ? '请先在「书源」中导入并启用网络书源。' : summary.completed === 0 && total > 0 && query.trim() ? '网络书源均未能完成搜索，请展开上方原因。' : query.trim() ? `已响应的书源未检索到“${query.trim()}”。可尝试缩短关键词或启用其他书源。${errors.length ? '部分书源未完成搜索，详见上方搜索情况。' : ''}` : '没有找到相关书籍'}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: 20, paddingBottom: 130, maxWidth: 760, width: '100%', alignSelf: 'center' },
  heading: { marginBottom: 24 },
  eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 3, marginBottom: 8 },
  title: { color: theme.ink, fontSize: 31, fontWeight: '800', letterSpacing: 1 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.paper, borderRadius: 14, paddingHorizontal: 16, height: 52, marginBottom: 20 },
  icon: { color: theme.accent, fontSize: 25, marginRight: 10 },
  input: { flex: 1, color: theme.ink, fontSize: 14, height: '100%', minWidth: 0 },
  caption: { color: theme.muted, fontSize: 12, marginBottom: 14, lineHeight: 19 },
  errorPanel: { marginBottom: 16 },
  error: { color: theme.accent, paddingVertical: 10 },
  errorDetail: { color: theme.muted, fontSize: 12, lineHeight: 19, marginBottom: 8 },
  retry: { color: theme.accent, fontWeight: '600', paddingVertical: 10 },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 30 },
});
