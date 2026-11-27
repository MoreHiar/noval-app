import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RemoteImage } from '../../components/RemoteImage';
import { useThemedStyles, type AppTheme } from '../../components/theme';
import { getDrama, type DramaDetail } from '../../dramas/hongguo';

export default function DramaDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const [result, setResult] = useState<{ key: string; detail: DramaDetail | null; error: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${seriesId}:${revision}`;
  const loading = Platform.OS !== 'web' && result?.key !== key;
  const detail = result?.key === key ? result.detail : null;
  const error = Platform.OS === 'web' ? '请在 Android 或 iOS 应用中查看短剧。' : result?.key === key ? result.error : '';

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const controller = new AbortController();
    getDrama(seriesId, controller.signal).then(value => { if (!controller.signal.aborted) setResult({ key, detail: value, error: '' }); })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key, detail: null, error: cause instanceof Error ? cause.message : '详情加载失败' }); });
    return () => controller.abort();
  }, [seriesId, key]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={styles.dark.color} /></View>;
  if (error || !detail) return <View style={styles.center}><Text style={styles.error}>{error || '短剧详情暂不可用'}</Text><Pressable style={styles.retry} onPress={() => setRevision(value => value + 1)} accessibilityRole="button"><Text style={styles.retryText}>重试</Text></Pressable></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.poster}>{detail.cover ? <RemoteImage uri={detail.cover} style={StyleSheet.absoluteFill} accessibilityLabel={`${detail.title}封面`} /> : null}</View>
      <View style={styles.heroText}>
        <Text style={styles.title}>{detail.title}</Text>
        <Text style={styles.meta}>{detail.episodeCount} 集{detail.category ? ` · ${detail.category}` : ''}</Text>
        <Text style={styles.summary} numberOfLines={8}>{detail.summary || '暂无简介'}</Text>
      </View>
    </View>
    <View style={styles.divider} />
    <View style={styles.section}><Text style={styles.sectionTitle}>公开选集</Text><Text style={styles.sectionMeta}>{detail.episodes.length} 集</Text></View>
    <View style={styles.episodes}>{detail.episodes.map(episode => <Pressable key={episode.id} style={styles.episode} onPress={() => router.push({ pathname: '/drama/[seriesId]/[videoId]', params: { seriesId, videoId: episode.id } })} accessibilityRole="button" accessibilityLabel={`预览第${episode.number}集`}><Text style={styles.episodeText}>{episode.number}</Text></Pressable>)}</View>
    {detail.episodes.length < detail.episodeCount ? <Text style={styles.notice}>其余剧集暂无公开预览。</Text> : null}
  </ScrollView>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 70 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 17 },
  poster: { width: 112, aspectRatio: 0.72, borderRadius: 5, overflow: 'hidden', backgroundColor: theme.secondary },
  heroText: { flex: 1, minWidth: 0 },
  title: { color: theme.ink, fontSize: 22, lineHeight: 29, fontWeight: '700' },
  meta: { color: theme.muted, fontSize: 12, marginTop: 9 },
  summary: { color: theme.ink, fontSize: 12, lineHeight: 20, marginTop: 14 },
  divider: { height: 1, backgroundColor: theme.line, marginVertical: 25 },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { color: theme.ink, fontSize: 18, fontWeight: '700' },
  sectionMeta: { color: theme.muted, fontSize: 12 },
  episodes: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  episode: { width: 55, height: 48, borderRadius: 5, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
  episodeText: { color: theme.ink, fontSize: 14, fontWeight: '700' },
  notice: { color: theme.muted, fontSize: 12, marginTop: 20 },
  center: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: theme.muted, fontSize: 13, textAlign: 'center' },
  retry: { marginTop: 18, minWidth: 100, minHeight: 44, borderRadius: 6, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: theme.dark, fontSize: 13, fontWeight: '700' }, dark: { color: theme.dark },
});
