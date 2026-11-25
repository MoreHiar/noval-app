import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCard } from '../../components/BookCard';
import { TabBarIcon } from '../../components/TabBarIcon';
import { theme } from '../../components/theme';
import { searchSources, SearchResult, summarizeSearch } from '../../sources/search';
import { useLibrary } from '../../state/library';

type SearchState = { query: string; sourceId: string | null; results: SearchResult[]; done: boolean };

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { enabledSources: sources, ready } = useLibrary();
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState<SearchState>({ query: '', sourceId: null, results: [], done: false });
  const selectedSource = sources.find(source => source.info.id === selectedSourceId);
  const activeSourceId = selectedSource?.info.id ?? null;
  const activeSources = selectedSource ? [selectedSource] : sources;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const results = new Map<string, SearchResult>();
    const targetSources = activeSourceId ? sources.filter(source => source.info.id === activeSourceId) : sources;
    const snapshot = (done: boolean): SearchState => ({ query, sourceId: activeSourceId, results: targetSources.flatMap(source => {
      const result = results.get(source.info.id);
      return result ? [result] : [];
    }), done });
    const timer = setTimeout(() => {
      setSearch(snapshot(false));
      searchSources(targetSources, query, controller.signal, result => {
        results.set(result.source.info.id, result);
        setSearch(snapshot(false));
      }).then(() => {
        if (!controller.signal.aborted) setSearch(snapshot(true));
      });
    }, query.trim() ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sources, activeSourceId, query, attempt, ready]);

  const current = search.query === query && search.sourceId === activeSourceId;
  const results = current ? search.results : [];
  const books = results.flatMap(result => result.books.map(book => ({ book, sourceName: result.source.info.name })));
  const errors = results.filter(result => result.error);
  const onlineResults = results.filter(result => result.source.info.kind === 'legado');
  const loading = !ready || !current || !search.done;
  const total = activeSources.filter(source => source.info.kind === 'legado').length;
  const summary = summarizeSearch(results);
  const sourceOptions = [null, ...sources].filter(source => !sourceFilter.trim() ||
    (source?.info.name ?? '全部书源').toLocaleLowerCase().includes(sourceFilter.trim().toLocaleLowerCase()));

  return (
    <>
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
      <Pressable style={styles.sourcePickerButton} onPress={() => { setSourceFilter(''); setSourcePickerOpen(true); }} accessibilityRole="button" accessibilityLabel={`搜索书源：${selectedSource?.info.name ?? '全部书源'}`} accessibilityState={{ expanded: sourcePickerOpen }}>
        <TabBarIcon name="sources" color={theme.accent} size={18} />
        <Text style={styles.sourcePickerLabel} numberOfLines={1}>{selectedSource?.info.name ?? '全部书源'}</Text>
        <Text style={styles.sourcePickerArrow}>⌄</Text>
      </Pressable>
      <Text style={styles.caption} accessibilityLiveRegion="polite">{query.trim() ? `${books.length - summary.demoBooks} 本在线结果 · ${loading ? `正在搜索 ${summary.settled}/${total}` : `${summary.matched} 个书源有结果 · ${summary.empty} 个未匹配 · ${summary.failed} 个失败 · ${summary.unsupported} 个规则未支持`}${summary.demoBooks ? ` · ${summary.demoBooks} 本离线示例` : ''}` : `${summary.demoBooks} 本离线示例`}</Text>
      {!!query.trim() && onlineResults.length > 0 && <View style={styles.errorPanel}>
        <Pressable onPress={() => setShowDetails(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: showDetails }}><Text style={styles.error}>查看各书源搜索情况{errors.length ? `（${errors.length} 个失败或未支持）` : ''} {showDetails ? '⌃' : '⌄'}</Text></Pressable>
        {showDetails && onlineResults.map(result => <Text key={result.source.info.id} style={styles.errorDetail}>{result.source.info.name}：{result.error ?? (result.books.length ? `找到 ${result.books.length} 本` : '已响应，未提取到匹配结果')}</Text>)}
        {!loading && <Pressable onPress={() => setAttempt(value => value + 1)} accessibilityRole="button"><Text style={styles.retry}>重新搜索</Text></Pressable>}
      </View>}
      </View>}
      ListEmptyComponent={<Text style={styles.empty}>{loading ? '正在搜索，请稍候…' : !sources.length && query.trim() ? '请先在「书源」中导入并启用网络书源。' : summary.completed === 0 && total > 0 && query.trim() ? '所选书源未能完成搜索，请展开上方原因。' : query.trim() ? `所选书源未检索到“${query.trim()}”。可尝试缩短关键词或选择其他书源。${errors.length ? '部分书源未完成搜索，详见上方搜索情况。' : ''}` : '输入书名或作者开始搜索'}</Text>}
    />
    <Modal visible={sourcePickerOpen} transparent animationType="slide" onRequestClose={() => setSourcePickerOpen(false)}>
      <View style={styles.pickerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSourcePickerOpen(false)} accessibilityLabel="关闭书源选择" />
        <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <View style={styles.pickerHeading}><Text style={styles.pickerTitle}>选择搜索书源</Text><Pressable onPress={() => setSourcePickerOpen(false)} accessibilityRole="button" accessibilityLabel="关闭书源选择" style={styles.pickerClose}><Text style={styles.pickerCloseText}>×</Text></Pressable></View>
          <View style={styles.pickerSearch}><TabBarIcon name="search" color={theme.muted} size={18} /><TextInput style={styles.pickerInput} value={sourceFilter} onChangeText={setSourceFilter} placeholder="查找书源" placeholderTextColor={theme.muted} accessibilityLabel="查找书源" autoCorrect={false} /></View>
          <FlatList
            data={sourceOptions}
            keyExtractor={source => source?.info.id ?? 'all'}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.pickerEmpty}>没有匹配的已启用书源</Text>}
            renderItem={({ item }) => <Pressable style={styles.pickerOption} onPress={() => { setSelectedSourceId(item?.info.id ?? null); setShowDetails(false); setSourcePickerOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: (item?.info.id ?? null) === activeSourceId }}>
              <Text style={styles.pickerOptionText} numberOfLines={2}>{item?.info.name ?? '全部书源'}</Text>
              {!item && <Text style={styles.pickerOptionCount}>{sources.length} 个已启用</Text>}
              {(item?.info.id ?? null) === activeSourceId && <Text style={styles.pickerCheck}>✓</Text>}
            </Pressable>}
          />
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: 20, paddingBottom: 130, maxWidth: 760, width: '100%', alignSelf: 'center' },
  heading: { marginBottom: 24 },
  eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 3, marginBottom: 8 },
  title: { color: theme.ink, fontSize: 31, fontWeight: '800', letterSpacing: 1 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.paper, borderRadius: 14, paddingHorizontal: 16, height: 52, marginBottom: 10 },
  icon: { color: theme.accent, fontSize: 25, marginRight: 10 },
  input: { flex: 1, color: theme.ink, fontSize: 14, height: '100%', minWidth: 0 },
  sourcePickerButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper },
  sourcePickerLabel: { flex: 1, minWidth: 0, color: theme.ink, fontSize: 13, fontWeight: '600' },
  sourcePickerArrow: { color: theme.muted, fontSize: 21, marginTop: -5 },
  caption: { color: theme.muted, fontSize: 12, marginBottom: 14, lineHeight: 19 },
  errorPanel: { marginBottom: 16 },
  error: { color: theme.accent, paddingVertical: 10 },
  errorDetail: { color: theme.muted, fontSize: 12, lineHeight: 19, marginBottom: 8 },
  retry: { color: theme.accent, fontWeight: '600', paddingVertical: 10 },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 30 },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#202A2766' },
  pickerSheet: { width: '100%', maxWidth: 760, maxHeight: '80%', alignSelf: 'center', backgroundColor: theme.background, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 20, paddingTop: 18 },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pickerTitle: { color: theme.ink, fontSize: 18, fontWeight: '700' },
  pickerClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pickerCloseText: { color: theme.muted, fontSize: 27 },
  pickerSearch: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, marginBottom: 8, backgroundColor: theme.paper, borderRadius: 8, borderWidth: 1, borderColor: theme.line },
  pickerInput: { flex: 1, minWidth: 0, height: '100%', color: theme.ink, fontSize: 14 },
  pickerOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.line, paddingVertical: 10 },
  pickerOptionText: { flex: 1, minWidth: 0, color: theme.ink, fontSize: 14 },
  pickerOptionCount: { color: theme.muted, fontSize: 11 },
  pickerCheck: { width: 22, color: theme.accent, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  pickerEmpty: { color: theme.muted, textAlign: 'center', paddingVertical: 30 },
});
