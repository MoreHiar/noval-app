import type { Book, Chapter, ChapterMeta } from '../domain/books';
import { bookUrlFromId, fetchReadingPage, parseInitialState } from './reading';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const baseUrl = 'https://www.jgwxs.com';

export function jgwxsBookNumber(bookId: string): string {
  const url = bookUrlFromId(bookId);
  const number = url.pathname.match(/^\/novel\/([1-9]\d*)\/?$/)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 'www.jgwxs.com' || !number || url.search || url.hash) {
    throw new Error('甲骨文小说书籍地址无效，请重新搜索。');
  }
  return number;
}

function pageData(html: string) {
  return object(object(parseInitialState(html, '甲骨文小说').app).data);
}

export function parseJgwxsBook(html: string, sourceId: string, bookId: string): { book: Book; chapters: ChapterMeta[] } {
  const data = pageData(html);
  const novel = object(data.novel);
  if (String(novel.id) !== jgwxsBookNumber(bookId) || !text(novel.name)) throw new Error('甲骨文小说返回的书籍信息不匹配。');
  if (!Array.isArray(data.index) || !data.index.length || data.index.length > 20000) throw new Error('甲骨文小说未返回有效目录。');
  const seen = new Set<string>();
  const chapters: ChapterMeta[] = [];
  for (const raw of [...data.index].reverse()) {
    const entry = object(raw);
    const id = String(entry.page);
    if (!/^[1-9]\d*$/.test(id) || !text(entry.title) || seen.has(id)) continue;
    seen.add(id);
    chapters.push({ id, bookId, title: text(entry.title) });
  }
  if (!chapters.length || chapters.length !== data.index.length) throw new Error('甲骨文小说目录不完整，请刷新重试。');
  const cover = text(novel.cover);
  return {
    book: {
      id: bookId, sourceId, title: text(novel.name).slice(0, 512), author: text(novel.authName).slice(0, 256) || '未知作者',
      summary: text(novel.synopsis).slice(0, 4000), category: '网络小说',
      status: novel.end === true ? '已完结' : '连载中', accent: '#526C63',
      ...(cover && !/[/?#\\]/.test(cover) ? { coverUrl: `https://static.ttkan.co/cover/${encodeURIComponent(cover)}` } : {}),
    },
    chapters,
  };
}

export function parseJgwxsChapter(html: string, bookId: string, chapterId: string): Chapter {
  const data = pageData(html);
  const chapter = object(data.chapter);
  if (String(chapter.novelId) !== jgwxsBookNumber(bookId) || String(chapter.page) !== chapterId) {
    throw new Error('甲骨文小说返回的章节与目录不匹配。');
  }
  const content = text(chapter.content);
  if (content.length > 200000) throw new Error('单章正文过长，暂不支持。');
  const paragraphs = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!paragraphs.length) throw new Error('甲骨文小说未返回可阅读的正文。');
  return { id: chapterId, bookId, title: text(chapter.title) || text(data.title) || '正文', paragraphs };
}

export function createJgwxsReader(sourceId: string) {
  const catalogs = new Map<string, { expires: number; value: ReturnType<typeof parseJgwxsBook> }>();
  const pending = new Map<string, { signal?: AbortSignal; promise: Promise<ReturnType<typeof parseJgwxsBook>> }>();
  const bodies = new Map<string, Chapter>();
  async function catalog(bookId: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const cached = catalogs.get(bookId);
    if (cached && cached.expires > Date.now()) return cached.value;
    const running = pending.get(bookId);
    if (running && !running.signal?.aborted) return running.promise;
    const promise = fetchReadingPage(`${baseUrl}/novel/${jgwxsBookNumber(bookId)}`, signal).then(html => {
      const value = parseJgwxsBook(html, sourceId, bookId);
      catalogs.delete(bookId);
      catalogs.set(bookId, { expires: Date.now() + 300000, value });
      while (catalogs.size > 2) catalogs.delete(catalogs.keys().next().value!);
      return value;
    }).finally(() => { if (pending.get(bookId)?.promise === promise) pending.delete(bookId); });
    pending.set(bookId, { signal, promise });
    return promise;
  }
  return {
    async getBook(bookId: string, signal?: AbortSignal): Promise<Book> { return (await catalog(bookId, signal)).book; },
    async getChapters(bookId: string, signal?: AbortSignal): Promise<ChapterMeta[]> { return (await catalog(bookId, signal)).chapters; },
    async getChapter(bookId: string, chapterId: string, signal?: AbortSignal): Promise<Chapter> {
      signal?.throwIfAborted();
      if (!/^[1-9]\d*$/.test(chapterId)) throw new Error('章节标识无效。');
      const number = jgwxsBookNumber(bookId);
      const listed = (await catalog(bookId, signal)).chapters.some(chapter => chapter.id === chapterId);
      if (!listed) throw new Error('章节不在当前书籍目录中。');
      const key = `${bookId}/${chapterId}`;
      const cached = bodies.get(key);
      if (cached) return cached;
      const chapter = parseJgwxsChapter(await fetchReadingPage(`${baseUrl}/chapter/${number}/${chapterId}`, signal), bookId, chapterId);
      bodies.set(key, chapter);
      while (bodies.size > 3) bodies.delete(bodies.keys().next().value!);
      return chapter;
    },
  };
}
