import type { RuleSourceDocument } from '../domain/books';

const SERVER = 'https://v1.gyks.cf';
const SEARCH_EXPRESSION = '${base_url}/search?title=${key}&tab=${media}&source=${sources}&page={{page}}&disabled_sources=${disabled_sources},${op}';

// This is a translation of one known Legado rule, not an evaluator for imported JavaScript.
export function isQingtianSearch(document: RuleSourceDocument): boolean {
  return document.bookSourceUrl === '晴天融合VIP4.0' &&
    document.searchUrl?.includes(SEARCH_EXPRESSION) === true &&
    typeof document.jsLib === 'string' && document.jsLib.includes("'https://v1.gyks.cf'") &&
    document.ruleSearch?.bookList === '$.data' &&
    typeof document.ruleSearch.bookUrl === 'string' && document.ruleSearch.bookUrl.includes('"type":"qingtian"');
}

export function qingtianSearchRequest(keyword: string) {
  let title = keyword.trim();
  let tab = '小说';
  const mode = title.match(/^([xtmd])[:：]/i);
  if (mode) {
    tab = ({ x: '小说', t: '听书', m: '漫画', d: '短剧' } as Record<string, string>)[mode[1].toLowerCase()];
    title = title.slice(mode[0].length);
  }
  const separator = title.indexOf('@');
  const source = separator < 0 ? '全部' : title.slice(separator + 1).trim() || '全部';
  if (separator >= 0) title = title.slice(0, separator);
  const url = new URL('/search', SERVER);
  url.searchParams.set('title', title.trim());
  url.searchParams.set('tab', tab);
  url.searchParams.set('source', source);
  url.searchParams.set('page', '1');
  url.searchParams.set('disabled_sources', '0');
  return { url: url.toString(), init: { method: 'GET', headers: {}, credentials: 'omit' as const } };
}

export function qingtianBookUrl(item: { format: string; value: unknown }): string {
  if (item.format !== 'json' || !item.value || typeof item.value !== 'object' || Array.isArray(item.value)) return '';
  const data = item.value as Record<string, unknown>;
  const bookId = data.book_id;
  if ((typeof bookId !== 'string' && typeof bookId !== 'number') || !String(bookId).trim() || typeof data.source !== 'string' || !data.source.trim()) return '';
  const url = new URL('/detail', SERVER);
  url.searchParams.set('book_id', String(bookId));
  url.searchParams.set('source', data.source);
  url.searchParams.set('tab', typeof data.tab === 'string' && data.tab ? data.tab : '小说');
  return url.toString();
}
