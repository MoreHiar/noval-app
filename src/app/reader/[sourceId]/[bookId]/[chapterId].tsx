import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../../components/theme';
import { Book, Chapter, ChapterMeta } from '../../../../domain/books';
import { useLibrary } from '../../../../state/library';

export default function ReaderScreen() {
  const { sourceId, bookId, chapterId } = useLocalSearchParams<{ sourceId: string; bookId: string; chapterId: string }>();
  const { getSource } = useLibrary();
  const source = getSource(sourceId);
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [resolved, setResolved] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    if (source) {
      Promise.all([source.getBook(bookId), source.getChapter(bookId, chapterId), source.getChapters(bookId)]).then(([nextBook, nextChapter, nextChapters]) => {
        if (active) { setBook(nextBook); setChapter(nextChapter); setChapters(nextChapters); setResolved(true); setLoadError(''); }
      }).catch(() => { if (active) { setLoadError('章节加载失败，请返回后重试。'); setResolved(true); } });
    }
    return () => { active = false; };
  }, [source, bookId, chapterId]);

  if (!source) return <View style={styles.center}><Text>书源不可用。请重新导入书源。</Text></View>;
  if (loadError) return <View style={styles.center}><Text>{loadError}</Text></View>;
  if (!chapter) return <View style={styles.center}><Text>{resolved ? '章节已不存在，可能已被书源修改或移除。' : '正在加载章节…'}</Text></View>;
  const index = chapters.findIndex((item) => item.id === chapter.id);
  const next = chapters[index + 1];

  return (
    <ScrollView key={chapter.id} style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.bookTitle}>{book?.title ?? '阅读'}</Text>
      <Text style={styles.title}>{chapter.title}</Text>
      <View style={styles.rule} />
      {chapter.paragraphs.map((paragraph, paragraphIndex) => <Text key={paragraphIndex} style={styles.paragraph}>{paragraph}</Text>)}
      <View style={styles.footer}>
        <Text style={styles.end}>— 本章完 —</Text>
        {next && <Pressable style={styles.nextButton} onPress={() => router.replace({ pathname: '/reader/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: next.id } })}><Text style={styles.nextText}>下一章  →</Text></Pressable>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4EEE2' },
  content: { paddingHorizontal: 24, paddingTop: 34, paddingBottom: 60, maxWidth: 680, width: '100%', alignSelf: 'center', minHeight: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bookTitle: { color: '#9A8B79', fontSize: 12, marginBottom: 12 },
  title: { color: '#302B25', fontSize: 25, fontWeight: '800', lineHeight: 36 },
  rule: { height: 1, backgroundColor: '#DDD1C1', marginTop: 23, marginBottom: 28 },
  paragraph: { color: '#39352F', fontSize: 18, lineHeight: 34, marginBottom: 23 },
  footer: { alignItems: 'center', marginTop: 24 },
  end: { color: '#A59888', fontSize: 12, marginBottom: 24 },
  nextButton: { backgroundColor: theme.accent, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 10 },
  nextText: { color: 'white', fontWeight: '700' },
});
