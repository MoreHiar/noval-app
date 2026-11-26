import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCard } from './BookCard';
import { TabBarIcon } from './TabBarIcon';
import { useThemedStyles, type AppTheme } from './theme';
import type { Book, SourceAdapter } from '../domain/books';
import { useLibrary } from '../state/library';

export function CategoryScreen({ mediaType }: { mediaType: 'novel' | 'manga' }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { enabledSources, ready } = useLibrary();
  const source = useMemo(() => enabledSources.find(item => (item.info.mediaType ?? 'novel') === mediaType && item.discover), [enabledSources, mediaType]);
  const [result, setResult] = useState<{ source: SourceAdapter | null; attempt: number; books: Book[]; error: string }>({ source: null, attempt: -1, books: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready || !source?.discover) return;
    const controller = new AbortController();
    source.discover(controller.signal).then(items => { if (!controller.signal.aborted) setResult({ source, attempt, books: items, error: '' }); })
      .catch(cause => { if (!controller.signal.aborted) setResult({ source, attempt, books: [], error: cause instanceof Error ? cause.message : '推荐加载失败。' }); });
    return () => controller.abort();
  }, [ready, source, attempt]);
  const title = mediaType === 'manga' ? '漫画' : '小说';
  const current = result.source === source && result.attempt === attempt;
  const books = current ? result.books : [];
  const error = current ? result.error : '';
  const loading = !current;
  const lead = books[0];
  return <FlatList
    style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom + 116, 130) }]}
    data={books.slice(1)} keyExtractor={item => `${item.sourceId}/${item.id}`} renderItem={({ item }) => <BookCard book={item} sourceName={source?.info.name} />}
    ListHeaderComponent={<>
      <View style={styles.heading}><Text style={styles.kicker}>{mediaType === 'manga' ? '画面里的另一种旅程' : '把下一本好书，放在眼前'}</Text><Text style={styles.title}>{title}</Text></View>
      <Pressable style={styles.searchEntry} onPress={() => router.push({ pathname: '/search', params: { scope: mediaType, entry: String(Date.now()) } })} accessibilityRole="button" accessibilityLabel={`搜索${title}`}><TabBarIcon name="search" color={styles.muted.color} size={19} /><Text style={styles.searchText}>搜索{title}名称或作者</Text><Text style={styles.searchAction}>搜索</Text></Pressable>
      <View style={styles.sourceStrip}><View style={styles.sourceAvatar}><Text style={styles.sourceAvatarText}>{mediaType === 'manga' ? '漫' : '文'}</Text></View><View style={styles.sourceCopy}><Text style={styles.sourceTitle} numberOfLines={1}>{source?.info.name ?? `暂无可用的${title}推荐源`}</Text><Text style={styles.sourceSubtitle}>{source ? '当前推荐书源' : mediaType === 'manga' ? '请添加并启用图片书源' : '当前书源没有可运行的发现规则'}</Text></View><Pressable style={styles.manage} onPress={() => router.push('/source')} accessibilityRole="button"><Text style={styles.manageText}>管理 ›</Text></Pressable></View>
      {!ready || (source && loading) ? <View style={styles.empty}><ActivityIndicator color={styles.dark.color} /><Text style={styles.emptyBody}>正在获取推荐…</Text></View> : error ? <View style={styles.empty}><Text style={styles.emptyTitle}>推荐暂时无法加载</Text><Text style={styles.emptyBody}>{error}</Text><Pressable style={styles.action} onPress={() => setAttempt(value => value + 1)} accessibilityRole="button"><Text style={styles.actionText}>重新加载</Text></Pressable></View> : !source || !lead ? <View style={styles.empty}><View style={styles.emptyMark}><TabBarIcon name={mediaType === 'manga' ? 'comics' : 'novels'} color={styles.dark.color} size={28} /></View><Text style={styles.emptyTitle}>{mediaType === 'manga' ? '漫画书源，等待加入' : '暂时没有小说推荐'}</Text><Text style={styles.emptyBody}>{source ? '当前书源没有返回推荐内容。' : mediaType === 'manga' ? '添加支持发现规则的图片书源后，这里将展示可读取的内容。' : '搜索仍可使用；可在书源管理中添加支持发现规则的小说源。'}</Text><Pressable style={styles.action} onPress={() => router.push('/source')} accessibilityRole="button"><Text style={styles.actionText}>管理书源</Text></Pressable></View> : <><View style={styles.sectionRow}><Text style={styles.sectionTitle}>为你发现</Text><Text style={styles.sectionHint}>来自当前书源</Text></View><BookCard book={lead} sourceName={source.info.name} /><View style={styles.sectionRow}><Text style={styles.sectionTitle}>继续发现</Text><Text style={styles.sectionHint}>{Math.max(books.length - 1, 0)} 本</Text></View></>}
    </>}
  />;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background }, content: { paddingHorizontal: 24, maxWidth: 760, width: '100%', alignSelf: 'center' }, heading: { marginBottom: 18 }, kicker: { color: theme.muted, fontSize: 11, marginBottom: 7 }, title: { color: theme.ink, fontSize: 27, lineHeight: 36, fontWeight: '700' }, searchEntry: { minHeight: 50, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }, searchText: { flex: 1, color: theme.muted, fontSize: 13 }, searchAction: { color: theme.muted, fontSize: 11 }, sourceStrip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.line, paddingVertical: 13 }, sourceAvatar: { width: 32, height: 32, borderRadius: 6, backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center' }, sourceAvatarText: { color: theme.dark, fontSize: 14, fontWeight: '700' }, sourceCopy: { flex: 1, minWidth: 0 }, sourceTitle: { color: theme.ink, fontSize: 12, fontWeight: '700' }, sourceSubtitle: { color: theme.muted, fontSize: 10, marginTop: 3 }, manage: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 3 }, manageText: { color: theme.dark, fontSize: 11 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 10 }, sectionTitle: { color: theme.ink, fontSize: 17, fontWeight: '700' }, sectionHint: { color: theme.muted, fontSize: 11 }, empty: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 72, paddingBottom: 30 }, emptyMark: { width: 58, height: 58, backgroundColor: theme.secondary, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }, emptyTitle: { color: theme.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' }, emptyBody: { color: theme.muted, fontSize: 12, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 18 }, action: { minHeight: 44, minWidth: 142, borderWidth: 1, borderColor: theme.line, borderRadius: 8, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center' }, actionText: { color: theme.dark, fontSize: 12, fontWeight: '700' }, muted: { color: theme.muted }, dark: { color: theme.dark },
});
