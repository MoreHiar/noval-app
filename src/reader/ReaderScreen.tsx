import { useAppTheme } from '../state/appearance';
import { useThemedStyles, type AppTheme } from '../components/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book, Chapter, ChapterMeta } from '../domain/books';
import { useLibrary } from '../state/library';
import { loadReadingProgress, saveReadingProgress } from '../storage/library';
import { loadReaderFont } from './font';
import { pageAtOffset, paginateMeasuredLines, paginateText, ReadingPage, readingText, swipeDirection, turnDestination } from './pagination';
import { ReaderControls } from './ReaderControls';
import type { ReaderPreferences } from './preferences';
import { useReaderPreferences } from './useReaderPreferences';

type ReaderParams = { sourceId: string; bookId: string; chapterId: string; offset?: string; position?: string };
type LoadedChapter = { book: Book | null; chapter: Chapter; chapters: ChapterMeta[]; fontFamily?: string; offset: number };
type PreferencesState = ReturnType<typeof useReaderPreferences>;

function backToBook(sourceId: string, bookId: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/book/[sourceId]/[bookId]', params: { sourceId, bookId } });
}

export default function ReaderScreen() {
  const { colorScheme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<ReaderParams>();
  const [attempt, setAttempt] = useState(0);
  const preferences = useReaderPreferences();
  return <View style={styles.screen}>
    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    <ReaderSession key={`${params.sourceId}/${params.bookId}/${params.chapterId}/${params.offset ?? ''}/${params.position ?? ''}/${attempt}`} params={params} preferences={preferences} retry={() => setAttempt(current => current + 1)} />
  </View>;
}

function ReaderPlaceholder({ params, message, retry }: { params: ReaderParams; message: string; retry?: () => void }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return <View style={styles.center}>
    <Pressable style={[styles.backButton, { top: insets.top + 8, left: insets.left + 12 }]} onPress={() => backToBook(params.sourceId, params.bookId)} accessibilityRole="button" accessibilityLabel="返回"><Text style={styles.backText}>‹ 返回</Text></Pressable>
    {!retry && message.includes('正在') ? <ActivityIndicator color={theme.success} /> : null}
    <Text style={styles.message}>{message}</Text>
    {retry ? <Pressable style={styles.retry} onPress={retry} accessibilityRole="button"><Text style={{ color: theme.readerInk }}>重试</Text></Pressable> : null}
  </View>;
}

function ReaderSession({ params, preferences, retry }: { params: ReaderParams; preferences: PreferencesState; retry(): void }) {
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

  if (!ready || !source || error) return <ReaderPlaceholder params={params} message={storageError || error || (!ready ? '正在加载阅读数据…' : '书源不可用，请返回书架。')} retry={storageError ? retryLoad : error ? retry : undefined} />;
  if (!result || !preferences.ready) return <ReaderPlaceholder params={params} message="正在加载章节…" />;
  return <ReadingCanvas key={result.chapter.id} data={result} sourceId={sourceId} bookId={bookId} preferencesState={preferences} />;
}

function ReadingCanvas({ data, sourceId, bookId, preferencesState }: { data: LoadedChapter; sourceId: string; bookId: string; preferencesState: PreferencesState }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { book, chapter, chapters, fontFamily } = data;
  const { preferences, update, error: preferencesError } = preferencesState;
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState(data.offset);
  const [measured, setMeasured] = useState<{ key: string; pages: ReadingPage[] } | null>(null);
  const [turning, setTurning] = useState(false);
  const navigationLock = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [transition, setTransition] = useState<{ text: string; direction: 1 | -1; mode: 'slide' | 'fade' } | null>(null);
  const [animation] = useState(() => new Animated.Value(1));
  const animationLock = useRef(false);
  const touchOrigin = useRef({ x: 0, y: 0 });
  const text = useMemo(() => readingText(chapter.paragraphs), [chapter.paragraphs]);
  const lineHeight = Math.round(preferences.fontSize * preferences.lineSpacing);
  const linesPerPage = Math.max(1, Math.floor((size.height - 4) / (lineHeight * fontScale)));
  const measurementKey = `${size.width}/${size.height}/${fontScale}/${fontFamily ?? ''}/${preferences.fontSize}/${lineHeight}`;
  const fallback = useMemo(() => paginateText(text, Math.floor(size.width / (preferences.fontSize * fontScale)), linesPerPage), [text, size.width, preferences.fontSize, fontScale, linesPerPage]);
  const pages = measured?.key === measurementKey ? measured.pages : fallback;
  const pageIndex = pageAtOffset(pages, offset);
  const page = pages[pageIndex];
  const chapterIndex = chapters.findIndex(item => item.id === chapter.id);
  const positioned = size.width > 0 && size.height > 0 && (Platform.OS === 'web' || measured?.key === measurementKey);
  const bodyTextStyle = [styles.bodyText, { fontFamily, fontSize: preferences.fontSize, lineHeight }];

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!transition) return;
    const motion = Animated.timing(animation, { toValue: 1, duration: transition.mode === 'slide' ? 220 : 180, useNativeDriver: true });
    motion.start(({ finished }) => {
      if (finished) { animationLock.current = false; setTransition(null); }
    });
    return () => motion.stop();
  }, [animation, transition]);

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

  const goToChapter = useCallback(async (adjacent: ChapterMeta, fromEnd = false) => {
    if (navigationLock.current || animationLock.current || !positioned) return;
    if (adjacent.locked) { setProgressError('此章节尚未解锁，请到书源网站解锁后阅读。'); return; }
    navigationLock.current = true;
    setTurning(true);
    try {
      await saveReadingProgress({ sourceId, bookId, chapterId: chapter.id, chapterTitle: chapter.title, offset: page.start, updatedAt: Date.now() });
      router.replace({ pathname: '/reader/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: adjacent.id, ...(fromEnd ? { position: 'end' } : { offset: '0' }) } });
    } catch { setProgressError('阅读进度保存失败，请重试。'); navigationLock.current = false; setTurning(false); }
  }, [positioned, sourceId, bookId, chapter.id, chapter.title, page.start]);

  const turn = useCallback((direction: 1 | -1) => {
    if (navigationLock.current || animationLock.current || !positioned) return;
    const destination = turnDestination(pageIndex, pages.length, chapterIndex, chapters.length, direction);
    if (destination.kind === 'page') {
      setProgressError('');
      if (preferences.animation !== 'none' && !reduceMotion) {
        animationLock.current = true;
        animation.setValue(0);
        setTransition({ text: page.text, direction, mode: preferences.animation });
      }
      setOffset(pages[destination.index].start);
    } else if (destination.kind === 'chapter') void goToChapter(chapters[destination.index], direction === -1);
  }, [positioned, pageIndex, pages, chapterIndex, chapters, preferences.animation, reduceMotion, animation, page.text, goToChapter]);

  // PanResponder only registers these callbacks; refs are read when a touch occurs.
  // eslint-disable-next-line react-hooks/refs
  const gesture = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, state) => !turning && state.numberActiveTouches === 1 && Math.abs(state.dx) > 12 && Math.abs(state.dx) > Math.abs(state.dy) * 1.4,
    onPanResponderRelease: (event, state) => {
      // Acquiring a responder during a move resets dx/dy; retain the full touch distance.
      const dx = event.nativeEvent.pageX - touchOrigin.current.x;
      const dy = event.nativeEvent.pageY - touchOrigin.current.y;
      const direction = swipeDirection(dx, dy, state.vx, size.width);
      if (direction) turn(direction);
    },
    onPanResponderTerminationRequest: () => true,
  }), [turning, turn, size.width]);

  function changePreferences(patch: Partial<ReaderPreferences>) {
    // Keep the current text as the anchor when the new typography changes pagination.
    setOffset(page.start);
    update(patch);
  }

  const incomingStyle = !transition ? undefined : transition.mode === 'fade' ? { opacity: animation } : { transform: [{ translateX: animation.interpolate({ inputRange: [0, 1], outputRange: [size.width * transition.direction, 0] }) }] };
  const outgoingStyle = !transition ? undefined : transition.mode === 'fade' ? { opacity: animation.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) } : { transform: [{ translateX: animation.interpolate({ inputRange: [0, 1], outputRange: [0, -size.width * transition.direction] }) }] };

  return <View style={[styles.page, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 10), paddingLeft: insets.left, paddingRight: insets.right }]}>
    <View style={styles.header}><Text style={styles.bookTitle} numberOfLines={1}>{book?.title ?? '阅读'} · 第 {Math.max(chapterIndex + 1, 1)} 章</Text><Text style={styles.chapterTitle} numberOfLines={2}>{chapter.title}</Text></View>
    <View style={styles.body}>
      <View style={styles.viewport} onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setSize(current => current.width === width && current.height === height ? current : { width, height });
      }} onTouchStart={event => { touchOrigin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; }} {...gesture.panHandlers}>
        {positioned ? <View pointerEvents="none" style={styles.textLayers}>
          {transition ? <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.textLayer, outgoingStyle]}><Text style={bodyTextStyle}>{transition.text}</Text></Animated.View> : null}
          <Animated.View style={[styles.textLayer, incomingStyle]}><Text selectable={false} style={bodyTextStyle}>{page.text}</Text></Animated.View>
        </View> : <ActivityIndicator color={theme.success} />}
        {Platform.OS !== 'web' && size.width > 0 && size.height > 0 && measured?.key !== measurementKey ? <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.measure}>
          <Text style={bodyTextStyle} onTextLayout={event => {
            const computed = paginateMeasuredLines(text, event.nativeEvent.lines, linesPerPage) ?? fallback;
            setMeasured({ key: measurementKey, pages: computed });
          }}>{text}</Text>
        </View> : null}
        <View style={styles.touchZones}>
          <Pressable style={styles.sideZone} onPress={() => turn(-1)} disabled={turning || !positioned} accessibilityRole="button" accessibilityLabel="上一页" />
          <Pressable style={styles.centerZone} onPress={() => setControlsVisible(true)} accessibilityRole="button" accessibilityLabel="显示阅读菜单" accessibilityHint="打开返回、书架、目录和阅读设置" />
          <Pressable style={styles.sideZone} onPress={() => turn(1)} disabled={turning || !positioned} accessibilityRole="button" accessibilityLabel="下一页" />
        </View>
      </View>
    </View>
    <View style={styles.footer} pointerEvents="none"><Text style={styles.footerText}>{turning ? '正在切换章节…' : chapterIndex >= 0 ? `第 ${chapterIndex + 1} / ${chapters.length} 章` : '左右滑动翻页'}</Text><Text style={styles.footerText}>{positioned ? `${pageIndex + 1} / ${pages.length}` : '正在分页'}</Text></View>
    {progressError || preferencesError ? <Text accessibilityRole="alert" style={styles.error}>{progressError || preferencesError}</Text> : null}
    <ReaderControls visible={controlsVisible} book={book} chapters={chapters} chapterId={chapter.id} pageLabel={`本章 ${pageIndex + 1} / ${pages.length} 页`} busy={turning || !positioned} preferences={preferences} error={progressError || preferencesError} onClose={() => setControlsVisible(false)} onBack={() => backToBook(sourceId, bookId)} onChapter={adjacent => { void goToChapter(adjacent); }} onPreferences={changePreferences} />
  </View>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.readerBackground },
  page: { flex: 1, backgroundColor: theme.readerBackground },
  center: { flex: 1, backgroundColor: theme.readerBackground, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  message: { color: theme.readerMuted, textAlign: 'center', lineHeight: 24 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 22, backgroundColor: theme.readerControl, borderRadius: 12 },
  backButton: { position: 'absolute', minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  backText: { color: theme.success, fontSize: 15 },
  header: { paddingTop: 20, paddingBottom: 26, paddingHorizontal: 24, maxWidth: 640, width: '100%', alignSelf: 'center', gap: 30 },
  bookTitle: { color: theme.readerMuted, fontSize: 11 },
  chapterTitle: { color: theme.readerInk, fontSize: 22, lineHeight: 32, fontFamily: 'serif' },
  body: { flex: 1, paddingHorizontal: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  viewport: { flex: 1, overflow: 'hidden' },
  touchZones: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  sideZone: { flex: 1 },
  centerZone: { flex: 2 },
  bodyText: { color: theme.readerInk, fontWeight: '400' },
  textLayers: { flex: 1 },
  textLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.readerBackground },
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 6, maxWidth: 640, width: '100%', alignSelf: 'center' },
  footerText: { color: theme.readerMuted, fontSize: 10, fontVariant: ['tabular-nums'] },
  error: { color: theme.danger, fontSize: 12, textAlign: 'center', paddingHorizontal: 24, paddingTop: 8 },
});
