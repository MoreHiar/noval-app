import { useAppTheme } from '../../../state/appearance';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type AppTheme } from '../../../components/theme';
import { BookCover } from '../../../components/BookCover';
import { ShelfButton } from '../../../components/ShelfButton';
import type { Book, ChapterMeta, ReadingProgress } from '../../../domain/books';
import { useLibrary } from '../../../state/library';
import { loadReadingProgress } from '../../../storage/library';

export default function BookScreen() {
  const { sourceId, bookId } = useLocalSearchParams<{ sourceId: string; bookId: string }>();
  return <BookDetails key={`${sourceId}/${bookId}`} sourceId={sourceId} bookId={bookId} />;
}

function BookDetails({ sourceId, bookId }: { sourceId: string; bookId: string }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useAppTheme();
  const { getSource, ready, storageError, retryLoad } = useLibrary();
  const source = getSource(sourceId);
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [bookError, setBookError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!source || !ready) return;
    const controller = new AbortController();
    const signal = controller.signal;
    source.getBook(bookId, signal).then(value => {
      if (!signal.aborted) { setBook(value); setBookError(value ? '' : '未找到书籍信息，请返回后重新搜索。'); }
    }).catch(cause => { if (!signal.aborted) setBookError(cause instanceof Error ? cause.message : '书籍加载失败，请重试。'); });
    source.getChapters(bookId, signal).then(value => {
      if (!signal.aborted) { setChapters(value); setCatalogLoaded(true); setCatalogError(''); }
    }).catch(cause => { if (!signal.aborted) { setCatalogError(cause instanceof Error ? cause.message : '目录加载失败，请重试。'); setCatalogLoaded(true); } });
    return () => controller.abort();
  }, [source, ready, bookId, attempt]);

  useFocusEffect(useCallback(() => {
    if (!ready) return;
    let active = true;
    loadReadingProgress(sourceId, bookId).then(value => { if (active) { setProgress(value); setProgressError(''); } })
      .catch(() => { if (active) setProgressError('无法读取阅读进度，请稍后重试。'); });
    return () => { active = false; };
  }, [ready, sourceId, bookId]));

  const retry = () => { setCatalogLoaded(false); setCatalogError(''); setBookError(''); setAttempt(current => current + 1); };
  if (!ready || !source || bookError || !book) return <View style={styles.center}>
    <Text style={styles.message}>{storageError || bookError || (!ready ? '正在加载书籍…' : !source ? '未找到书源，请返回书源页。' : '正在加载书籍…')}</Text>
    {storageError || bookError ? <Pressable style={styles.retry} onPress={storageError ? retryLoad : retry} accessibilityRole="button"><Text style={styles.retryText}>重新加载</Text></Pressable> : null}
  </View>;
  const resumeChapter = progress ? chapters.find(chapter => chapter.id === progress.chapterId && !chapter.locked) : undefined;
  const start = resumeChapter ?? chapters.find(chapter => !chapter.locked);
  const readerLink = (chapter: ChapterMeta, offset = 0) => ({ pathname: '/reader/[sourceId]/[bookId]/[chapterId]' as const, params: { sourceId, bookId, chapterId: chapter.id, offset: String(offset) } });

  return <FlatList
    style={styles.page} contentContainerStyle={styles.content} data={chapters} keyExtractor={chapter => chapter.id}
    initialNumToRender={16} maxToRenderPerBatch={16} windowSize={9}
    ListHeaderComponent={<>
      <View style={styles.head}>
        <BookCover book={book} large />
        <View style={styles.meta}><Text style={styles.title}>{book.title}</Text><Text style={styles.author}>{book.author}</Text><Text style={styles.metaLine}>{book.category} · {book.status}</Text><Text style={styles.source}>来源：{source.info.name}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>内容简介</Text><Text style={styles.summary}>{book.summary || '暂无简介'}</Text>
      <View style={styles.actions}>
        {start ? <Link href={readerLink(start, resumeChapter ? progress!.offset : 0)} asChild><Pressable style={styles.readButton} accessibilityRole="button"><Text style={styles.readText}>{resumeChapter ? '继续阅读' : '开始阅读'}</Text><Text style={styles.readArrow}>↗</Text></Pressable></Link> : null}
        <ShelfButton book={book} />
      </View>
      {resumeChapter ? <Text style={styles.progress}>上次读到 · {resumeChapter.title}</Text> : null}
      {progressError ? <Text accessibilityRole="alert" style={styles.error}>{progressError}</Text> : null}
      <View style={styles.chapterHeading}><View><Text style={styles.sectionTitle}>章节目录</Text><Text style={styles.count}>{catalogLoaded ? `共 ${chapters.length} 章` : '正在加载目录'}</Text></View>
        <Pressable style={styles.refresh} onPress={retry} disabled={!catalogLoaded} accessibilityRole="button" accessibilityLabel="刷新目录"><Text style={styles.refreshText}>↻ 刷新</Text></Pressable>
      </View>
      {catalogError ? <View style={styles.catalogError}><Text accessibilityRole="alert" style={styles.error}>{catalogError}</Text><Pressable style={styles.retry} onPress={retry} accessibilityRole="button"><Text style={styles.retryText}>重试目录</Text></Pressable></View> : null}
    </>}
    renderItem={({ item: chapter, index }) => {
      const row = <><Text style={styles.chapterIndex}>{String(index + 1).padStart(2, '0')}</Text><Text style={[styles.chapterTitle, resumeChapter?.id === chapter.id && styles.activeChapter]} numberOfLines={2}>{chapter.volume ? `${chapter.volume} · ` : ''}{chapter.title}</Text><Text style={styles.chevron}>{chapter.locked ? '锁定' : '›'}</Text></>;
      return chapter.locked ? <View style={[styles.chapter, styles.locked]} accessibilityLabel={`${chapter.title}，需要在书源官方网站解锁`}>{row}</View> : <Link href={readerLink(chapter)} asChild><Pressable style={styles.chapter} accessibilityRole="button" accessibilityLabel={`阅读${chapter.title}`}>{row}</Pressable></Link>;
    }}
    ListEmptyComponent={!catalogLoaded ? <View style={styles.empty}><ActivityIndicator color={theme.accent} /><Text style={styles.message}>正在获取章节目录…</Text></View> : !catalogError ? <Text style={styles.summary}>{source.info.kind === 'legado' ? '此书源暂未提供可阅读的章节目录。' : '暂无章节'}</Text> : undefined}
  />;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, paddingBottom: 50, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
  message: { color: theme.muted, lineHeight: 24, textAlign: 'center' },
  head: { flexDirection: 'row', gap: 22, marginTop: 12, marginBottom: 30 },
  meta: { flex: 1, justifyContent: 'center' },
  title: { color: theme.ink, fontSize: 24, fontWeight: '800', marginBottom: 9 },
  author: { color: theme.muted, fontSize: 15, marginBottom: 15 },
  metaLine: { color: theme.accent, fontSize: 12, marginBottom: 7 },
  source: { color: theme.muted, fontSize: 11 },
  sectionTitle: { color: theme.ink, fontSize: 18, fontWeight: '800' },
  summary: { color: theme.muted, fontSize: 14, lineHeight: 24, marginTop: 12, marginBottom: 25 },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' },
  readButton: { minHeight: 48, backgroundColor: theme.dark, borderRadius: 14, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 22 },
  readText: { color: 'white', fontWeight: '700', fontSize: 14 },
  readArrow: { color: '#D0DACD', fontSize: 20 },
  progress: { color: theme.muted, fontSize: 12, marginTop: 12 },
  chapterHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 8 },
  count: { color: theme.muted, fontSize: 12, marginTop: 5 },
  refresh: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  refreshText: { color: theme.accent, fontSize: 13 },
  chapter: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 12 },
  chapterIndex: { color: theme.muted, fontSize: 11, minWidth: 30, fontVariant: ['tabular-nums'] },
  chapterTitle: { flex: 1, color: theme.ink, fontSize: 14, lineHeight: 22 },
  activeChapter: { color: theme.accent, fontWeight: '700' },
  chevron: { color: theme.muted, fontSize: 13 },
  locked: { opacity: 0.55 },
  retry: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', alignSelf: 'center', backgroundColor: theme.secondary, borderRadius: 12, marginTop: 10 },
  retryText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  error: { color: theme.danger, fontSize: 13, lineHeight: 22 },
  catalogError: { paddingVertical: 16 },
  empty: { padding: 30, alignItems: 'center', gap: 16 },
});
