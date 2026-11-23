import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BookCard } from '../../components/BookCard';
import { Page } from '../../components/Page';
import { theme } from '../../components/theme';
import { Book } from '../../domain/books';
import { useLibrary } from '../../state/library';

export default function DiscoverScreen() {
  const { sources } = useLibrary();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled(sources.map((source) => source.search(query))).then((results) => {
      if (!active) return;
      setBooks(results.flatMap((result) => result.status === 'fulfilled' ? result.value : []));
      setError(results.some((result) => result.status === 'rejected') ? '部分书源暂时无法搜索。' : '');
    });
    return () => { active = false; };
  }, [sources, query]);

  return (
    <Page title="发现好书" eyebrow="DISCOVER STORIES">
      <View style={styles.search}><Text style={styles.icon}>⌕</Text><TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="搜索书名、作者或分类" placeholderTextColor="#A4AAA3" accessibilityLabel="搜索书籍" /></View>
      <Text style={styles.caption}>来自 {sources.length} 个书源 · {books.length} 本书</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {books.length ? books.map((book) => <BookCard key={`${book.sourceId}/${book.id}`} book={book} />) : <Text style={styles.empty}>没有找到相关书籍</Text>}
    </Page>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.paper, borderRadius: 14, paddingHorizontal: 16, height: 52, marginBottom: 20 },
  icon: { color: theme.accent, fontSize: 25, marginRight: 10 },
  input: { flex: 1, color: theme.ink, fontSize: 14, height: '100%' },
  caption: { color: theme.muted, fontSize: 12, marginBottom: 14 },
  error: { color: theme.accent, marginBottom: 12 },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 30 },
});
