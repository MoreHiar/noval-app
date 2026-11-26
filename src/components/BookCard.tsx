import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Book } from '../domain/books';
import { BookCover } from './BookCover';
import { useThemedStyles, type AppTheme } from './theme';

export function BookCard({ book, compact = false, sourceName }: { book: Book; compact?: boolean; sourceName?: string }) {
  const styles = useThemedStyles(createStyles);
  return <Link href={{ pathname: '/book/[sourceId]/[bookId]', params: { sourceId: book.sourceId, bookId: book.id } }} asChild>
    <Pressable style={StyleSheet.flatten([styles.card, compact && styles.compact])} accessibilityRole="button" accessibilityLabel={`查看${book.title}`}>
      <BookCover book={book} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.author} numberOfLines={2}>{book.author} · {book.category}</Text>
        {!compact && <Text style={styles.status}>{book.status}</Text>}
        {sourceName ? <Text style={styles.source} numberOfLines={1}>{sourceName}</Text> : compact ? <Text style={styles.status}>{book.status}</Text> : null}
      </View>
      {!compact && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  </Link>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: { flexDirection: 'row', flex: 1, alignItems: 'center', minHeight: 126, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 15 },
  compact: { borderBottomWidth: 0, minHeight: 126 },
  info: { flex: 1, justifyContent: 'center', gap: 4, minWidth: 0 },
  title: { color: theme.ink, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  author: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  status: { color: theme.muted, fontSize: 11, lineHeight: 17 },
  source: { alignSelf: 'flex-start', color: theme.muted, backgroundColor: theme.secondary, fontSize: 10, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, overflow: 'hidden', marginTop: 2 },
  chevron: { color: theme.muted, fontSize: 23, marginLeft: 2 },
});
