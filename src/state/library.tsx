import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { Book, SourceAdapter } from '../domain/books';
import { builtinSource } from '../sources/builtin';
import { javascriptExampleSource } from '../sources/javascript';
import { createStaticAdapter, parseStaticSource } from '../sources/static';

type LibraryState = {
  sources: SourceAdapter[];
  shelf: string[];
  addJsonSource(input: string): void;
  toggleShelf(book: Book): void;
  isOnShelf(book: Book): boolean;
  getSource(id: string): SourceAdapter | undefined;
};

const LibraryContext = createContext<LibraryState | null>(null);
const bookKey = (book: Book) => `${book.sourceId}/${book.id}`;

export function LibraryProvider({ children }: PropsWithChildren) {
  const [customSources, setCustomSources] = useState<SourceAdapter[]>([]);
  const [shelf, setShelf] = useState<string[]>([
    'sample-library/starlight', 'sample-library/rain', 'sample-library/mountain',
    'sample-library/moon', 'sample-library/summer', 'sample-library/garden',
    'sample-library/north', 'js-example/clock',
  ]);
  const sources = useMemo(() => [builtinSource, javascriptExampleSource, ...customSources], [customSources]);

  const value: LibraryState = {
    sources,
    shelf,
    addJsonSource(input) {
      const document = parseStaticSource(input);
      if (sources.some((source) => source.info.id === document.id)) {
        throw new Error(`书源 id「${document.id}」已存在。`);
      }
      setCustomSources((current) => [...current, createStaticAdapter(document, 'json')]);
    },
    toggleShelf(book) {
      const key = bookKey(book);
      setShelf((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
    },
    isOnShelf(book) { return shelf.includes(bookKey(book)); },
    getSource(id) { return sources.find((source) => source.info.id === id); },
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary 必须在 LibraryProvider 中使用');
  return context;
}
