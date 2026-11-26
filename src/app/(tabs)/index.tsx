import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCarousel } from '../../components/BookCarousel';
import { BookCard } from '../../components/BookCard';
import { ShelfButton } from '../../components/ShelfButton';
import { TabBarIcon } from '../../components/TabBarIcon';
import { useThemedStyles, type AppTheme } from '../../components/theme';
import { useLibrary } from '../../state/library';

export default function ShelfScreen() {
  const styles = useThemedStyles(createStyles);
  const { shelfBooks: books, ready, storageError, retryLoad } = useLibrary();
  const insets = useSafeAreaInsets();
  const [requestedIndex, setSelectedIndex] = useState(0);
  const [listMode, setListMode] = useState(false);
  const [filter, setFilter] = useState<'all' | 'novel' | 'manga'>('all');
  const visibleBooks = books.filter(book => filter === 'all' || (book.mediaType ?? 'novel') === filter);
  const select = useCallback((index: number) => setSelectedIndex(index), []);
  const selectedIndex = Math.min(requestedIndex, Math.max(visibleBooks.length - 1, 0));
  const selectedBook = visibleBooks[selectedIndex];
  return <FlatList
    style={styles.page}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + 19, paddingBottom: Math.max(insets.bottom + 120, 132) }]}
    showsVerticalScrollIndicator={false}
    data={ready && listMode ? visibleBooks : []}
    keyExtractor={book => `${book.sourceId}/${book.id}`}
    renderItem={({ item }) => <View style={styles.listItem}><BookCard book={item} compact /><ShelfButton book={item} compact removeOnly /></View>}
    ListHeaderComponent={<>
      <View style={styles.topRow}>
        <View><Text style={styles.kicker}>NOVAL / 把故事带在身边</Text><Text style={styles.title}>我的书架</Text></View>
        <Pressable style={styles.searchButton} onPress={() => router.push({ pathname: '/search', params: { scope: 'all', entry: String(Date.now()) } })} accessibilityRole="button" accessibilityLabel="搜索书籍"><TabBarIcon name="search" color={styles.iconColor.color} size={21} /></Pressable>
      </View>
      <View style={styles.filters}>{([{ key: 'all', label: '全部' }, { key: 'novel', label: '小说' }, { key: 'manga', label: '漫画' }] as const).map(item => <Pressable key={item.key} style={[styles.filter, filter === item.key && styles.activeFilter]} onPress={() => { setFilter(item.key); setSelectedIndex(0); }} accessibilityRole="button" accessibilityState={{ selected: filter === item.key }}><Text style={[styles.filterText, filter === item.key && styles.activeFilterText]}>{item.label}</Text></Pressable>)}</View>
      <View style={styles.rule} />
      <View style={styles.intro}>
        <View><Text style={styles.introTitle}>一书一世界</Text><Text style={styles.introHint}>{filter === 'all' ? '全部' : filter === 'manga' ? '漫画' : '小说'}收藏 · {visibleBooks.length} 本</Text></View>
        <View style={styles.viewToggle} accessibilityLabel="书架视图">
          <Pressable style={[styles.toggle, !listMode && styles.activeToggle]} onPress={() => setListMode(false)} accessibilityRole="button" accessibilityLabel="立体视图" accessibilityState={{ selected: !listMode }}><TabBarIcon name="bookshelf" color={!listMode ? styles.iconColor.color : styles.mutedIcon.color} size={20} /></Pressable>
          <Pressable style={[styles.toggle, listMode && styles.activeToggle]} onPress={() => setListMode(true)} accessibilityRole="button" accessibilityLabel="列表视图" accessibilityState={{ selected: listMode }}><Text style={[styles.toggleText, listMode && styles.activeToggleText]}>☷</Text></Pressable>
        </View>
      </View>
      {!ready ? <View style={styles.empty}>
        <Text accessibilityRole={storageError ? 'alert' : undefined} style={styles.emptyBody}>{storageError || '正在加载书架…'}</Text>
        {storageError ? <Pressable style={styles.primaryButton} onPress={retryLoad} accessibilityRole="button"><Text style={styles.primaryText}>重试</Text></Pressable> : null}
      </View> : visibleBooks.length === 0 ? <View style={styles.empty}>
        <View style={styles.emptyMark}><TabBarIcon name="bookshelf" color={styles.iconColor.color} size={31} /></View>
        <Text style={styles.emptyTitle}>下一段故事，等你发现</Text>
        <Text style={styles.emptyBody}>搜索喜欢的书名或作者，{`\n`}在详情页将它加入书架。</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: '/search', params: { scope: filter, entry: String(Date.now()) } })} accessibilityRole="button"><Text style={styles.primaryText}>⌕  搜索好书</Text></Pressable>
      </View> : listMode ? null : <>
        <BookCarousel books={visibleBooks} selectedIndex={selectedIndex} onSelect={select} />
        <View style={styles.pagination}>
          <Pressable style={styles.arrowButton} onPress={() => select(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0} accessibilityRole="button" accessibilityLabel="上一本"><Text style={styles.arrowText}>‹</Text></Pressable>
          {visibleBooks.length <= 7 ? <View style={styles.dots}>{visibleBooks.map((book, index) => <Pressable key={`${book.sourceId}/${book.id}`} onPress={() => select(index)} accessibilityRole="button" accessibilityLabel={`切换到${book.title}`} style={[styles.dotTarget, index === selectedIndex ? styles.activeDot : styles.dot]} />)}</View> : <Text style={styles.pageCount}>{selectedIndex + 1} / {visibleBooks.length}</Text>}
          <Pressable style={styles.arrowButton} onPress={() => select(Math.min(visibleBooks.length - 1, selectedIndex + 1))} disabled={selectedIndex === visibleBooks.length - 1} accessibilityRole="button" accessibilityLabel="下一本"><Text style={styles.arrowText}>›</Text></Pressable>
        </View>
        {selectedBook ? <View style={styles.featured}>
          <Text style={styles.statusPill}>{selectedBook.mediaType === 'manga' ? '漫画' : '小说'} · {selectedBook.category} · {selectedBook.status}</Text>
          <Text style={styles.featuredTitle} numberOfLines={2}>{selectedBook.title}</Text>
          <Text style={styles.featuredMeta}>{selectedBook.author} 著</Text>
          <Link href={{ pathname: '/book/[sourceId]/[bookId]', params: { sourceId: selectedBook.sourceId, bookId: selectedBook.id } }} asChild>
            <Pressable style={styles.fullButton} accessibilityRole="button" accessibilityLabel={`查看${selectedBook.title}`}><Text style={styles.primaryText}>查看书籍  →</Text></Pressable>
          </Link>
          <ShelfButton book={selectedBook} compact removeOnly />
        </View> : null}
      </>}
    </>}
  />;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: 24, maxWidth: 760, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
  kicker: { color: theme.muted, fontSize: 10, letterSpacing: 1.4, marginBottom: 7 },
  title: { color: theme.ink, fontSize: 27, lineHeight: 36, fontWeight: '700' },
  searchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', backgroundColor: theme.secondary, borderRadius: 8, padding: 3, marginTop: 16 },
  filter: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  activeFilter: { backgroundColor: theme.paper },
  filterText: { color: theme.muted, fontSize: 12 }, activeFilterText: { color: theme.dark, fontWeight: '700' },
  iconColor: { color: theme.dark }, mutedIcon: { color: theme.muted },
  rule: { height: 1, backgroundColor: theme.line, marginTop: 22, marginBottom: 24 },
  intro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13, gap: 12 },
  introTitle: { color: theme.ink, fontSize: 22, lineHeight: 30, fontFamily: 'serif' },
  introHint: { color: theme.muted, fontSize: 12, marginTop: 3 },
  viewToggle: { flexDirection: 'row', backgroundColor: theme.secondary, borderRadius: 12, padding: 3 },
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  activeToggle: { backgroundColor: theme.paper, shadowColor: '#304234', shadowOpacity: 0.08, shadowRadius: 4 },
  toggleText: { color: theme.muted, fontSize: 23 }, activeToggleText: { color: theme.dark },
  empty: { alignItems: 'center', paddingTop: 72, paddingBottom: 60 },
  emptyMark: { width: 72, height: 72, borderRadius: 21, backgroundColor: theme.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { color: theme.ink, fontSize: 21, fontFamily: 'serif', textAlign: 'center', marginBottom: 15 },
  emptyBody: { color: theme.muted, fontSize: 13, lineHeight: 23, textAlign: 'center', marginBottom: 22 },
  primaryButton: { minHeight: 50, paddingHorizontal: 22, backgroundColor: theme.dark, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: -17, gap: 10, marginBottom: 8 },
  arrowButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: theme.muted, fontSize: 24, lineHeight: 28 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pageCount: { minWidth: 52, textAlign: 'center', color: theme.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  dotTarget: { height: 24, marginHorizontal: 1 },
  dot: { width: 5, borderRadius: 3, backgroundColor: theme.line },
  activeDot: { width: 20, borderRadius: 3, backgroundColor: theme.dark },
  featured: { alignItems: 'center', paddingTop: 4 },
  statusPill: { color: theme.dark, backgroundColor: theme.successSoft, fontSize: 11, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, overflow: 'hidden' },
  featuredTitle: { color: theme.ink, fontSize: 23, fontFamily: 'serif', marginTop: 13, textAlign: 'center' },
  featuredMeta: { color: theme.muted, fontSize: 12, marginTop: 8, marginBottom: 20 },
  fullButton: { width: '100%', minHeight: 50, backgroundColor: theme.dark, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.line, minHeight: 132, gap: 6 },
});
