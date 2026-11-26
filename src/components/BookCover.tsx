import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Book } from '../domain/books';
import { RemoteImage } from './RemoteImage';

export function BookCover({ book, large = false, style }: { book: Book; large?: boolean; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState<{ key: string; urls: string[] }>({ key: '', urls: [] });
  const key = `${book.sourceId}/${book.id}`;
  const failedUrls = failed.key === key ? failed.urls : [];
  const uri = [book.coverUrl, book.coverFallbackUrl].find(url => url && !failedUrls.includes(url));
  const showImage = !!uri;

  return (
    <View style={[styles.cover, large && styles.large, { backgroundColor: book.accent }, style]}>
      {showImage ? (
        <RemoteImage key={uri} uri={uri} style={StyleSheet.absoluteFill} accessibilityLabel={`${book.title}封面`} onError={() => setFailed(current => ({ key, urls: [...(current.key === key ? current.urls : []), uri] }))} />
      ) : (
        <>
          <Text style={styles.series}>NOVAL / STORIES</Text>
          <View style={styles.art} pointerEvents="none"><View style={styles.orbit} /><View style={styles.orbitSmall} /></View>
          <View><Text style={[styles.title, large && styles.largeTitle]} numberOfLines={large ? 3 : 2}>{book.title}</Text><Text style={styles.author} numberOfLines={1}>{book.author} 著</Text></View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: 70, height: 96, borderRadius: 4, padding: 7, justifyContent: 'space-between', overflow: 'hidden' },
  large: { width: 116, height: 164, borderRadius: 5, padding: 11 },
  series: { color: '#F5EFE0', fontSize: 5, letterSpacing: 1.1, fontWeight: '700' },
  art: { position: 'absolute', top: 25, right: 0, bottom: 0, left: 8, opacity: 0.28 },
  orbit: { width: 160, height: 160, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 80, transform: [{ rotate: '-18deg' }] },
  orbitSmall: { position: 'absolute', top: 22, left: 20, width: 100, height: 100, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 50 },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 17 },
  largeTitle: { fontSize: 21, lineHeight: 27 },
  author: { color: '#F5EFE0', fontSize: 7, marginTop: 5 },
});
