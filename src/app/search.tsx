import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCard } from '../components/BookCard';
import { TabBarIcon } from '../components/TabBarIcon';
import { useThemedStyles, type AppTheme } from '../components/theme';
import { searchSources, type SearchResult, summarizeSearch } from '../sources/search';
import { useLibrary } from '../state/library';
import { clearSearchHistory, loadSearchHistory, recordSearchHistory, removeSearchHistory } from '../storage/search-history';

type Scope = 'all' | 'novel' | 'manga';
type SearchState = { query: string; scope: Scope; sourceId: string | null; results: SearchResult[]; done: boolean };
const scopes: { key: Scope; label: string }[] = [{ key: 'all', label: '全部' }, { key: 'novel', label: '小说' }, { key: 'manga', label: '漫画' }];

export default function SearchScreen() {
  const { scope, entry } = useLocalSearchParams<{ scope?: string; entry?: string }>();
  return <SearchSession key={entry ?? 'direct'} initialScope={scope === 'novel' || scope === 'manga' ? scope : 'all'} />;
}

function SearchSession({ initialScope }: { initialScope: Scope }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { enabledSources, ready } = useLibrary();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState<SearchState>({ query: '', scope: initialScope, sourceId: null, results: [], done: true });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sources = useMemo(() => enabledSources.filter(source => scope === 'all' || (source.info.mediaType ?? 'novel') === scope), [enabledSources, scope]);
  const selected = sources.find(source => source.info.id === sourceId);
  const activeId = selected?.info.id ?? null;
  const targets = useMemo(() => selected ? [selected] : sources, [selected, sources]);

  useEffect(() => { void loadSearchHistory().then(setHistory).catch(() => setError('搜索历史读取失败。')); }, []);
  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);
  useEffect(() => {
    if (!submitted || !ready) return;
    const controller = new AbortController();
    const results = new Map<string, SearchResult>();
    const snapshot = (done: boolean): SearchState => ({ query: submitted, scope, sourceId: activeId, results: targets.flatMap(source => results.has(source.info.id) ? [results.get(source.info.id)!] : []), done });
    void searchSources(targets, submitted, controller.signal, result => { results.set(result.source.info.id, result); setSearch(snapshot(false)); })
      .then(() => { if (!controller.signal.aborted) setSearch(snapshot(true)); });
    return () => controller.abort();
  }, [submitted, scope, activeId, targets, ready, attempt]);

  const commit = (value: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = value.trim();
    setQuery(term);
    setSubmitted(term);
    setExpanded(false);
    if (term) void recordSearchHistory(term).then(setHistory).catch(() => setError('搜索历史保存失败。'));
  };
  const clear = () => { if (debounce.current) clearTimeout(debounce.current); setQuery(''); setSubmitted(''); setExpanded(false); };
  const changeQuery = (value: string) => { setQuery(value); if (debounce.current) clearTimeout(debounce.current); if (value.trim()) debounce.current = setTimeout(() => commit(value), 350); else setSubmitted(''); };
  const current = search.query === submitted && search.scope === scope && search.sourceId === activeId;
  const results = current ? search.results : [];
  const books = results.flatMap(result => result.books.map(book => ({ book, sourceName: result.source.info.name })));
  const summary = summarizeSearch(results);
  const loading = !!submitted && (!ready || !current || !search.done);
  const options = [null, ...sources].filter(source => !pickerQuery.trim() || (source?.info.name ?? '全部书源').toLocaleLowerCase().includes(pickerQuery.trim().toLocaleLowerCase()));

  return <View style={styles.page}>
    <View style={[styles.fixed, { paddingTop: insets.top + 12 }]}>
      <View style={styles.searchRow}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="返回"><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.searchBox}><TabBarIcon name="search" color={styles.muted.color} size={18} /><TextInput style={styles.input} value={query} onChangeText={changeQuery} onSubmitEditing={() => commit(query)} placeholder="搜索书名或作者" placeholderTextColor={styles.muted.color} returnKeyType="search" accessibilityLabel="搜索书名或作者" autoCorrect={false} />{query ? <Pressable style={styles.clear} onPress={clear} accessibilityRole="button" accessibilityLabel="清空输入"><Text style={styles.clearText}>×</Text></Pressable> : null}</View>
      </View>
      <View style={styles.scopes}>{scopes.map(item => <Pressable key={item.key} onPress={() => { setScope(item.key); setSourceId(null); }} style={[styles.scope, scope === item.key && styles.activeScope]} accessibilityRole="button" accessibilityState={{ selected: scope === item.key }}><Text style={[styles.scopeText, scope === item.key && styles.activeScopeText]}>{item.label}</Text></Pressable>)}</View>
    </View>
    <FlatList style={styles.list} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]} keyboardShouldPersistTaps="handled" data={submitted ? books : []} keyExtractor={({ book }) => `${book.sourceId}/${book.id}`} renderItem={({ item }) => <BookCard book={item.book} sourceName={item.sourceName} />}
      ListHeaderComponent={<>
        <Pressable style={styles.sourceSelector} onPress={() => { setPickerQuery(''); setPickerOpen(true); }} accessibilityRole="button" accessibilityLabel={`搜索书源：${selected?.info.name ?? '全部已启用书源'}`}><TabBarIcon name="sources" color={styles.dark.color} size={16} /><Text style={styles.sourceLabel} numberOfLines={1}>{selected?.info.name ?? '全部已启用书源'}</Text><Text style={styles.sourceCount}>{targets.length} 个　⌄</Text></Pressable>
        {!submitted ? <><View style={styles.historyHead}><Text style={styles.heading}>最近搜索</Text>{history.length ? <Pressable onPress={() => void clearSearchHistory().then(setHistory).catch(() => setError('清空历史失败。'))} accessibilityRole="button"><Text style={styles.muted}>清空全部</Text></Pressable> : null}</View>{history.map(term => <View key={term} style={styles.historyRow}><Pressable style={styles.historyTerm} onPress={() => commit(term)} accessibilityRole="button"><Text style={styles.historyText}>◷　{term}</Text></Pressable><Pressable style={styles.clear} onPress={() => void removeSearchHistory(term).then(setHistory).catch(() => setError('删除历史失败。'))} accessibilityRole="button" accessibilityLabel={`删除${term}`}><Text style={styles.clearText}>×</Text></Pressable></View>)}{!history.length ? <Text style={styles.empty}>还没有搜索记录</Text> : null}</> : <><Text style={styles.caption}>{loading ? `找到 ${books.length} 本 · 正在搜索 ${summary.settled}/${targets.length} 个书源` : `找到 ${books.length} 本 · ${summary.matched} 个书源有结果`}</Text><Pressable style={styles.status} onPress={() => setExpanded(value => !value)} accessibilityRole="button" accessibilityState={{ expanded }}><Text style={styles.statusText}>各书源搜索情况　{expanded ? '⌃' : '⌄'}</Text></Pressable>{expanded ? <View style={styles.details}><Text style={styles.detailText}>{summary.matched} 个有结果 · {summary.empty} 个未匹配 · {summary.failed} 个失败 · {summary.unsupported} 个规则未支持</Text>{results.map(result => <Text key={result.source.info.id} style={styles.detailText}>{result.source.info.name}：{result.error ?? `找到 ${result.books.length} 本`}</Text>)}<Pressable style={styles.retry} onPress={() => setAttempt(value => value + 1)} accessibilityRole="button"><Text style={styles.retryText}>重新搜索</Text></Pressable></View> : null}</>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </>}
      ListEmptyComponent={submitted ? <Text style={styles.empty}>{loading ? '正在搜索，请稍候…' : !targets.length ? '请先在「我的」的书源管理中导入并启用书源。' : '没有找到相关作品，可缩短关键词或切换书源。'}</Text> : undefined}
    />
    <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}><View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} accessibilityLabel="关闭书源选择" /><View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal><View style={styles.sheetHead}><Text style={styles.heading}>选择搜索书源</Text><Pressable style={styles.clear} onPress={() => setPickerOpen(false)} accessibilityRole="button" accessibilityLabel="关闭"><Text style={styles.clearText}>×</Text></Pressable></View><TextInput style={styles.pickerInput} value={pickerQuery} onChangeText={setPickerQuery} placeholder="查找已启用书源" placeholderTextColor={styles.muted.color} accessibilityLabel="查找书源" /><FlatList data={options} keyExtractor={item => item?.info.id ?? 'all'} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable style={styles.option} onPress={() => { setSourceId(item?.info.id ?? null); setPickerOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: (item?.info.id ?? null) === activeId }}><Text style={styles.optionText}>{item?.info.name ?? '全部书源'}</Text>{(item?.info.id ?? null) === activeId ? <Text style={styles.check}>✓</Text> : null}</Pressable>} ListEmptyComponent={<Text style={styles.empty}>没有匹配的书源</Text>} /></View></View></Modal>
  </View>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background }, fixed: { paddingHorizontal: 23, borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: theme.background }, searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { width: 35, height: 48, justifyContent: 'center' }, backText: { color: theme.ink, fontSize: 29 }, searchBox: { flex: 1, minWidth: 0, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.line, borderRadius: 8, backgroundColor: theme.paper, paddingHorizontal: 11 }, input: { flex: 1, minWidth: 0, height: 46, color: theme.ink, fontSize: 14 }, clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, clearText: { color: theme.muted, fontSize: 23 }, scopes: { flexDirection: 'row', gap: 7, marginLeft: 43, marginTop: 12, marginBottom: 11 }, scope: { minWidth: 48, minHeight: 34, borderWidth: 1, borderColor: theme.line, borderRadius: 6, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, activeScope: { backgroundColor: theme.secondary, borderColor: theme.secondary }, scopeText: { color: theme.muted, fontSize: 11 }, activeScopeText: { color: theme.dark, fontWeight: '700' }, list: { flex: 1 }, content: { paddingHorizontal: 23, maxWidth: 760, width: '100%', alignSelf: 'center' }, sourceSelector: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 }, sourceLabel: { flex: 1, minWidth: 0, color: theme.dark, fontSize: 12, fontWeight: '600' }, sourceCount: { color: theme.muted, fontSize: 11 }, historyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }, heading: { color: theme.ink, fontSize: 17, fontWeight: '700' }, muted: { color: theme.muted, fontSize: 11 }, dark: { color: theme.dark }, historyRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: theme.line, flexDirection: 'row', alignItems: 'center' }, historyTerm: { flex: 1, minHeight: 50, justifyContent: 'center' }, historyText: { color: theme.ink, fontSize: 13 }, caption: { color: theme.muted, fontSize: 12, marginVertical: 12 }, status: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, backgroundColor: theme.secondary }, statusText: { color: theme.dark, fontSize: 12, fontWeight: '600' }, details: { padding: 12, backgroundColor: theme.secondary, marginTop: 3 }, detailText: { color: theme.muted, fontSize: 11, lineHeight: 19, marginBottom: 5 }, retry: { minHeight: 44, justifyContent: 'center' }, retryText: { color: theme.dark, fontWeight: '700', fontSize: 12 }, empty: { color: theme.muted, textAlign: 'center', paddingVertical: 30, lineHeight: 22 }, error: { color: theme.danger, fontSize: 12, lineHeight: 19 }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#202A2766' }, sheet: { width: '100%', maxWidth: 760, maxHeight: '78%', alignSelf: 'center', backgroundColor: theme.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 23, paddingTop: 18 }, sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, pickerInput: { height: 46, borderWidth: 1, borderColor: theme.line, borderRadius: 8, paddingHorizontal: 12, color: theme.ink, marginVertical: 10 }, option: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.line }, optionText: { flex: 1, color: theme.ink, fontSize: 13 }, check: { color: theme.dark, fontSize: 18 },
});
