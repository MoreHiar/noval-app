import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Book } from '../domain/books';
import { theme } from './theme';

export function BookCard({ book, compact = false }: { book: Book; compact?: boolean }) {
  return (
    <Link href={{ pathname: '/book/[sourceId]/[bookId]', params: { sourceId: book.sourceId, bookId: book.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, compact && styles.compact])} accessibilityRole="button" accessibilityLabel={`查看${book.title}`}>
        <View style={[styles.cover, { backgroundColor: book.accent }]}>
          <View style={styles.coverRule} />
          <Text style={styles.coverTitle} numberOfLines={3}>{book.title}</Text>
          <Text style={styles.coverAuthor} numberOfLines={1}>{book.author}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author} · {book.category}</Text>
          {!compact && <Text style={styles.summary} numberOfLines={2}>{book.summary}</Text>}
          <Text style={styles.status}>{book.status}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 13, backgroundColor: theme.paper, borderRadius: 18, marginBottom: 12, gap: 14 },
  compact: { marginBottom: 10 },
  cover: { width: 82, height: 112, borderRadius: 8, padding: 10, justifyContent: 'space-between', overflow: 'hidden' },
  coverRule: { height: 2, width: 22, backgroundColor: '#FFFFFF90' },
  coverTitle: { color: 'white', fontSize: 17, fontWeight: '700', lineHeight: 23 },
  coverAuthor: { color: '#FFFFFFCC', fontSize: 10 },
  info: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  title: { color: theme.ink, fontSize: 17, fontWeight: '700', marginBottom: 5 },
  author: { color: theme.muted, fontSize: 12, marginBottom: 10 },
  summary: { color: theme.muted, fontSize: 12, lineHeight: 18, marginBottom: 7 },
  status: { color: theme.accent, fontSize: 11, fontWeight: '600' },
  chevron: { color: '#B8B8B2', fontSize: 26, paddingRight: 3 },
});
