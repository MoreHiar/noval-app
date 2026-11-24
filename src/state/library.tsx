import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Book, ManagedSource, SourceAdapter, RuleSourceDocument } from '../domain/books';
import { fanqieSource } from '../sources/fanqie';
import { javascriptDocument, javascriptExampleSource } from '../sources/javascript';
import { deleteDefinition, deleteRuleSources, LibraryData, mergeSources, parseLibraryData, parseSourceImport, saveDefinition, setAllRuleSourcesEnabled } from '../sources/management';
import { createStaticAdapter } from '../sources/static';
import { createLegadoSearchAdapter } from '../sources/legado-search';
import { definitionId, isRuleSource } from '../sources/legado';

type ImportResult = { added: number; updated: number; skipped: number };
type LibraryState = {
  sources: SourceAdapter[];
  enabledSources: SourceAdapter[];
  sourceDefinitions: ManagedSource[];
  shelf: string[];
  ready: boolean;
  storageError: string;
  retryLoad(): void;
  saveSource(document: RuleSourceDocument, enabled: boolean, existingId?: string): Promise<void>;
  importSources(input: string, replace: boolean): Promise<ImportResult>;
  removeSource(id: string): Promise<void>;
  removeSources(ids: string[]): Promise<void>;
  setSourceEnabled(id: string, enabled: boolean): Promise<void>;
  setAllSourcesEnabled(enabled: boolean): Promise<void>;
  toggleShelf(book: Book): Promise<void>;
  isOnShelf(book: Book): boolean;
  getSource(id: string): SourceAdapter | undefined;
};

const STORAGE_KEY = 'noval.library.v1';
const initialData: LibraryData = {
  version: 1,
  definitions: [
    fanqieSource(),
    { document: javascriptDocument, enabled: true, kind: 'javascript' },
  ],
  shelf: ['js-example/clock'],
};
const LibraryContext = createContext<LibraryState | null>(null);
const bookKey = (book: Book) => `${book.sourceId}/${book.id}`;

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
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      const restored = stored === null ? initialData : parseLibraryData(stored);
      if (!active) return;
      dataRef.current = restored;
      setData(restored);
      readyRef.current = true;
      setReady(true);
      setStorageError('');
    }).catch(() => {
      if (active) setStorageError('无法读取本地书源，请重试。原有数据未被覆盖。');
    });
    return () => { active = false; };
  }, [loadAttempt]);

  // Commit to disk before publishing changes; serialize writes to avoid lost updates.
  const update = useCallback(<T,>(mutate: (current: LibraryData) => { data: LibraryData; result: T }): Promise<T> => {
    const operation = queue.current.then(async () => {
      if (!readyRef.current) throw new Error('书源尚未加载完成，请稍后重试。');
      const next = mutate(dataRef.current);
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next.data)); }
      catch { throw new Error('保存失败，请检查设备存储空间后重试。'); }
      dataRef.current = next.data;
      setData(next.data);
      return next.result;
    });
    queue.current = operation.catch(() => undefined);
    return operation;
  }, []);

  const sources = useMemo(() => data.definitions.map(entry => {
    if (isRuleSource(entry)) return createLegadoSearchAdapter(entry.document);
    const { document, kind } = entry;
    if (kind === 'javascript' && document.id === javascriptDocument.id) {
      return { ...javascriptExampleSource, info: { ...javascriptExampleSource.info, name: document.name, description: document.description ?? '' } };
    }
    return createStaticAdapter(document, kind);
  }), [data.definitions]);
  const enabledSources = useMemo(() => sources.filter(source => data.definitions.some(entry => definitionId(entry) === source.info.id && entry.enabled)), [sources, data.definitions]);

  const value: LibraryState = {
    sources, enabledSources, sourceDefinitions: data.definitions, shelf: data.shelf, ready, storageError,
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
    toggleShelf: book => update(current => {
      if (!current.definitions.some(entry => definitionId(entry) === book.sourceId && (isRuleSource(entry) || entry.document.books.some(item => item.id === book.id)))) throw new Error('书籍所属书源已被删除或修改。');
      const key = bookKey(book);
      return { data: { ...current, shelf: current.shelf.includes(key) ? current.shelf.filter(item => item !== key) : [...current.shelf, key] }, result: undefined };
    }),
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
