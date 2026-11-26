import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCarousel } from '../../components/BookCarousel';
import { BookCard } from '../../components/BookCard';
import { BrandLogo } from '../../components/BrandLogo';
import { ShelfButton } from '../../components/ShelfButton';
import { useThemedStyles, type AppTheme } from '../../components/theme';
import { Book } from '../../domain/books';
import { useLibrary } from '../../state/library';

export default function ShelfScreen() {
  const styles = useThemedStyles(createStyles);
  const { shelfBooks: books, ready, storageError, retryLoad } = useLibrary();
  const insets = useSafeAreaInsets();
  const [requestedIndex, setSelectedIndex] = useState(0);
  const [listMode, setListMode] = useState(false);
  const select = useCallback((index: number) => setSelectedIndex(index), []);

  const removeButton = (book: Book) => <ShelfButton book={book} compact removeOnly />;

  const selectedIndex = Math.min(requestedIndex, Math.max(books.length - 1, 0));
  const selectedBook = books[selectedIndex];

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}><BrandLogo size={40} /><View><Text style={styles.brand}>书架</Text><Text style={styles.brandCaption}>NOVAL  /  PERSONAL ARCHIVE</Text></View></View>
        <Link href="/discover" asChild><Pressable style={styles.searchButton} accessibilityRole="button" accessibilityLabel="搜索书籍"><Text style={styles.searchIcon}>⌕</Text></Pressable></Link>
      </View>
      <View style={styles.topRule} />
      <View style={styles.overlineRow}><Text style={styles.overline}>COLLECTION  /  READING</Text><View style={styles.overlineDot} /></View>
      <Text style={styles.heading}>立体书架</Text>
      <View style={styles.controls}>
        <Text style={styles.collection}>▧  全部书籍</Text>
        <View style={styles.controlRight}>
          <Text style={styles.count}>{books.length} 本</Text>
          <Pressable onPress={() => setListMode((current) => !current)} style={styles.modeButton} accessibilityRole="button" accessibilityLabel={listMode ? '切换立体书架' : '切换列表'}><Text style={styles.modeIcon}>{listMode ? '▥' : '☷'}</Text></Pressable>
        </View>
      </View>
      {!ready ? (
        <View style={styles.empty}>
          <Text accessibilityRole={storageError ? 'alert' : undefined} style={styles.emptyBody}>{storageError || '正在加载书架…'}</Text>
          {storageError ? <Pressable style={styles.emptyButton} onPress={retryLoad} accessibilityRole="button"><Text style={styles.emptyButtonText}>重试</Text></Pressable> : null}
        </View>
      ) : books.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>书架还空着</Text>
          <Text style={styles.emptyBody}>搜索喜欢的书籍，在详情页加入书架。</Text>
          <Link href="/discover" asChild><Pressable style={styles.emptyButton}><Text style={styles.emptyButtonText}>探索书库 →</Text></Pressable></Link>
        </View>
      ) : listMode ? (
        <View style={styles.list}>{books.map((book) => <View key={`${book.sourceId}/${book.id}`} style={styles.listItem}><BookCard book={book} />{removeButton(book)}</View>)}</View>
      ) : (
        <>
          <BookCarousel books={books} selectedIndex={selectedIndex} onSelect={select} />
          <View style={styles.pagination}>
            <Pressable style={styles.arrowButton} onPress={() => select(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0} accessibilityRole="button" accessibilityLabel="上一本"><Text style={styles.arrowText}>‹</Text></Pressable>
            <View style={styles.dots}>{books.map((book, index) => <Pressable key={`${book.sourceId}/${book.id}`} onPress={() => select(index)} accessibilityRole="button" accessibilityLabel={`切换到${book.title}`} style={index === selectedIndex ? styles.activeDot : styles.dot} />)}</View>
            <Pressable style={styles.arrowButton} onPress={() => select(Math.min(books.length - 1, selectedIndex + 1))} disabled={selectedIndex === books.length - 1} accessibilityRole="button" accessibilityLabel="下一本"><Text style={styles.arrowText}>›</Text></Pressable>
          </View>
          {selectedBook && <Link href={{ pathname: '/book/[sourceId]/[bookId]', params: { sourceId: selectedBook.sourceId, bookId: selectedBook.id } }} asChild>
            <Pressable style={styles.featured} accessibilityRole="button" accessibilityLabel={`查看${selectedBook.title}`}>
              <View style={styles.featuredCopy}>
                <Text style={styles.featuredLabel}>FEATURED  /  {String(selectedIndex + 1).padStart(2, '0')}</Text>
                <Text style={styles.featuredTitle} numberOfLines={2}>{selectedBook.title}</Text>
                <Text style={styles.featuredMeta}>{selectedBook.author}  ·  {selectedBook.status}</Text>
              </View>
              <View style={styles.featuredArrow}><Text style={styles.featuredArrowText}>↗</Text></View>
            </Pressable>
          </Link>}
          {selectedBook ? removeButton(selectedBook) : null}
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { maxWidth: 760, width: '100%', alignSelf: 'center', paddingHorizontal: 21, paddingBottom: 130 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 45 },
  brand: { color: theme.ink, fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandCaption: { color: theme.muted, fontSize: 8, letterSpacing: 2, marginTop: 2 },
  searchButton: { width: 37, height: 37, borderRadius: 19, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center', shadowColor: '#9A9B93', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  searchIcon: { color: theme.ink, fontSize: 25, lineHeight: 29 },
  topRule: { height: 1, backgroundColor: theme.line, marginTop: 16, marginBottom: 21 },
  overlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  overline: { color: theme.muted, fontSize: 9, letterSpacing: 2 },
  overlineDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.muted },
  heading: { color: theme.ink, fontSize: 25, fontWeight: '800', marginBottom: 17 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.line },
  collection: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  controlRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  count: { color: theme.muted, fontSize: 11 },
  modeButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  modeIcon: { color: theme.ink, fontSize: 20 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: -5, marginBottom: 11, gap: 14 },
  arrowButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  arrowText: { color: theme.muted, fontSize: 26, lineHeight: 29 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.line },
  activeDot: { width: 13, height: 3, borderRadius: 2, backgroundColor: theme.ink },
  featured: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.line },
  featuredCopy: { flex: 1, paddingRight: 15 },
  featuredLabel: { color: theme.muted, fontSize: 9, letterSpacing: 2, marginBottom: 7 },
  featuredTitle: { color: theme.ink, fontSize: 19, fontWeight: '800', lineHeight: 26, marginBottom: 5 },
  featuredMeta: { color: theme.muted, fontSize: 11 },
  featuredArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: theme.line },
  featuredArrowText: { color: theme.ink, fontSize: 20 },
  list: { marginTop: 20 },
  listItem: { marginBottom: 14 },
  removeButton: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  removeText: { color: theme.muted, fontSize: 13 },
  error: { color: theme.danger, fontSize: 13, marginTop: 12 },
  empty: { alignItems: 'center', paddingTop: 85, paddingBottom: 70 },
  emptyTitle: { color: theme.ink, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  emptyBody: { color: theme.muted, fontSize: 13, marginBottom: 22 },
  emptyButton: { backgroundColor: theme.dark, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  emptyButtonText: { color: 'white', fontWeight: '700' },
});
