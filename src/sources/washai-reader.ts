import { parseDocument } from 'htmlparser2';
import { selectAll } from 'css-select';
import { getInnerHTML, textContent } from 'domutils';
import type { AnyNode } from 'domhandler';
import type { Book, Chapter, ChapterMeta } from '../domain/books';
import { bookUrlFromId, fetchReadingPage, paragraphsFromHtml } from './reading';

const baseUrl = 'https://book.washai.net';
const requestTimeout = 45000;
const digits = /^[1-9]\d*$/;
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const attributes = (node?: AnyNode) => node && 'attribs' in node ? node.attribs : undefined;
const nodeText = (node?: AnyNode) => node ? clean(textContent(node)) : '';

export function washaiBookNumber(bookId: string): string {
  const url = bookUrlFromId(bookId);
  const number = url.pathname.match(/^\/book\/([1-9]\d*)\.html$/)?.[1];
  if (url.origin !== baseUrl || !number || url.search || url.hash) throw new Error('书海阁书籍地址无效，请重新搜索。');
  return number;
}

export function parseWashaiBook(html: string, sourceId: string, bookId: string): Book {
  const number = washaiBookNumber(bookId);
  const root = parseDocument(html);
  const find = (selector: string) => selectAll(selector, root)[0];
  if (attributes(find('#allIndexLink'))?.href !== `/book/indexList-${number}.html`) throw new Error('书海阁返回的书籍信息不匹配。');
  const title = nodeText(find('#bookName'));
  if (!title) throw new Error('书海阁未返回书名。');
  let summary = nodeText(find('#bookDesc'));
  for (const script of selectAll('script[type="application/ld+json"]', root)) {
    try {
      const data = JSON.parse(textContent(script));
      if (data['@type'] === 'Book' && typeof data.description === 'string') summary = data.description;
    } catch { /* Optional structured data may be unavailable. */ }
  }
  const cover = attributes(find('#bookCoverImg'))?.src ?? '';
  const coverUrl = /^\/localPic\/[\w/-]+\.\w+$/.test(cover) ? new URL(cover, baseUrl).toString() : undefined;
  const status = nodeText(find('#bookStatus'));
  return {
    id: bookId, sourceId, title: title.slice(0, 512), author: nodeText(find('#bookAuthor')).slice(0, 256) || '未知作者',
    summary: summary.slice(0, 4000), category: nodeText(find('#bookCatBadge')).slice(0, 128) || '网络小说',
    status: status === '已完结' ? '已完结' : status === '连载中' ? '连载中' : '状态未知', accent: '#526C63',
    ...(coverUrl ? { coverUrl } : {}),
  };
}

export function parseWashaiCatalogPage(html: string, bookId: string, page: number) {
  const number = washaiBookNumber(bookId);
  const root = parseDocument(html);
  const pager = attributes(selectAll('#indexPager', root)[0]);
  const total = Number(pager?.['data-total']);
  const size = Number(pager?.['data-page-size']);
  if (pager?.['data-book-id'] !== number || Number(pager?.['data-page']) !== page || pager?.['data-order'] !== 'asc' ||
      !Number.isSafeInteger(total) || total < 1 || total > 20000 || size !== 100 || pager?.['data-ssr-complete'] !== '1') {
    throw new Error('书海阁目录信息无效或与书籍不匹配。');
  }
  const chapters: ChapterMeta[] = [];
  let volume = '';
  for (const item of selectAll('#bookIndexList > li', root)) {
    if (attributes(item)?.class?.includes('catalogVolumeHeading')) { volume = nodeText(item); continue; }
    const id = attributes(item)?.['data-index-id'] ?? '';
    const link = selectAll('a', item)[0];
    if (!digits.test(id) || attributes(link)?.href !== `/book/${number}/${id}.html`) throw new Error('书海阁目录包含无效章节。');
    const title = clean((link.children ?? []).filter(child => child.type === 'text').map(child => textContent(child)).join(''));
    if (!title) throw new Error('书海阁目录缺少章节标题。');
    chapters.push({ id, bookId, title: title.slice(0, 512), locked: !selectAll('i', link).some(node => /\[免费\]/.test(textContent(node))), ...(volume ? { volume } : {}) });
  }
  const expected = Math.min(size, total - (page - 1) * size);
  if (expected < 1 || chapters.length !== expected) throw new Error('书海阁目录分页不完整，请稍后重试。');
  return { total, chapters };
}

export function parseWashaiChapter(html: string, bookId: string, chapterId: string): Chapter {
  const number = washaiBookNumber(bookId);
  if (!digits.test(chapterId)) throw new Error('书海阁章节标识无效。');
  const root = parseDocument(html);
  const bootstrap = selectAll('#readPageBootstrap', root)[0];
  let data: Record<string, unknown>;
  try { data = JSON.parse(bootstrap ? textContent(bootstrap) : ''); }
  catch { throw new Error('书海阁未返回有效章节数据。'); }
  const book = data.book as Record<string, unknown> | undefined;
  const index = data.bookIndex as Record<string, unknown> | undefined;
  if (String(book?.id) !== number || String(index?.bookId) !== number || String(index?.id) !== chapterId) {
    throw new Error('书海阁返回的章节与目录不匹配。');
  }
  if (data.needBuy === true) throw new Error('该章节需要在书海阁网站解锁。');
  const body = selectAll(`#showReading .readChapterPrimaryBlock[data-index-id="${chapterId}"] .readChapterAppendBody`, root)[0];
  const paragraphs = body ? paragraphsFromHtml(getInnerHTML(body)) : [];
  if (!paragraphs.length) throw new Error('书海阁未返回可阅读的正文。');
  return { id: chapterId, bookId, title: String(index?.indexName || '正文').slice(0, 512), paragraphs };
}

export function createWashaiReader(sourceId: string) {
  const books = new Map<string, Book>();
  const catalogs = new Map<string, { expires: number; chapters: ChapterMeta[] }>();
  const bodies = new Map<string, Chapter>();
  async function catalog(bookId: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const cached = catalogs.get(bookId);
    if (cached && cached.expires > Date.now()) return cached.chapters;
    const number = washaiBookNumber(bookId);
    const first = parseWashaiCatalogPage(await fetchReadingPage(`${baseUrl}/book/indexList-${number}.html`, signal, requestTimeout), bookId, 1);
    const pages = Math.ceil(first.total / 100);
    const chapters = [...first.chapters];
    for (let start = 2; start <= pages; start += 4) {
      const batch = Array.from({ length: Math.min(4, pages - start + 1) }, (_, offset) => start + offset);
      const results = await Promise.all(batch.map(async page => parseWashaiCatalogPage(
        await fetchReadingPage(`${baseUrl}/book/indexList/${number}/${page}.html`, signal, requestTimeout), bookId, page,
      )));
      for (const result of results) {
        if (result.total !== first.total) throw new Error('书海阁目录总章数在加载期间发生变化，请刷新重试。');
        chapters.push(...result.chapters);
      }
    }
    if (chapters.length !== first.total || new Set(chapters.map(chapter => chapter.id)).size !== first.total) {
      throw new Error('书海阁目录不完整，请刷新重试。');
    }
    catalogs.delete(bookId);
    catalogs.set(bookId, { expires: Date.now() + 300000, chapters });
    while (catalogs.size > 2) catalogs.delete(catalogs.keys().next().value!);
    return chapters;
  }
  return {
    async getBook(bookId: string, signal?: AbortSignal): Promise<Book> {
      signal?.throwIfAborted();
      const cached = books.get(bookId);
      if (cached) return cached;
      const book = parseWashaiBook(await fetchReadingPage(`${baseUrl}/book/${washaiBookNumber(bookId)}.html`, signal, requestTimeout), sourceId, bookId);
      books.set(bookId, book);
      while (books.size > 2) books.delete(books.keys().next().value!);
      return book;
    },
    getChapters: catalog,
    async getChapter(bookId: string, chapterId: string, signal?: AbortSignal): Promise<Chapter> {
      signal?.throwIfAborted();
      if (!digits.test(chapterId)) throw new Error('书海阁章节标识无效。');
      const listed = (await catalog(bookId, signal)).find(chapter => chapter.id === chapterId);
      if (!listed) throw new Error('章节不在当前书籍目录中。');
      if (listed.locked) throw new Error('该章节需要在书海阁网站解锁。');
      const key = `${bookId}/${chapterId}`;
      const cached = bodies.get(key);
      if (cached) return cached;
      const chapter = parseWashaiChapter(await fetchReadingPage(`${baseUrl}/book/${washaiBookNumber(bookId)}/${chapterId}.html`, signal, requestTimeout), bookId, chapterId);
      bodies.set(key, chapter);
      while (bodies.size > 3) bodies.delete(bodies.keys().next().value!);
      return chapter;
    },
  };
}
