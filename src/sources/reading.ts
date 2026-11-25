import { parseDocument } from 'htmlparser2';
import { selectAll } from 'css-select';
import { textContent } from 'domutils';
import type { Book, Chapter, ChapterMeta } from '../domain/books';
import { fetchSearchResponse } from './search-transport';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const string = (value: unknown) => typeof value === 'string' ? value : '';
const MAX_CHAPTER_CHARACTERS = 200000;

export function bookUrlFromId(id: string): URL {
  if (!/^web-(?:[0-9a-f]{4})+$/i.test(id) || id.length > 32772) throw new Error('书籍链接无效，请重新搜索。');
  const decoded = id.slice(4).match(/.{4}/g)!.map(value => String.fromCharCode(parseInt(value, 16))).join('');
  const url = new URL(decoded);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('书籍链接无效。');
  return url;
}

export async function fetchReadingPage(url: string, signal?: AbortSignal, timeoutMs = 20000): Promise<string> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; cancel(); }, timeoutMs);
  try {
    const response = await fetchSearchResponse({ url, init: { method: 'GET', headers: {}, credentials: 'omit' } }, controller.signal);
    if (!response.ok) throw new Error(`书源返回 HTTP ${response.status}，请稍后重试。`);
    if (response.url && new URL(response.url).hostname !== new URL(url).hostname) throw new Error('书源跳转到了其他网站，请检查书源地址。');
    if (Number(response.headers.get('content-length')) > 5 * 1024 * 1024) throw new Error('书源响应过大。');
    const html = await response.text();
    if (html.length > 5 * 1024 * 1024) throw new Error('书源响应过大。');
    if (signal?.aborted) throw new Error('已取消加载。');
    if (/<title>\s*(?:Just a moment|Attention Required)/i.test(html)) throw new Error('书源要求网站验证，请稍后重试。');
    return html;
  } catch (error) {
    if (signal?.aborted) { const aborted = new Error('已取消加载。'); aborted.name = 'AbortError'; throw aborted; }
    if (timedOut) throw new Error('书源加载超时，请重试。');
    if (error instanceof TypeError) throw new Error('无法连接书源，请检查网络后重试。');
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', cancel);
  }
}

// Read the public JSON hydration payload as data; never execute a website's scripts.
export function parseInitialState(html: string, siteName: string): Record<string, unknown> {
  const scripts = selectAll('script', parseDocument(html));
  for (const script of scripts) {
    const text = textContent(script);
    const assignment = /window\.__INITIAL_STATE__\s*=\s*\{/.exec(text);
    if (!assignment) continue;
    const start = assignment.index + assignment[0].lastIndexOf('{');
    let depth = 0, quoted = false, escaped = false;
    for (let index = start; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) {
        let value: unknown;
        try { value = JSON.parse(text.slice(start, index + 1)); }
        catch { throw new Error(`${siteName}页面数据格式已变化，请稍后重试。`); }
        if (record(value)) return value;
        break;
      }
    }
  }
  throw new Error(`${siteName}未返回可解析内容，可能需要网站验证或该书已下架。`);
}

export const parseFanqieState = (html: string) => parseInitialState(html, '番茄');

export function fanqieBookNumber(bookId: string): string {
  const url = bookUrlFromId(bookId);
  const number = url.pathname.match(/^\/page\/(\d+)\/?$/)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 'fanqienovel.com' || !number) throw new Error('番茄书籍地址无效，请重新搜索。');
  return number;
}

export function parseFanqieBook(html: string, sourceId: string, bookId: string): { book: Book; chapters: ChapterMeta[] } {
  const page = parseFanqieState(html).page;
  if (!record(page) || string(page.bookId) !== fanqieBookNumber(bookId) || !string(page.bookName)) throw new Error('番茄返回的书籍信息不匹配。');
  const volumes = page.chapterListWithVolume;
  const items: unknown[] = Array.isArray(volumes) && volumes.length ? volumes.flat() : Array.isArray(page.chapterList) ? page.chapterList : [];
  if (items.length > 20000) throw new Error('目录超过 20000 章，暂不支持。');
  const seen = new Set<string>();
  const chapters: ChapterMeta[] = [];
  for (const item of items) {
    if (!record(item) || !/^\d+$/.test(string(item.itemId)) || !string(item.title) || seen.has(string(item.itemId))) continue;
    seen.add(string(item.itemId));
    chapters.push({ id: string(item.itemId), bookId, title: string(item.title), locked: item.isChapterLock === true || Number(item.needPay ?? 0) > 0 });
  }
  if (!chapters.length && Number(page.chapterTotal) > 0) throw new Error('番茄目录格式已变化，未能提取章节。');
  const cover = string(page.thumbUrl) || string(page.thumbUri);
  return {
    book: { id: bookId, sourceId, title: string(page.bookName).slice(0, 512), author: string(page.author) || '未知作者',
      summary: string(page.abstract).slice(0, 4000), category: string(page.category).replace(/\//g, ' · ') || '网络书源',
      status: String(page.creationStatus) === '0' ? '连载中' : String(page.creationStatus) === '1' ? '已完结' : '状态未知', accent: '#526C63',
      ...(/^https?:\/\//.test(cover) ? { coverUrl: cover } : {}) },
    chapters,
  };
}

export function paragraphsFromHtml(html: string): string[] {
  const root = parseDocument(html.replace(/<br\s*\/?\s*>/gi, '\n'));
  for (const node of selectAll('script,style,iframe,noscript', root)) {
    if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node);
  }
  const paragraphs = selectAll('p', root);
  const text = paragraphs.length ? paragraphs.map(node => textContent(node)).join('\n') : textContent(root);
  if (text.length > MAX_CHAPTER_CHARACTERS) throw new Error('单章正文过长，暂不支持。');
  return text.split(/\r?\n/).map(line => line.replace(/\u00a0/g, ' ').trim()).filter(Boolean);
}

export function parseFanqieChapter(html: string, bookId: string, chapterId: string): Chapter {
  const state = parseFanqieState(html);
  const reader = state.reader;
  const data = record(reader) ? reader.chapterData : undefined;
  if (!record(data) || string(data.bookId) !== fanqieBookNumber(bookId) || string(data.itemId) !== chapterId) throw new Error('番茄返回的章节与目录不匹配。');
  if (data.isChapterLock === true || Number(data.needPay ?? 0) > 0) throw new Error('该章节需要在番茄官方应用或网站中解锁。');
  const paragraphs = paragraphsFromHtml(string(data.content));
  if (!paragraphs.length) throw new Error('番茄未返回正文，该章节可能已下架或暂不可读。');
  const css = record(state.common) ? string(state.common.css) : '';
  const fontUrl = css.match(/url\(["']?(https:\/\/lf[36]-awef\.bytetos\.com\/obj\/awesome-font\/[a-zA-Z0-9_/-]+\.otf)["']?\)/)?.[1];
  if (paragraphs.some(line => /[\ue000-\uf8ff]/.test(line)) && !fontUrl) throw new Error('番茄正文字体格式已变化，暂时无法正确显示。');
  return { id: chapterId, bookId, title: string(data.title) || '正文', paragraphs, ...(fontUrl ? { fontUrl } : {}) };
}

export function createFanqieReader(sourceId: string) {
  const catalogs = new Map<string, { expires: number; value: ReturnType<typeof parseFanqieBook> }>();
  const pending = new Map<string, { signal?: AbortSignal; promise: Promise<ReturnType<typeof parseFanqieBook>> }>();
  const chapters = new Map<string, Chapter>();
  async function catalog(bookId: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const cached = catalogs.get(bookId);
    if (cached && cached.expires > Date.now()) return cached.value;
    const request = pending.get(bookId);
    if (request && !request.signal?.aborted) return request.promise;
    const promise = fetchReadingPage(`https://fanqienovel.com/page/${fanqieBookNumber(bookId)}`, signal).then(html => {
      const value = parseFanqieBook(html, sourceId, bookId);
      catalogs.delete(bookId); catalogs.set(bookId, { expires: Date.now() + 300000, value });
      while (catalogs.size > 2) catalogs.delete(catalogs.keys().next().value!);
      return value;
    }).finally(() => { if (pending.get(bookId)?.promise === promise) pending.delete(bookId); });
    pending.set(bookId, { signal, promise });
    return promise;
  }
  return {
    async getBook(bookId: string, signal?: AbortSignal): Promise<Book | null> {
      try { fanqieBookNumber(bookId); } catch { return null; }
      return (await catalog(bookId, signal)).book;
    },
    async getChapters(bookId: string, signal?: AbortSignal) { return (await catalog(bookId, signal)).chapters; },
    async getChapter(bookId: string, chapterId: string, signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (!/^\d+$/.test(chapterId)) throw new Error('章节地址无效。');
      const key = `${bookId}/${chapterId}`;
      const cached = chapters.get(key);
      if (cached) return cached;
      const chapter = parseFanqieChapter(await fetchReadingPage(`https://fanqienovel.com/reader/${chapterId}`, signal), bookId, chapterId);
      chapters.set(key, chapter);
      while (chapters.size > 3) chapters.delete(chapters.keys().next().value!);
      return chapter;
    },
  };
}
