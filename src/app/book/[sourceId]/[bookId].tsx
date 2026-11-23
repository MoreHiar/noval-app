import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../components/theme';
import { Book, ChapterMeta } from '../../../domain/books';
import { useLibrary } from '../../../state/library';

export default function BookScreen() {
  const { sourceId, bookId } = useLocalSearchParams<{ sourceId: string; bookId: string }>();
  const { getSource, isOnShelf, toggleShelf } = useLibrary();
  const source = getSource(sourceId);
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [shelfError, setShelfError] = useState('');
  const [resolved, setResolved] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    if (source) {
      Promise.all([source.getBook(bookId), source.getChapters(bookId)]).then(([nextBook, nextChapters]) => {
        if (active) { setBook(nextBook); setChapters(nextChapters); setResolved(true); setLoadError(''); }
      }).catch(() => { if (active) { setLoadError('书籍加载失败，请返回后重试。'); setResolved(true); } });
    }
    return () => { active = false; };
  }, [source, bookId]);

  if (!source) return <View style={styles.center}><Text>未找到书源。请返回书源页重新导入。</Text></View>;
  if (loadError) return <View style={styles.center}><Text>{loadError}</Text></View>;
  if (!book) return <View style={styles.center}><Text>{resolved ? '书籍已不存在，可能已被书源修改或移除。' : '正在加载书籍…'}</Text></View>;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={[styles.cover, { backgroundColor: book.accent }]}><Text style={styles.coverTitle}>{book.title}</Text><Text style={styles.coverAuthor}>{book.author}</Text></View>
        <View style={styles.meta}><Text style={styles.title}>{book.title}</Text><Text style={styles.author}>{book.author}</Text><Text style={styles.metaLine}>{book.category} · {book.status}</Text><Text style={styles.source}>来源：{source.info.name}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>内容简介</Text>
      <Text style={styles.summary}>{book.summary}</Text>
      <View style={styles.actions}>
        {chapters[0] && <Link href={{ pathname: '/reader/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: chapters[0].id } }} asChild><Pressable style={styles.readButton}><Text style={styles.readText}>开始阅读</Text></Pressable></Link>}
        <Pressable style={styles.shelfButton} onPress={() => { setShelfError(''); toggleShelf(book).catch(error => setShelfError(error.message)); }}><Text style={styles.shelfText}>{isOnShelf(book) ? '✓ 已在书架' : '+ 加入书架'}</Text></Pressable>
      </View>
      {shelfError ? <Text accessibilityRole="alert" style={styles.summary}>{shelfError}</Text> : null}
      <View style={styles.chapterHeading}><Text style={styles.sectionTitle}>目录</Text><Text style={styles.count}>共 {chapters.length} 章</Text></View>
      {chapters.map((chapter) => (
        <Link key={chapter.id} href={{ pathname: '/reader/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: chapter.id } }} asChild>
          <Pressable style={styles.chapter}><Text style={styles.chapterTitle}>{chapter.title}</Text><Text style={styles.chevron}>›</Text></Pressable>
        </Link>
      ))}
      {!chapters.length && <Text style={styles.summary}>暂无章节</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, paddingBottom: 50, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', gap: 22, marginTop: 12, marginBottom: 30 },
  cover: { width: 120, height: 165, padding: 15, borderRadius: 10, justifyContent: 'space-between' },
  coverTitle: { color: 'white', fontWeight: '800', fontSize: 22, lineHeight: 30 },
  coverAuthor: { color: '#FFFFFFCC', fontSize: 12 },
  meta: { flex: 1, justifyContent: 'center' },
  title: { color: theme.ink, fontSize: 24, fontWeight: '800', marginBottom: 9 },
  author: { color: theme.muted, fontSize: 15, marginBottom: 15 },
  metaLine: { color: theme.accent, fontSize: 12, marginBottom: 7 },
  source: { color: theme.muted, fontSize: 11 },
  sectionTitle: { color: theme.ink, fontSize: 18, fontWeight: '800' },
  summary: { color: '#58615B', fontSize: 14, lineHeight: 24, marginTop: 12, marginBottom: 25 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 35 },
  readButton: { backgroundColor: theme.accent, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 23 },
  readText: { color: 'white', fontWeight: '700' },
  shelfButton: { backgroundColor: theme.paper, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 19, borderWidth: 1, borderColor: theme.line },
  shelfText: { color: theme.ink, fontWeight: '700' },
  chapterHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  count: { color: theme.muted, fontSize: 12 },
  chapter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: theme.line },
  chapterTitle: { color: theme.ink, fontSize: 14 },
  chevron: { color: theme.muted, fontSize: 24 },
});
