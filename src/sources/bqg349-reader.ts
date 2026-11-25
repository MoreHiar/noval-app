import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import type { Book, Chapter, ChapterMeta } from '../domain/books';
import { bookUrlFromId, fetchReadingPage, paragraphsFromHtml } from './reading';

export const BQG349_URL = 'https://www.bqg349.xyz';
type Metadata = { book: Book; directoryId: string; count: number };
type Pending<T> = { signal?: AbortSignal; promise: Promise<T> };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const validNumber = (value: unknown) => /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));

function json(body: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new Error('笔趣阁349未返回有效 JSON，请稍后重试。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('笔趣阁349返回的数据格式无效。');
  const record = value as Record<string, unknown>;
  if (Number(record.code) >= 400 || record.error) throw new Error('笔趣阁349接口返回错误，请稍后重试。');
  return record;
}

export function bqg349BookNumber(bookId: string): string {
  const url = bookUrlFromId(bookId);
  const number = url.hash.match(/^#\/book\/([1-9]\d*)\/?$/)?.[1];
  if (url.origin !== BQG349_URL || url.pathname !== '/' || url.search || !number || !validNumber(number)) throw new Error('笔趣阁349书籍地址无效，请重新搜索。');
  return number;
}

export function bqg349CoverUrl(number: string): string {
  return `${BQG349_URL}/bookimg/${Math.floor(Number(number) / 1000)}/${number}.jpg`;
}

export function bqg349Request(action: 'book' | 'booklist' | 'chapter', id: string, chapterId?: string): string {
  if (!validNumber(id) || (action === 'chapter' && !validNumber(chapterId))) throw new Error('笔趣阁349书籍或章节标识无效。');
  // Fixed parameters from the site's public read.js request format. Never load or
  // evaluate downloaded scripts in the app. This is not a login credential.
  const payload = JSON.stringify(action === 'chapter' ? { id: Number(id), chapterid: Number(chapterId) } : { id: Number(id) });
  const token = AES.encrypt(payload, Utf8.parse('a3dc22cf70418a51'), { iv: Utf8.parse('394c2c3202da6270') }).toString();
  return `${BQG349_URL}/api/${action}?token=${encodeURIComponent(token)}`;
}

export function parseBqg349Book(body: string, sourceId: string, bookId: string): Metadata {
  const data = json(body);
  const number = bqg349BookNumber(bookId);
  if (String(data.id) !== number || !validNumber(data.dirid) || !text(data.title)) throw new Error('笔趣阁349返回的书籍信息不匹配。');
  if (!validNumber(data.lastchapterid) || Number(data.lastchapterid) > 20000) throw new Error('笔趣阁349未返回有效章数，或目录超过 20000 章。');
  const status = text(data.full);
  return {
    directoryId: String(data.dirid), count: Number(data.lastchapterid),
    book: { id: bookId, sourceId, title: text(data.title).slice(0, 512), author: text(data.author).slice(0, 256) || '未知作者',
      summary: paragraphsFromHtml(text(data.intro)).join('\n').slice(0, 4000), category: text(data.sortname).slice(0, 128) || '网络小说',
      status: /完/.test(status) ? '已完结' : /连载/.test(status) ? '连载中' : '状态未知', accent: '#526C63', coverUrl: bqg349CoverUrl(number) },
  };
}

export function parseBqg349Catalog(body: string, bookId: string, count: number): ChapterMeta[] {
  bqg349BookNumber(bookId);
  const { list } = json(body);
  if (!Array.isArray(list) || !list.length || list.length > 20000 || list.length !== count || list.some(title => !text(title))) throw new Error('笔趣阁349目录不完整或已更新，请刷新重试。');
  return list.map((title, index) => ({ id: String(index + 1), bookId, title: text(title).slice(0, 512) }));
}

export function parseBqg349Chapter(body: string, bookId: string, chapterId: string, directoryId: string): Chapter {
  const data = json(body);
  if (!validNumber(chapterId) || String(data.id) !== bqg349BookNumber(bookId) || String(data.dirid) !== directoryId || String(data.chapterid) !== chapterId) throw new Error('笔趣阁349返回的章节与当前书籍或目录不匹配。');
  const content = text(data.txt);
  if (!content || !text(data.chaptername)) throw new Error('笔趣阁349未返回可阅读的正文。');
  if (content.length > 200000) throw new Error('单章正文超过 200000 字符，暂不支持。');
  const paragraphs = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return { id: chapterId, bookId, title: text(data.chaptername).slice(0, 512), paragraphs };
}

export function createBqg349Reader(sourceId: string) {
  const metadata = new Map<string, { value: Metadata; expires: number }>();
  const catalogs = new Map<string, { value: ChapterMeta[]; expires: number }>();
  const pendingInfo = new Map<string, Pending<Metadata>>();
  const pendingCatalog = new Map<string, Pending<ChapterMeta[]>>();
  const bodies = new Map<string, Chapter>();

  function info(bookId: string, signal?: AbortSignal): Promise<Metadata> {
    signal?.throwIfAborted();
    const number = bqg349BookNumber(bookId);
    const cached = metadata.get(bookId);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    const running = pendingInfo.get(bookId);
    if (running && running.signal === signal && !signal?.aborted) return running.promise;
    const promise = fetchReadingPage(bqg349Request('book', number), signal).then(body => {
      const value = parseBqg349Book(body, sourceId, bookId);
      metadata.delete(bookId); metadata.set(bookId, { value, expires: Date.now() + 300000 });
      while (metadata.size > 2) metadata.delete(metadata.keys().next().value!);
      return value;
    }).finally(() => { if (pendingInfo.get(bookId)?.promise === promise) pendingInfo.delete(bookId); });
    pendingInfo.set(bookId, { signal, promise });
    return promise;
  }

  function catalog(bookId: string, signal?: AbortSignal): Promise<ChapterMeta[]> {
    signal?.throwIfAborted();
    bqg349BookNumber(bookId);
    const cached = catalogs.get(bookId);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    const running = pendingCatalog.get(bookId);
    if (running && running.signal === signal && !signal?.aborted) return running.promise;
    const promise = (async () => {
      const { directoryId, count } = await info(bookId, signal);
      const chapters = parseBqg349Catalog(await fetchReadingPage(bqg349Request('booklist', directoryId), signal), bookId, count);
      catalogs.delete(bookId); catalogs.set(bookId, { value: chapters, expires: Date.now() + 300000 });
      while (catalogs.size > 2) catalogs.delete(catalogs.keys().next().value!);
      return chapters;
    })().finally(() => { if (pendingCatalog.get(bookId)?.promise === promise) pendingCatalog.delete(bookId); });
    pendingCatalog.set(bookId, { signal, promise });
    return promise;
  }

  return {
    async getBook(bookId: string, signal?: AbortSignal) { return (await info(bookId, signal)).book; },
    async getChapters(bookId: string, signal?: AbortSignal) { return catalog(bookId, signal); },
    async getChapter(bookId: string, chapterId: string, signal?: AbortSignal): Promise<Chapter> {
      signal?.throwIfAborted();
      if (!validNumber(chapterId)) throw new Error('笔趣阁349章节标识无效。');
      const chapters = await catalog(bookId, signal);
      if (!chapters.some(chapter => chapter.id === chapterId)) throw new Error('章节不在当前书籍目录中。');
      const key = `${bookId}/${chapterId}`;
      const cached = bodies.get(key);
      if (cached) return cached;
      const number = bqg349BookNumber(bookId);
      const { directoryId } = await info(bookId, signal);
      const chapter = parseBqg349Chapter(await fetchReadingPage(bqg349Request('chapter', number, chapterId), signal), bookId, chapterId, directoryId);
      bodies.set(key, chapter);
      while (bodies.size > 3) bodies.delete(bodies.keys().next().value!);
      return chapter;
    },
  };
}
