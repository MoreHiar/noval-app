import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles, type AppTheme } from '../../../components/theme';
import { getDrama, getDramaPreview, type DramaDetail, type DramaPreview } from '../../../dramas/hongguo';

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function PreviewVideo({ preview, detail, index, onPick, onNext, bottomInset }: {
  preview: DramaPreview;
  detail: DramaDetail;
  index: number;
  onPick: () => void;
  onNext: () => void;
  bottomInset: number;
}) {
  const styles = useThemedStyles(createStyles);
  const player = useVideoPlayer(preview.url, instance => {
    instance.timeUpdateEventInterval = 0.5;
    instance.play();
  });
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [error, setError] = useState('');
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    const status = player.addListener('statusChange', event => {
      if (event.status === 'error') setError(event.error?.message || '视频播放失败');
      if (event.status === 'readyToPlay') setDuration(player.duration);
    });
    const playback = player.addListener('playingChange', event => setPlaying(event.isPlaying));
    const time = player.addListener('timeUpdate', event => {
      setPosition(event.currentTime);
      if (Number.isFinite(player.duration)) setDuration(player.duration);
    });
    const ended = player.addListener('playToEnd', () => { setPlaying(false); setControlsVisible(true); });
    return () => { status.remove(); playback.remove(); time.remove(); ended.remove(); };
  }, [player]);

  useEffect(() => {
    if (!controlsVisible || !playing) return;
    const timer = setTimeout(() => setControlsVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [controlsVisible, playing]);

  const togglePlayback = () => {
    if (playing) player.pause();
    else {
      if (duration > 0 && position >= duration - 0.25) player.replay();
      player.play();
    }
    setControlsVisible(true);
  };

  const seek = (fraction: number) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    const target = Math.max(0, Math.min(duration, duration * fraction));
    player.seekBy(target - player.currentTime);
    setPosition(target);
    setControlsVisible(true);
  };

  return <View style={styles.player}>
    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} surfaceType="textureView" />
    <Pressable style={StyleSheet.absoluteFill} onPress={() => setControlsVisible(value => !value)} accessibilityRole="button" accessibilityLabel="显示播放控件" />
    {controlsVisible || !playing ? <Pressable style={styles.playButton} onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={playing ? '暂停' : '播放'}>
      <Text style={styles.playSymbol}>{playing ? 'Ⅱ' : '▶'}</Text>
    </Pressable> : null}
    <View style={[styles.bottom, { paddingBottom: bottomInset + 16 }]}>
      <Text style={styles.dramaTitle} numberOfLines={2}>{detail.title}</Text>
      <Text style={styles.episodeLabel}>第 {index + 1} 集{preview.previewOnly ? ' · 公开预览' : ''}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.playerError}>{error}</Text> : null}
      <View style={styles.transport}>
        <Pressable onPress={togglePlayback} style={styles.transportPlay} accessibilityRole="button" accessibilityLabel={playing ? '暂停' : '播放'}><Text style={styles.transportText}>{playing ? 'Ⅱ' : '▶'}</Text></Pressable>
        <Text style={styles.time}>{clock(position)}</Text>
        <Pressable style={styles.progressTouch} onLayout={event => setProgressWidth(event.nativeEvent.layout.width)} onPress={event => seek(event.nativeEvent.locationX / progressWidth)} accessibilityRole="adjustable" accessibilityLabel="播放进度" accessibilityValue={{ min: 0, max: Math.max(1, Math.floor(duration)), now: Math.floor(position) }}>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${duration > 0 ? Math.min(100, position / duration * 100) : 0}%` }]} /></View>
        </Pressable>
        <Text style={styles.time}>{clock(duration)}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.episodeAction} onPress={() => { player.pause(); onPick(); }} accessibilityRole="button" accessibilityLabel="打开选集"><Text style={styles.actionText}>选集 · {index + 1}/{detail.episodes.length} ⌄</Text></Pressable>
        <Pressable style={[styles.nextAction, index >= detail.episodes.length - 1 && styles.disabled]} onPress={onNext} disabled={index >= detail.episodes.length - 1} accessibilityRole="button" accessibilityLabel="下一集"><Text style={styles.actionText}>下一集 ›</Text></Pressable>
      </View>
    </View>
  </View>;
}

export default function DramaPlayerScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { seriesId, videoId } = useLocalSearchParams<{ seriesId: string; videoId: string }>();
  const [result, setResult] = useState<{ key: string; detail: DramaDetail | null; preview: DramaPreview | null; error: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const key = `${seriesId}:${videoId}:${revision}`;
  const loading = Platform.OS !== 'web' && result?.key !== key;
  const detail = result?.key === key ? result.detail : null;
  const preview = result?.key === key ? result.preview : null;
  const error = Platform.OS === 'web' ? '请在 Android 或 iOS 应用中播放短剧。' : result?.key === key ? result.error : '';

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const controller = new AbortController();
    Promise.all([getDrama(seriesId, controller.signal), getDramaPreview(seriesId, videoId, controller.signal)])
      .then(([drama, video]) => {
        if (controller.signal.aborted) return;
        if (!drama.episodes.some(episode => episode.id === videoId)) throw new Error('当前集不属于这部短剧');
        setResult({ key, detail: drama, preview: video, error: '' });
      })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key, detail: null, preview: null, error: cause instanceof Error ? cause.message : '预览加载失败' }); });
    return () => controller.abort();
  }, [seriesId, videoId, key]);

  const index = detail?.episodes.findIndex(episode => episode.id === videoId) ?? -1;
  const goTo = (nextIndex: number) => {
    const next = detail?.episodes[nextIndex];
    if (next) {
      setPickerOpen(false);
      router.replace({ pathname: '/drama/[seriesId]/[videoId]', params: { seriesId, videoId: next.id } });
    }
  };

  return <View style={styles.screen}>
    <StatusBar style="light" />
    {loading ? <ActivityIndicator color="#FFFFFF" style={styles.loading} /> : preview && detail && index >= 0 ? <PreviewVideo key={videoId} preview={preview} detail={detail} index={index} onPick={() => setPickerOpen(true)} onNext={() => goTo(index + 1)} bottomInset={insets.bottom} /> : <View style={styles.failure}><Text style={styles.failureText}>{error || '暂无可用预览'}</Text><Pressable style={styles.retry} onPress={() => setRevision(value => value + 1)} accessibilityRole="button"><Text style={styles.actionText}>重试</Text></Pressable></View>}
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="返回短剧详情"><Text style={styles.backSymbol}>‹</Text></Pressable>
      <Text style={styles.topTitle} numberOfLines={1}>{detail ? `第 ${index + 1} 集` : '短剧播放'}</Text>
    </View>
    {pickerOpen && detail ? <View style={styles.pickerOverlay}>
      <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)} accessibilityRole="button" accessibilityLabel="关闭选集" />
      <View style={[styles.picker, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.pickerHeader}><View style={styles.pickerHeading}><Text style={styles.pickerTitle} numberOfLines={1}>{detail.title}</Text><Text style={styles.pickerCount}>共 {detail.episodes.length} 集 · 公开预览</Text></View><Pressable onPress={() => setPickerOpen(false)} style={styles.pickerClose} accessibilityRole="button" accessibilityLabel="关闭选集"><Text style={styles.pickerCloseText}>×</Text></Pressable></View>
        <FlatList data={detail.episodes} keyExtractor={episode => episode.id} numColumns={5} columnWrapperStyle={styles.episodeRow} contentContainerStyle={styles.episodeList} initialNumToRender={30} renderItem={({ item, index: episodeIndex }) => <Pressable style={[styles.episode, episodeIndex === index && styles.activeEpisode]} onPress={() => goTo(episodeIndex)} accessibilityRole="button" accessibilityLabel={`第${item.number}集`} accessibilityState={{ selected: episodeIndex === index }}><Text style={[styles.episodeText, episodeIndex === index && styles.activeEpisodeText]}>{item.number}</Text></Pressable>} />
      </View>
    </View> : null}
  </View>;
}

const createStyles = (_theme: AppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111114' },
  player: { flex: 1, backgroundColor: '#111114' },
  topBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.28)' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backSymbol: { color: '#FFFFFF', fontSize: 34, lineHeight: 38 },
  topTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1 },
  playButton: { position: 'absolute', alignSelf: 'center', top: '43%', width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  playSymbol: { color: '#FFFFFF', fontSize: 26, lineHeight: 30 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 32, backgroundColor: 'rgba(0,0,0,0.64)' },
  dramaTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 24, fontWeight: '700' },
  episodeLabel: { color: '#DDDDDF', fontSize: 12, marginTop: 5 },
  playerError: { color: '#FFBCB5', fontSize: 12, marginTop: 8 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, marginTop: 12 },
  transportPlay: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  transportText: { color: '#FFFFFF', fontSize: 16 },
  time: { color: '#EEEEEE', fontSize: 11, fontVariant: ['tabular-nums'] },
  progressTouch: { flex: 1, height: 32, justifyContent: 'center' },
  progressTrack: { height: 3, backgroundColor: '#77777A', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  episodeAction: { flex: 1, minHeight: 44, borderRadius: 6, backgroundColor: '#353538', justifyContent: 'center', paddingHorizontal: 12 },
  nextAction: { minWidth: 92, minHeight: 44, borderRadius: 6, backgroundColor: '#353538', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  loading: { flex: 1 },
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  failureText: { color: '#EEEEEE', fontSize: 13, lineHeight: 21, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: '#77777A', borderRadius: 6, minHeight: 44, minWidth: 90, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  pickerOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.65)' },
  picker: { height: '62%', minHeight: 300, backgroundColor: '#202023', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: 16 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 18 },
  pickerHeading: { flex: 1, minWidth: 0 },
  pickerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  pickerCount: { color: '#BBBBBE', fontSize: 12, marginTop: 5 },
  pickerClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pickerCloseText: { color: '#FFFFFF', fontSize: 25 },
  episodeList: { paddingHorizontal: 20, paddingBottom: 16 },
  episodeRow: { gap: 8, marginBottom: 8 },
  episode: { width: '17%', height: 48, borderRadius: 5, backgroundColor: '#353538', alignItems: 'center', justifyContent: 'center' },
  activeEpisode: { backgroundColor: '#FFFFFF' },
  episodeText: { color: '#E5E5E7', fontSize: 14, fontWeight: '600' },
  activeEpisodeText: { color: '#202023' },
});
