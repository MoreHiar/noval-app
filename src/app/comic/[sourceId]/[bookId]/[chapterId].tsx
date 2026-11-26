import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Chapter, ChapterMeta } from '../../../../domain/books';
import { RemoteImage } from '../../../../components/RemoteImage';
import { useLibrary } from '../../../../state/library';
import { loadReadingProgress, saveReadingProgress } from '../../../../storage/library';

type Params = { sourceId: string; bookId: string; chapterId: string; offset?: string };

export default function ComicReaderScreen() {
  const params = useLocalSearchParams<Params>();
  return <Session key={`${params.sourceId}/${params.bookId}/${params.chapterId}`} params={params} />;
}

function Session({ params }: { params: Params }) {
  const { sourceId, bookId, chapterId } = params;
  const { getSource } = useLibrary();
  const source = getSource(sourceId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<string>>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [imageError, setImageError] = useState('');
  const [restoreIndex, setRestoreIndex] = useState(0);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    Promise.all([source.getChapters(bookId, controller.signal), source.getChapter(bookId, chapterId, controller.signal), loadReadingProgress(sourceId, bookId)])
      .then(([items, value, progress]) => {
        if (controller.signal.aborted) return;
        if (!value?.imageUrls?.length) throw new Error('此话没有可读取的图片。');
        setChapters(items); setChapter(value); setError('');
        const requested = params.offset !== undefined ? Number(params.offset) : progress?.chapterId === chapterId ? progress.offset : 0;
        const page = Number.isSafeInteger(requested) && requested >= 0 ? Math.min(requested, value.imageUrls.length - 1) : 0;
        setRestoreIndex(page); setIndex(page); setRestored(page === 0);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '漫画加载失败。'); });
    return () => controller.abort();
  }, [source, sourceId, bookId, chapterId, params.offset, attempt]);
  useEffect(() => {
    if (!chapter || restoreIndex === 0) return;
    const timer = setTimeout(() => list.current?.scrollToIndex({ index: restoreIndex, animated: false }), 80);
    return () => clearTimeout(timer);
  }, [chapter, restoreIndex]);
  useEffect(() => {
    if (!chapter || !restored) return;
    const timer = setTimeout(() => { void saveReadingProgress({ sourceId, bookId, chapterId, chapterTitle: chapter.title, offset: index, updatedAt: Date.now() }).catch(() => setError('阅读进度保存失败。')); }, 500);
    return () => clearTimeout(timer);
  }, [sourceId, bookId, chapterId, chapter, index, restored]);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const first = viewableItems.find(item => item.index !== null && item.index !== undefined);
    if (first?.index !== null && first?.index !== undefined) {
      setIndex(first.index);
      if (first.index >= restoreIndex) setRestored(true);
    }
  }, [restoreIndex]);
  const chapterIndex = chapters.findIndex(item => item.id === chapterId);
  const go = useCallback((next: ChapterMeta | undefined) => {
    if (!next || next.locked) return;
    router.replace({ pathname: '/comic/[sourceId]/[bookId]/[chapterId]', params: { sourceId, bookId, chapterId: next.id, offset: '0' } });
  }, [sourceId, bookId]);
  const back = () => router.canGoBack() ? router.back() : router.replace({ pathname: '/book/[sourceId]/[bookId]', params: { sourceId, bookId } });
  return <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={styles.header}><Pressable style={styles.back} onPress={back} accessibilityRole="button" accessibilityLabel="返回漫画详情"><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.heading} numberOfLines={1}>{chapter?.title ?? '漫画阅读'}</Text><Text style={styles.counter}>{chapter ? `${index + 1} / ${chapter.imageUrls?.length ?? 0}` : ''}</Text></View>
    {!chapter ? <View style={styles.center}>{!error ? <ActivityIndicator color="#CBD8CE" /> : null}<Text style={styles.message}>{error || (!source ? '书源不可用。' : '正在加载漫画…')}</Text>{error ? <Pressable style={styles.retry} onPress={() => { setError(''); setAttempt(value => value + 1); }} accessibilityRole="button"><Text style={styles.buttonText}>重试</Text></Pressable> : null}</View> : <>
      <FlatList ref={list} style={styles.list} data={chapter.imageUrls} keyExtractor={(item, position) => `${position}/${item}`} initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={{ itemVisiblePercentThreshold: 30 }} onScrollToIndexFailed={info => { list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false }); setTimeout(() => list.current?.scrollToIndex({ index: info.index, animated: false }), 200); }} renderItem={({ item, index: imageIndex }) => <ComicPage uri={item} width={Math.min(width, 760)} index={imageIndex} onError={() => setImageError(`第 ${imageIndex + 1} 张图片加载失败。`)} />} contentContainerStyle={styles.images} />
      {imageError ? <Text accessibilityRole="alert" style={styles.imageError}>{imageError}</Text> : null}
      <View style={styles.footer}><Pressable style={styles.chapterButton} onPress={() => go(chapters[chapterIndex - 1])} disabled={chapterIndex <= 0} accessibilityRole="button"><Text style={styles.buttonText}>上一话</Text></Pressable><Text style={styles.position} numberOfLines={1}>第 {chapterIndex + 1} / {chapters.length} 话</Text><Pressable style={[styles.chapterButton, styles.next]} onPress={() => go(chapters[chapterIndex + 1])} disabled={chapterIndex < 0 || chapterIndex >= chapters.length - 1} accessibilityRole="button"><Text style={styles.buttonText}>下一话 ›</Text></Pressable></View>
    </>}
  </View>;
}

function ComicPage({ uri, width, index, onError }: { uri: string; width: number; index: number; onError(): void }) {
  const [ratio, setRatio] = useState(0.7);
  return <RemoteImage uri={uri} style={{ width, height: width / ratio, backgroundColor: '#3C4842' }} contentFit="contain" recyclingKey={uri} onLoad={(imageWidth, imageHeight) => { if (imageWidth > 0 && imageHeight > 0) setRatio(imageWidth / imageHeight); }} onError={onError} accessibilityLabel={`第 ${index + 1} 张漫画图片`} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#222927' }, header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 }, back: { width: 38, height: 44, justifyContent: 'center' }, backText: { color: '#FFFFFF', fontSize: 28 }, heading: { flex: 1, color: '#FFFFFF', fontSize: 13 }, counter: { color: '#C7D1C8', fontSize: 11 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 15 }, message: { color: '#FFFFFF', fontSize: 13, textAlign: 'center' }, retry: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: '#41584E', borderRadius: 6 }, list: { flex: 1 }, images: { alignItems: 'center' }, imageError: { color: '#FFFFFF', backgroundColor: '#A34436', padding: 8, textAlign: 'center', fontSize: 11 }, footer: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 }, chapterButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }, next: { backgroundColor: '#41584E', borderRadius: 6 }, buttonText: { color: '#FFFFFF', fontSize: 11 }, position: { flex: 1, color: '#C7D1C8', textAlign: 'center', fontSize: 11 },
});
