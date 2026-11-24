import type { ManagedSource, RuleManagedSource, RuleSourceDocument, StaticManagedSource } from '../domain/books';
import { definitionId, isRuleSource, parseRuleSource, readSourceJson, ruleSourceId } from './legado';
import { parseStaticSource } from './static';

export type LibraryData = { version: 1; definitions: ManagedSource[]; shelf: string[] };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

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
  return { ...current, definitions, shelf: pruneShelf(shelf, definitions) };
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
  return { data: { ...current, definitions, shelf: pruneShelf(current.shelf, definitions) }, added, updated, skipped };
}

export function deleteDefinition(current: LibraryData, id: string): LibraryData {
  const definitions = current.definitions.filter(item => definitionId(item) !== id);
  return { ...current, definitions, shelf: pruneShelf(current.shelf, definitions) };
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
  return { ...current, definitions, shelf: pruneShelf(current.shelf, definitions) };
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
  });
  return { version: 1, definitions, shelf: pruneShelf(raw.shelf as string[], definitions) };
}
