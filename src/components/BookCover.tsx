import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Book } from '../domain/books';

export function BookCover({ book, large = false }: { book: Book; large?: boolean }) {
  // Track the failed URL so recycled list cells can load a different book's cover.
  const [failedUrl, setFailedUrl] = useState<string>();
  const uri = book.coverUrl;
  const showImage = !!uri && uri !== failedUrl;

  return (
    <View style={[styles.cover, large && styles.large, { backgroundColor: book.accent }]}>
      {showImage ? (
        <Image key={uri} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`${book.title}封面`} onError={() => setFailedUrl(uri)} />
      ) : (
        <>
          <View style={styles.rule} />
          <Text style={[styles.title, large && styles.largeTitle]} numberOfLines={3}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: 82, height: 112, borderRadius: 8, padding: 10, justifyContent: 'space-between', overflow: 'hidden' },
  large: { width: 120, height: 165, borderRadius: 10, padding: 15 },
  rule: { height: 2, width: 22, backgroundColor: '#FFFFFF90' },
  title: { color: 'white', fontSize: 17, fontWeight: '700', lineHeight: 23 },
  largeTitle: { fontSize: 22, fontWeight: '800', lineHeight: 30 },
  author: { color: '#FFFFFFCC', fontSize: 10 },
});
