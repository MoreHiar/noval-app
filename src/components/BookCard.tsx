import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Book } from '../domain/books';
import { theme } from './theme';
import { BookCover } from './BookCover';

export function BookCard({ book, compact = false, sourceName }: { book: Book; compact?: boolean; sourceName?: string }) {
  return (
    <Link href={{ pathname: '/book/[sourceId]/[bookId]', params: { sourceId: book.sourceId, bookId: book.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, compact && styles.compact])} accessibilityRole="button" accessibilityLabel={`查看${book.title}`}>
        <BookCover book={book} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author} · {book.category}</Text>
          {!compact && <Text style={styles.summary} numberOfLines={2}>{book.summary}</Text>}
          <Text style={styles.status}>{sourceName ? `${sourceName}${book.status === '状态未知' ? '' : ` · ${book.status}`}` : book.status}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 13, backgroundColor: theme.paper, borderRadius: 18, marginBottom: 12, gap: 14 },
  compact: { marginBottom: 10 },
  info: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  title: { color: theme.ink, fontSize: 17, fontWeight: '700', marginBottom: 5 },
  author: { color: theme.muted, fontSize: 12, marginBottom: 10 },
  summary: { color: theme.muted, fontSize: 12, lineHeight: 18, marginBottom: 7 },
  status: { color: theme.accent, fontSize: 11, fontWeight: '600' },
  chevron: { color: '#B8B8B2', fontSize: 26, paddingRight: 3 },
});
