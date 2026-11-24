import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../components/theme';
import { BookCover } from '../../../components/BookCover';
import { Book, ChapterMeta } from '../../../domain/books';
import { useLibrary } from '../../../state/library';

export default function BookScreen() {
  const { sourceId, bookId } = useLocalSearchParams<{ sourceId: string; bookId: string }>();
  return <BookDetails key={`${sourceId}/${bookId}`} sourceId={sourceId} bookId={bookId} />;
}

function BookDetails({ sourceId, bookId }: { sourceId: string; bookId: string }) {
  const { getSource, isOnShelf, setBookOnShelf, ready, storageError, retryLoad } = useLibrary();
  const source = getSource(sourceId);
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [shelfError, setShelfError] = useState('');
  const [savingShelf, setSavingShelf] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    if (source && ready) {
      Promise.all([source.getBook(bookId), source.getChapters(bookId)]).then(([nextBook, nextChapters]) => {
        if (active) { setBook(nextBook); setChapters(nextChapters); setResolved(true); setLoadError(''); }
      }).catch(() => { if (active) { setLoadError('书籍加载失败，请返回后重试。'); setResolved(true); } });
    }
    return () => { active = false; };
  }, [source, bookId, ready]);

  if (!ready) return <View style={styles.center}><Text accessibilityRole={storageError ? 'alert' : undefined}>{storageError || '正在加载书籍…'}</Text>{storageError ? <Pressable style={styles.shelfButton} onPress={retryLoad} accessibilityRole="button"><Text style={styles.shelfText}>重试</Text></Pressable> : null}</View>;
  if (!source) return <View style={styles.center}><Text>未找到书源。请返回书源页重新导入。</Text></View>;
  if (loadError) return <View style={styles.center}><Text>{loadError}</Text></View>;
  if (!book) return <View style={styles.center}><Text>{resolved ? source.info.kind === 'legado' ? '搜索信息已过期，请返回搜索页重新搜索。' : '书籍已不存在，可能已被书源修改或移除。' : '正在加载书籍…'}</Text></View>;
  const onShelf = isOnShelf(book);
  const changeShelf = async () => {
    setShelfError(''); setSavingShelf(true);
    try { await setBookOnShelf(book, !onShelf); }
    catch (error) { setShelfError(error instanceof Error ? error.message : '保存失败，请重试。'); }
    finally { setSavingShelf(false); }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <BookCover book={book} large />
        <View style={styles.meta}><Text style={styles.title}>{book.title}</Text><Text style={styles.author}>{book.author}</Text><Text style={styles.metaLine}>{book.category} · {book.status}</Text><Text style={styles.source}>来源：{source.info.name}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>内容简介</Text>
      <Text style={styles.summary}>{book.summary}</Text>
      <View style={styles.actions}>
        {chapters[0] && <Link href={{ pathname: '/reader/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: chapters[0].id } }} asChild><Pressable style={styles.readButton}><Text style={styles.readText}>开始阅读</Text></Pressable></Link>}
        <Pressable style={[styles.shelfButton, savingShelf && styles.disabled]} onPress={changeShelf} disabled={!ready || savingShelf} accessibilityRole="button" accessibilityState={{ disabled: !ready || savingShelf, busy: savingShelf }}>
          <Text style={styles.shelfText}>{savingShelf ? '正在保存…' : onShelf ? '从书架移除' : '+ 加入书架'}</Text>
        </Pressable>
      </View>
      {shelfError ? <Text accessibilityRole="alert" style={styles.summary}>{shelfError}</Text> : null}
      <View style={styles.chapterHeading}><Text style={styles.sectionTitle}>目录</Text><Text style={styles.count}>共 {chapters.length} 章</Text></View>
      {chapters.map((chapter) => (
        <Link key={chapter.id} href={{ pathname: '/reader/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: chapter.id } }} asChild>
          <Pressable style={styles.chapter}><Text style={styles.chapterTitle}>{chapter.title}</Text><Text style={styles.chevron}>›</Text></Pressable>
        </Link>
      ))}
      {!chapters.length && <Text style={styles.summary}>{source.info.kind === 'legado' ? '当前显示搜索结果信息。此书源的在线目录与正文尚未接入。' : '暂无章节'}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, paddingBottom: 50, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', gap: 22, marginTop: 12, marginBottom: 30 },
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
  disabled: { opacity: 0.5 },
  chapterHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  count: { color: theme.muted, fontSize: 12 },
  chapter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: theme.line },
  chapterTitle: { color: theme.ink, fontSize: 14 },
  chevron: { color: theme.muted, fontSize: 24 },
});
