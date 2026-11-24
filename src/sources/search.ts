import type { Book, SourceAdapter } from '../domain/books';

export type SearchResult = { source: SourceAdapter; books: Book[]; error?: string };

export function summarizeSearch(results: SearchResult[]) {
  const online = results.filter(result => result.source.info.kind === 'legado');
  return {
    completed: online.filter(result => !result.error).length,
    matched: online.filter(result => !result.error && result.books.length > 0).length,
    empty: online.filter(result => !result.error && result.books.length === 0).length,
    failed: online.filter(result => result.error && !result.source.searchUnavailableReason).length,
    unsupported: online.filter(result => !!result.source.searchUnavailableReason).length,
    demoBooks: results.filter(result => result.source.info.kind !== 'legado').reduce((total, result) => total + result.books.length, 0),
    settled: online.length,
  };
}

// Bound requests across all sources, and publish each result as soon as it arrives.
export async function searchSources(sources: SourceAdapter[], query: string, signal: AbortSignal, publish: (result: SearchResult) => void) {
  let index = 0;
  const worker = async () => {
    while (!signal.aborted && index < sources.length) {
      const source = sources[index++];
      if (!query.trim() && source.info.kind === 'legado') continue;
      if (source.searchUnavailableReason) {
        publish({ source, books: [], error: source.searchUnavailableReason });
        continue;
      }
      try {
        const books = await source.search(query, signal);
        if (!signal.aborted) publish({ source, books });
      } catch (cause) {
        if (!signal.aborted) publish({ source, books: [], error: cause instanceof Error ? cause.message : '搜索失败。' });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, sources.length) }, worker));
}
