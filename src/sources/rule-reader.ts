import { parseDocument } from 'htmlparser2';
import { selectAll } from 'css-select';
import type { Book, Chapter, ChapterMeta, RuleSourceDocument } from '../domain/books';
import { compileFieldRule, compileListRule, UnsupportedSearchRule } from './legado-rules';
import { ruleSourceId } from './legado';
import { bookUrlFromId, fetchReadingPage, paragraphsFromHtml } from './reading';

function ruleObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function idFromUrl(url: string): string {
  return 'web-' + Array.from(url).map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
}

function httpUrl(value: string, base: string): string {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('书源返回了无效链接。');
  return url.toString();
}

function root(body: string) {
  return (body.trim().startsWith('{') || body.trim().startsWith('[') ? compileListRule('$')(body) : compileListRule('body')(`<body>${body}</body>`))[0];
}

export function imageUrlsFromRule(body: string, expression: string, baseUrl: string): string[] {
  const direct = !expression.includes('@') && !expression.startsWith('$') ? compileListRule(expression)(body)
    .map(node => compileFieldRule('@data-original')(node) || compileFieldRule('@data-src')(node) || compileFieldRule('@src')(node)).filter(Boolean) : [];
  const node = root(body);
  if (!node) return [];
  const value = compileFieldRule(expression)(node);
  const candidates: string[] = [...direct];
  if (/<(?:img|source)\b/i.test(value)) {
    for (const image of selectAll('img,source', parseDocument(value))) {
      if ('attribs' in image) {
        const attrs = image.attribs as Record<string, string>;
        candidates.push(attrs['data-original'] || attrs['data-src'] || attrs.src || attrs.srcset?.split(',')[0]?.trim().split(/\s+/)[0] || '');
      }
    }
  } else if (/@(?:src|data-src|data-original)(?:##|$)/i.test(expression) || /^\$/.test(expression)) {
    candidates.push(...value.split(/\s+/));
  } else if (!direct.length && expression && !expression.includes('@') && !expression.startsWith('$')) {
    return imageUrlsFromRule(body, `${expression}@html`, baseUrl);
  }
  const urls = new Set<string>();
  for (const item of candidates.slice(0, 300)) {
    if (!item || /^data:|^javascript:/i.test(item)) continue;
    try { urls.add(httpUrl(item, baseUrl)); } catch { /* Skip malformed optional images. */ }
  }
  return [...urls];
}

export function createRuleReader(document: RuleSourceDocument) {
  const info = ruleObject(document.ruleBookInfo);
  const toc = ruleObject(document.ruleToc);
  const content = ruleObject(document.ruleContent);
  if (!info || !toc || !content) return undefined;
  try {
    const title = compileFieldRule(info.name);
    const author = compileFieldRule(info.author);
    const summary = compileFieldRule(info.intro);
    const cover = compileFieldRule(info.coverUrl);
    const tocUrl = compileFieldRule(info.tocUrl);
    const chapterList = compileListRule(toc.chapterList);
    const chapterName = compileFieldRule(toc.chapterName);
    const chapterUrl = compileFieldRule(toc.chapterUrl);
    const contentRule = content.content;
    if (typeof contentRule !== 'string' || !contentRule.trim()) return undefined;
    compileFieldRule(contentRule);
    const sourceId = ruleSourceId(document);
    const isManga = document.bookSourceType === 2;
    const details = new Map<string, Promise<{ book: Book; chaptersUrl: string }>>();
    const catalogs = new Map<string, ChapterMeta[]>();
    async function detail(bookId: string, signal?: AbortSignal) {
      const old = details.get(bookId);
      if (old) return old;
      const promise = (async () => {
        const url = bookUrlFromId(bookId).toString();
        const node = root(await fetchReadingPage(url, signal));
        if (!node) throw new Error('书源未返回作品详情。');
        let coverUrl: string | undefined;
        try { if (cover(node)) coverUrl = httpUrl(cover(node), url); } catch { /* Cover is optional. */ }
        const book: Book = {
          id: bookId, sourceId, title: title(node).slice(0, 512) || '未命名作品', author: author(node).slice(0, 256) || '未知作者',
          summary: summary(node).slice(0, 4000), category: isManga ? '漫画' : '网络书源', status: '状态未知', accent: isManga ? '#455D6B' : '#526C63',
          ...(isManga ? { mediaType: 'manga' as const } : {}), ...(coverUrl ? { coverUrl } : {}),
        };
        const chaptersUrl = tocUrl(node) ? httpUrl(tocUrl(node), url) : url;
        return { book, chaptersUrl };
      })().catch(error => { details.delete(bookId); throw error; });
      details.set(bookId, promise);
      while (details.size > 10) details.delete(details.keys().next().value!);
      return promise;
    }
    return {
      async getBook(bookId: string, signal?: AbortSignal): Promise<Book | null> { return (await detail(bookId, signal)).book; },
      async getChapters(bookId: string, signal?: AbortSignal): Promise<ChapterMeta[]> {
        const cached = catalogs.get(bookId);
        if (cached) return cached;
        const { chaptersUrl } = await detail(bookId, signal);
        const body = await fetchReadingPage(chaptersUrl, signal);
        const seen = new Set<string>();
        const chapters = chapterList(body).slice(0, 20000).flatMap(item => {
          const name = chapterName(item).trim();
          const link = chapterUrl(item).trim();
          if (!name || !link) return [];
          let url: string;
          try { url = httpUrl(link, chaptersUrl); } catch { return []; }
          const id = idFromUrl(url);
          if (seen.has(id)) return [];
          seen.add(id);
          return [{ id, bookId, title: name.slice(0, 512) }];
        });
        if (toc.reverse === true) chapters.reverse();
        catalogs.set(bookId, chapters);
        while (catalogs.size > 5) catalogs.delete(catalogs.keys().next().value!);
        return chapters;
      },
      async getChapter(bookId: string, chapterId: string, signal?: AbortSignal): Promise<Chapter | null> {
        const chapters = await this.getChapters(bookId, signal);
        const chapter = chapters.find(item => item.id === chapterId);
        if (!chapter) return null;
        const url = bookUrlFromId(chapterId).toString();
        const body = await fetchReadingPage(url, signal);
        if (isManga) {
          const imageUrls = imageUrlsFromRule(body, contentRule, url);
          if (!imageUrls.length) throw new Error('此话没有可读取的图片，请检查漫画正文规则。');
          return { ...chapter, paragraphs: [], imageUrls };
        }
        const node = root(body);
        const value = node ? compileFieldRule(contentRule)(node) : '';
        const paragraphs = paragraphsFromHtml(value);
        if (!paragraphs.length) throw new Error('此章没有可读取的正文。');
        return { ...chapter, paragraphs };
      },
    };
  } catch (error) {
    if (error instanceof UnsupportedSearchRule) return undefined;
    throw error;
  }
}
