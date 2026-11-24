import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Book, ManagedSource, SourceAdapter, RuleSourceDocument } from '../domain/books';
import { javascriptDocument, javascriptExampleSource } from '../sources/javascript';
import { bookKey, deleteDefinition, deleteRuleSources, getShelfBooks, LibraryData, mergeSources, parseSourceImport, saveDefinition, setAllRuleSourcesEnabled, setShelfBook } from '../sources/management';
import { loadLibrary, loadShelfBook, saveLibrary } from '../storage/library';
import { createStaticAdapter } from '../sources/static';
import { createLegadoSearchAdapter } from '../sources/legado-search';
import { definitionId, isRuleSource } from '../sources/legado';

type ImportResult = { added: number; updated: number; skipped: number };
type LibraryState = {
  sources: SourceAdapter[];
  enabledSources: SourceAdapter[];
  sourceDefinitions: ManagedSource[];
  shelf: string[];
  shelfBooks: Book[];
  ready: boolean;
  storageError: string;
  retryLoad(): void;
  saveSource(document: RuleSourceDocument, enabled: boolean, existingId?: string): Promise<void>;
  importSources(input: string, replace: boolean): Promise<ImportResult>;
  removeSource(id: string): Promise<void>;
  removeSources(ids: string[]): Promise<void>;
  setSourceEnabled(id: string, enabled: boolean): Promise<void>;
  setAllSourcesEnabled(enabled: boolean): Promise<void>;
  setBookOnShelf(book: Book, present: boolean): Promise<void>;
  isOnShelf(book: Book): boolean;
  getSource(id: string): SourceAdapter | undefined;
};

const initialData: LibraryData = {
  version: 1,
  definitions: [],
  shelf: [],
};
const LibraryContext = createContext<LibraryState | null>(null);

export function LibraryProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState(initialData);
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [storageError, setStorageError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadLibrary(initialData).then(restored => {
      if (!active) return;
      dataRef.current = restored;
      setData(restored);
      readyRef.current = true;
      setReady(true);
      setStorageError('');
    }).catch(() => {
      if (active) setStorageError('无法读取本地书源与书架，请重试。原有数据未被覆盖。');
    });
    return () => { active = false; };
  }, [loadAttempt]);

  // Commit to disk before publishing changes; serialize writes to avoid lost updates.
  const update = useCallback(<T,>(mutate: (current: LibraryData) => { data: LibraryData; result: T }): Promise<T> => {
    const operation = queue.current.then(async () => {
      if (!readyRef.current) throw new Error('书源尚未加载完成，请稍后重试。');
      const next = mutate(dataRef.current);
      try { await saveLibrary(next.data); }
      catch { throw new Error('保存失败，请检查设备存储空间后重试。'); }
      dataRef.current = next.data;
      setData(next.data);
      return next.result;
    });
    queue.current = operation.catch(() => undefined);
    return operation;
  }, []);

  const sources = useMemo(() => data.definitions.map(entry => {
    if (isRuleSource(entry)) return createLegadoSearchAdapter(entry.document,
      bookId => loadShelfBook(definitionId(entry), bookId));
    const { document, kind } = entry;
    if (kind === 'javascript' && document.id === javascriptDocument.id) {
      return { ...javascriptExampleSource, info: { ...javascriptExampleSource.info, name: document.name, description: document.description ?? '' } };
    }
    return createStaticAdapter(document, kind);
  }), [data.definitions]);
  const enabledSources = useMemo(() => sources.filter(source => data.definitions.some(entry => definitionId(entry) === source.info.id && entry.enabled)), [sources, data.definitions]);
  const shelfBooks = useMemo(() => getShelfBooks(data), [data]);

  const value: LibraryState = {
    sources, enabledSources, sourceDefinitions: data.definitions, shelf: data.shelf, shelfBooks, ready, storageError,
    retryLoad: () => setLoadAttempt(attempt => attempt + 1),
    saveSource: (document, enabled, existingId) => update(current => ({ data: saveDefinition(current, document, enabled, existingId), result: undefined })),
    importSources(input, replace) {
      const incoming = parseSourceImport(input);
      return update(current => {
        const { data: next, ...result } = mergeSources(current, incoming, replace);
        return { data: next, result };
      });
    },
    removeSource: id => update(current => ({ data: deleteDefinition(current, id), result: undefined })),
    removeSources: ids => update(current => ({ data: deleteRuleSources(current, ids), result: undefined })),
    setSourceEnabled: (id, enabled) => update(current => ({
      data: { ...current, definitions: current.definitions.map(entry => definitionId(entry) === id ? (isRuleSource(entry) ? { ...entry, enabled, document: { ...entry.document, enabled } } : { ...entry, enabled }) : entry) }, result: undefined,
    })),
    setAllSourcesEnabled: enabled => update(current => ({ data: setAllRuleSourcesEnabled(current, enabled), result: undefined })),
    setBookOnShelf: (book, present) => update(current => ({ data: setShelfBook(current, book, present), result: undefined })),
    isOnShelf: book => data.shelf.includes(bookKey(book)),
    getSource: id => sources.find(source => source.info.id === id),
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary 必须在 LibraryProvider 中使用');
  return context;
}
