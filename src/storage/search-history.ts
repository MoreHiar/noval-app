import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'noval.search-history.v2';
const LIMIT = 20;
let queue: Promise<unknown> = Promise.resolve();

export function normalizeSearchHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(item => item.length > 0 && item.length <= 100))].slice(0, LIMIT);
}

export function addSearchHistory(history: string[], query: string): string[] {
  const term = query.trim().slice(0, 100);
  return term ? normalizeSearchHistory([term, ...history.filter(item => item !== term)]) : history;
}

async function read(): Promise<string[]> {
  const stored = await AsyncStorage.getItem(KEY);
  if (!stored) return [];
  try { return normalizeSearchHistory(JSON.parse(stored)); }
  catch { return []; }
}

export function loadSearchHistory(): Promise<string[]> {
  return queue.then(read);
}

function update(change: (current: string[]) => string[]): Promise<string[]> {
  const operation = queue.then(async () => {
    const next = change(await read());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });
  queue = operation.catch(() => undefined);
  return operation;
}

export const recordSearchHistory = (query: string) => update(current => addSearchHistory(current, query));
export const removeSearchHistory = (query: string) => update(current => current.filter(item => item !== query));
export const clearSearchHistory = () => update(() => []);
