import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book, Chapter, ChapterMeta } from '../../../../domain/books';
import { loadReaderFont } from '../../../../reader/font';
import { pageAtOffset, paginateMeasuredLines, paginateText, ReadingPage, readingText, swipeDirection, turnDestination } from '../../../../reader/pagination';
import { useLibrary } from '../../../../state/library';
import { loadReadingProgress, saveReadingProgress } from '../../../../storage/library';

type ReaderParams = { sourceId: string; bookId: string; chapterId: string; offset?: string; position?: string };
type LoadedChapter = { book: Book | null; chapter: Chapter; chapters: ChapterMeta[]; fontFamily?: string; offset: number };

export default function ReaderScreen() {
  const params = useLocalSearchParams<ReaderParams>();
  const [attempt, setAttempt] = useState(0);
  return <ReaderSession key={`${params.sourceId}/${params.bookId}/${params.chapterId}/${params.offset ?? ''}/${params.position ?? ''}/${attempt}`} params={params} retry={() => setAttempt(current => current + 1)} />;
}

function ReaderSession({ params, retry }: { params: ReaderParams; retry(): void }) {
  const { sourceId, bookId, chapterId, offset, position } = params;
  const { getSource, ready, storageError, retryLoad } = useLibrary();
  const source = getSource(sourceId);
  const [result, setResult] = useState<LoadedChapter | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!source || !ready) return;
    const controller = new AbortController();
    const signal = controller.signal;
    (async () => {
      const [book, chapters, progress] = await Promise.all([source.getBook(bookId, signal), source.getChapters(bookId, signal), loadReadingProgress(sourceId, bookId)]);
      const chapter = await source.getChapter(bookId, chapterId, signal);
      if (!chapter || !chapter.paragraphs.length) throw new Error('章节不存在或没有可阅读的正文。');
      const fontFamily = chapter.fontUrl ? await loadReaderFont(chapter.fontUrl) : undefined;
      const requested = offset !== undefined ? Number(offset) : progress?.chapterId === chapterId ? progress.offset : 0;
      if (!signal.aborted) setResult({ book, chapter, chapters, fontFamily, offset: position === 'end' ? Number.MAX_SAFE_INTEGER : Number.isSafeInteger(requested) && requested >= 0 ? requested : 0 });
    })().catch(cause => { if (!signal.aborted) setError(cause instanceof Error ? cause.message : '章节加载失败，请重试。'); });
    return () => controller.abort();
  }, [source, ready, sourceId, bookId, chapterId, offset, position]);

  if (!ready || !source || error) return <View style={styles.center}><Text style={styles.message}>{storageError || error || (!ready ? '正在加载阅读数据…' : '书源不可用，请返回书架。')}</Text>{storageError || error ? <Pressable style={styles.retry} onPress={storageError ? retryLoad : retry} accessibilityRole="button"><Text>重试</Text></Pressable> : null}</View>;
  if (!result) return <View style={styles.center}><ActivityIndicator color="#526C63" /><Text style={styles.message}>正在加载章节…</Text></View>;
  return <ReadingCanvas key={result.chapter.id} data={result} sourceId={sourceId} bookId={bookId} />;
}

function ReadingCanvas({ data, sourceId, bookId }: { data: LoadedChapter; sourceId: string; bookId: string }) {
  const { book, chapter, chapters, fontFamily } = data;
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState(data.offset);
  const [measured, setMeasured] = useState<{ key: string; pages: ReadingPage[] } | null>(null);
  const [turning, setTurning] = useState(false);
  const [progressError, setProgressError] = useState('');
  const text = useMemo(() => readingText(chapter.paragraphs), [chapter.paragraphs]);
  const linesPerPage = Math.max(1, Math.floor((size.height - 4) / (34 * fontScale)));
  const measurementKey = `${size.width}/${size.height}/${fontScale}/${fontFamily ?? ''}`;
  const fallback = useMemo(() => paginateText(text, Math.floor(size.width / (18 * fontScale)), linesPerPage), [text, size.width, fontScale, linesPerPage]);
  const pages = measured?.key === measurementKey ? measured.pages : fallback;
  const pageIndex = pageAtOffset(pages, offset);
  const page = pages[pageIndex];
  const chapterIndex = chapters.findIndex(item => item.id === chapter.id);
  const previous = chapterIndex > 0 ? chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex >= 0 ? chapters[chapterIndex + 1] : undefined;
  const positioned = size.width > 0 && size.height > 0 && (Platform.OS === 'web' || measured?.key === measurementKey);

  useEffect(() => {
    if (!positioned) return;
    let saved = false;
    const progress = { sourceId, bookId, chapterId: chapter.id, chapterTitle: chapter.title, offset: page.start, updatedAt: Date.now() };
    const save = () => {
      if (saved) return;
      saved = true;
      saveReadingProgress(progress).catch(() => setProgressError('阅读进度保存失败，请检查存储空间。'));
    };
    const timer = setTimeout(save, 400);
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') save(); });
    return () => { clearTimeout(timer); subscription.remove(); save(); };
  }, [sourceId, bookId, chapter.id, chapter.title, page.start, positioned]);

  const turn = useCallback(async (direction: 1 | -1) => {
    if (turning || !positioned) return;
    const destination = turnDestination(pageIndex, pages.length, chapterIndex, chapters.length, direction);
    if (destination.kind === 'page') { setOffset(pages[destination.index].start); return; }
    if (destination.kind === 'boundary') return;
    const adjacent = chapters[destination.index];
    setTurning(true);
    try {
      await saveReadingProgress({ sourceId, bookId, chapterId: chapter.id, chapterTitle: chapter.title, offset: page.start, updatedAt: Date.now() });
      router.replace({ pathname: '/reader/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: adjacent.id, ...(direction === -1 ? { position: 'end' } : { offset: '0' }) } });
    } catch { setProgressError('阅读进度保存失败，请重试。'); setTurning(false); }
  }, [turning, positioned, pageIndex, pages, chapterIndex, chapters, sourceId, bookId, chapter.id, chapter.title, page.start]);

  const gesture = useMemo(() => PanResponder.create({
    // Own the touch from its start so short swipes retain their full distance.
    onStartShouldSetPanResponder: () => !turning,
    onMoveShouldSetPanResponder: (_, state) => !turning && state.numberActiveTouches === 1 && Math.abs(state.dx) > 12 && Math.abs(state.dx) > Math.abs(state.dy) * 1.4,
    onPanResponderRelease: (_, state) => { const direction = swipeDirection(state.dx, state.dy, state.vx, size.width); if (direction) void turn(direction); },
    onPanResponderTerminationRequest: () => true,
  }), [turn, turning, size.width]);

  return (
    <View style={[styles.page, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.header}><Text style={styles.bookTitle} numberOfLines={1}>{book?.title ?? '阅读'}</Text><Text style={styles.chapterTitle} numberOfLines={2}>{chapter.title}</Text><View style={styles.rule} /></View>
      <View style={styles.body}>
        <View style={styles.viewport} onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setSize(current => current.width === width && current.height === height ? current : { width, height });
        }} {...gesture.panHandlers}>
          {positioned ? <Text selectable={false} style={[styles.bodyText, { fontFamily }]}>{page.text}</Text> : <ActivityIndicator color="#526C63" />}
          {Platform.OS !== 'web' && size.width > 0 && size.height > 0 && measured?.key !== measurementKey ? (
            <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.measure}>
              <Text style={[styles.bodyText, { fontFamily }]} onTextLayout={event => {
                const computed = paginateMeasuredLines(text, event.nativeEvent.lines, linesPerPage) ?? fallback;
                setMeasured({ key: measurementKey, pages: computed });
              }}>{text}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {progressError ? <Text accessibilityRole="alert" style={styles.error}>{progressError}</Text> : null}
      <View style={styles.footer}>
        <Pressable onPress={() => turn(-1)} disabled={turning || !positioned || (pageIndex === 0 && !previous)} accessibilityRole="button" accessibilityLabel="上一页" style={({ pressed }) => [styles.pageButton, pressed && styles.pressed]}><Text style={styles.buttonText}>{pageIndex === 0 ? previous ? '‹ 上一章' : '已是开篇' : '‹ 上一页'}</Text></Pressable>
        <View style={styles.pageCount}><Text style={styles.pageNumber}>{positioned ? `${pageIndex + 1} / ${pages.length}` : '正在分页'}</Text><Text style={styles.chapterNumber}>{chapterIndex >= 0 ? `第 ${chapterIndex + 1} / ${chapters.length} 章` : '左右滑动翻页'}</Text></View>
        <Pressable onPress={() => turn(1)} disabled={turning || !positioned || (pageIndex === pages.length - 1 && !next)} accessibilityRole="button" accessibilityLabel="下一页" style={({ pressed }) => [styles.pageButton, pressed && styles.pressed]}><Text style={styles.buttonText}>{pageIndex === pages.length - 1 ? next ? '下一章 ›' : '已到末章' : '下一页 ›'}</Text></Pressable>
      </View>
      <Text style={styles.hint}>{turning ? '正在切换章节…' : '左滑下一页 · 右滑上一页'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4EEE2' },
  center: { flex: 1, backgroundColor: '#F4EEE2', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  message: { color: '#706455', textAlign: 'center', lineHeight: 24 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 22, backgroundColor: '#E7DECF', borderRadius: 12 },
  header: { paddingTop: 16, paddingHorizontal: 24, maxWidth: 680, width: '100%', alignSelf: 'center' },
  bookTitle: { color: '#9A8B79', fontSize: 12, marginBottom: 8 },
  chapterTitle: { color: '#302B25', fontSize: 21, fontWeight: '700', lineHeight: 30 },
  rule: { height: 1, backgroundColor: '#DDD1C1', marginTop: 14, marginBottom: 18 },
  body: { flex: 1, paddingHorizontal: 24, maxWidth: 680, width: '100%', alignSelf: 'center' },
  viewport: { flex: 1, overflow: 'hidden' },
  bodyText: { color: '#39352F', fontSize: 18, lineHeight: 34, fontWeight: '400' },
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10, maxWidth: 680, width: '100%', alignSelf: 'center' },
  pageButton: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  buttonText: { color: '#6B614F', fontSize: 13 },
  pageCount: { alignItems: 'center', gap: 4 },
  pageNumber: { color: '#5E5547', fontSize: 13, fontVariant: ['tabular-nums'] },
  chapterNumber: { color: '#958875', fontSize: 10 },
  hint: { color: '#A99A85', textAlign: 'center', fontSize: 10, marginTop: 2 },
  error: { color: '#A44036', fontSize: 12, textAlign: 'center', paddingHorizontal: 24, paddingTop: 8 },
  pressed: { opacity: 0.5 },
});
