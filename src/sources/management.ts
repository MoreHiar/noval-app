import type { Book, ManagedSource, RuleManagedSource, RuleSourceDocument, StaticManagedSource } from '../domain/books';
import { definitionId, isRuleSource, parseRuleSource, readSourceJson, ruleSourceId } from './legado';
import { parseStaticSource } from './static';

export type LibraryData = { version: 1; definitions: ManagedSource[]; shelf: string[]; shelfBooks?: Book[] };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const bookKey = (book: Pick<Book, 'sourceId' | 'id'>) => `${book.sourceId}/${book.id}`;

// Persist metadata for collected books only. Never retain arbitrary response fields or artwork bytes.
function snapshotBook(value: unknown): Book {
  if (!isRecord(value) || !['id', 'sourceId', 'title', 'author', 'summary', 'category', 'accent'].every(key => typeof value[key] === 'string') ||
    !value.id || !value.sourceId || !value.title || !['连载中', '已完结', '状态未知'].includes(String(value.status)) ||
    (value.coverUrl !== undefined && typeof value.coverUrl !== 'string') || (value.coverFallbackUrl !== undefined && typeof value.coverFallbackUrl !== 'string')) {
    throw new Error('书架书籍信息格式无效。');
  }
  const book = value as Book;
  const artwork = (url?: string) => url && url.length <= 4096 && /^https?:\/\//i.test(url) ? url : undefined;
  return {
    id: book.id, sourceId: book.sourceId, title: book.title.slice(0, 512), author: book.author.slice(0, 256),
    summary: book.summary.slice(0, 4000), category: book.category.slice(0, 128), status: book.status, accent: book.accent.slice(0, 32),
    ...(artwork(book.coverUrl) ? { coverUrl: artwork(book.coverUrl) } : {}),
    ...(artwork(book.coverFallbackUrl) ? { coverFallbackUrl: artwork(book.coverFallbackUrl) } : {}),
  };
}

function reconcileShelf(current: LibraryData): LibraryData {
  const shelf = [...new Set(pruneShelf(current.shelf, current.definitions))];
  const keys = new Set(shelf);
  const books = new Map((current.shelfBooks ?? []).filter(book => keys.has(bookKey(book))).map(book => [bookKey(book), snapshotBook(book)]));
  return { ...current, shelf, shelfBooks: [...books.values()] };
}

export function getShelfBooks(current: LibraryData): Book[] {
  const books = new Map((current.shelfBooks ?? []).map(book => [bookKey(book), book]));
  for (const entry of current.definitions) {
    if (!isRuleSource(entry)) for (const book of entry.document.books) {
      const item = { ...book, sourceId: entry.document.id };
      books.set(bookKey(item), item);
    }
  }
  return current.shelf.flatMap(key => books.has(key) ? [books.get(key)!] : []);
}

export function setShelfBook(current: LibraryData, book: Book, present: boolean): LibraryData {
  const key = bookKey(book);
  if (present && !current.definitions.some(entry => definitionId(entry) === book.sourceId && (isRuleSource(entry) || entry.document.books.some(item => item.id === book.id)))) {
    throw new Error('书籍所属书源已被删除或修改。');
  }
  return reconcileShelf({
    ...current,
    shelf: present ? [...new Set([...current.shelf, key])] : current.shelf.filter(item => item !== key),
    shelfBooks: [...(current.shelfBooks ?? []).filter(item => bookKey(item) !== key), ...(present ? [snapshotBook(book)] : [])],
  });
}

export function parseSourceImport(input: string): RuleManagedSource[] {
  const raw = readSourceJson(input);
  const items = Array.isArray(raw) ? raw : [raw];
  if (!items.length) throw new Error('文件中没有书源。');
  const ids = new Set<string>();
  return items.map((item, index) => {
    let document: RuleSourceDocument;
    try { document = parseRuleSource(item); }
    catch (cause) { throw new Error(`第 ${index + 1} 个书源：${cause instanceof Error ? cause.message : '格式无效。'}`); }
    const id = ruleSourceId(document);
    if (ids.has(id)) throw new Error(`导入内容中存在重复书源地址：${document.bookSourceUrl}`);
    ids.add(id);
    return { document, enabled: document.enabled ?? true, kind: 'legado' };
  });
}

export function exportSources(definitions: RuleManagedSource[], single = false): string {
  // Do not add internal IDs, kinds or versions to the Legado exchange format.
  const documents = definitions.map(({ document }) => document);
  return JSON.stringify(single ? documents[0] : documents, null, 2);
}

export function pruneShelf(shelf: string[], definitions: ManagedSource[]): string[] {
  const staticKeys = new Set(definitions.flatMap(entry => isRuleSource(entry) ? [] : entry.document.books.map(book => `${entry.document.id}/${book.id}`)));
  const ruleIds = new Set(definitions.filter(isRuleSource).map(definitionId));
  return shelf.filter(key => staticKeys.has(key) || ruleIds.has(key.split('/')[0]));
}

export function saveDefinition(current: LibraryData, document: RuleSourceDocument, enabled: boolean, existingId?: string): LibraryData {
  const validated = parseRuleSource({ ...document, enabled });
  const newId = ruleSourceId(validated);
  const existing = current.definitions.find(item => definitionId(item) === existingId);
  if (existingId && !existing) throw new Error('书源已不存在，请返回列表重试。');
  if (existing && !isRuleSource(existing)) throw new Error('离线演示内容不属于网站规则书源。');
  if (current.definitions.some(item => definitionId(item) === newId && definitionId(item) !== existingId)) throw new Error('该书源地址已存在，请编辑原书源或更换地址。');
  const entry: RuleManagedSource = { document: validated, enabled, kind: 'legado' };
  const definitions = existing ? current.definitions.map(item => definitionId(item) === existingId ? entry : item) : [...current.definitions, entry];
  const shelf = current.shelf.map(key => existingId && key.startsWith(`${existingId}/`) ? `${newId}/${key.slice(existingId.length + 1)}` : key);
  const shelfBooks = current.shelfBooks?.map(book => book.sourceId === existingId ? { ...book, sourceId: newId } : book);
  return reconcileShelf({ ...current, definitions, shelf, shelfBooks });
}

export function mergeSources(current: LibraryData, incoming: RuleManagedSource[], replace: boolean): { data: LibraryData; added: number; updated: number; skipped: number } {
  const definitions = [...current.definitions];
  let added = 0, updated = 0, skipped = 0;
  for (const entry of incoming) {
    const index = definitions.findIndex(item => definitionId(item) === definitionId(entry));
    if (index < 0) { definitions.push(entry); added++; }
    else if (replace) { definitions[index] = entry; updated++; }
    else skipped++;
  }
  return { data: reconcileShelf({ ...current, definitions }), added, updated, skipped };
}

export function deleteDefinition(current: LibraryData, id: string): LibraryData {
  const definitions = current.definitions.filter(item => definitionId(item) !== id);
  return reconcileShelf({ ...current, definitions });
}

export function setAllRuleSourcesEnabled(current: LibraryData, enabled: boolean): LibraryData {
  return {
    ...current,
    definitions: current.definitions.map(entry => isRuleSource(entry)
      ? { ...entry, enabled, document: { ...entry.document, enabled } }
      : entry),
  };
}

export function deleteRuleSources(current: LibraryData, ids: string[]): LibraryData {
  const selected = new Set(ids);
  const definitions = current.definitions.filter(entry => !isRuleSource(entry) || !selected.has(definitionId(entry)));
  return reconcileShelf({ ...current, definitions });
}

export function parseLibraryData(input: string): LibraryData {
  const raw = readSourceJson(input);
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.definitions) || !Array.isArray(raw.shelf) || !raw.shelf.every(key => typeof key === 'string')) throw new Error('本地书源数据格式无效。');
  const ids = new Set<string>();
  const definitions: ManagedSource[] = raw.definitions.map(entry => {
    if (!isRecord(entry) || typeof entry.enabled !== 'boolean') throw new Error('本地书源条目无效。');
    let source: ManagedSource;
    if (entry.kind === 'legado') {
      const document = parseRuleSource(entry.document);
      source = { document, enabled: document.enabled ?? true, kind: 'legado' };
    } else {
      // Migrate the earlier prototype's local data without treating it as importable rules.
      if (!['builtin', 'json', 'javascript'].includes(String(entry.kind))) throw new Error('本地书源类型无效。');
      source = { document: parseStaticSource(JSON.stringify(entry.document)), enabled: entry.enabled, kind: entry.kind as StaticManagedSource['kind'] };
    }
    const id = definitionId(source);
    if (ids.has(id)) throw new Error('本地书源地址重复。');
    ids.add(id);
    return source;
  }).filter(entry => !(entry.kind === 'builtin' && entry.document.id === 'sample-library'));
  if (raw.shelfBooks !== undefined && !Array.isArray(raw.shelfBooks)) throw new Error('本地书架数据格式无效。');
  const shelfBooks = (raw.shelfBooks as unknown[] | undefined)?.map(snapshotBook) ?? [];
  return reconcileShelf({ version: 1, definitions, shelf: raw.shelf as string[], shelfBooks });
}
