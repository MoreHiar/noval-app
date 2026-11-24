import { parseDocument } from 'htmlparser2';
import { selectAll } from 'css-select';
import { textContent } from 'domutils';
import type { Book, Chapter, ChapterMeta } from '../domain/books';
import { bookUrlFromId, fetchReadingPage, paragraphsFromHtml } from './reading';

const obj = (value: unknown): Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string,unknown> : {};
export function qidianState(html: string) {
  const script=selectAll('script#vite-plugin-ssr_pageContext',parseDocument(html))[0];
  if (!script) throw new Error('起点未返回书籍数据，可能需要验证或页面格式已变化。');
  const data=obj(obj(obj(JSON.parse(textContent(script))).pageContext).pageProps).pageData;
  if(!data || typeof data !== 'object' || Array.isArray(data))throw new Error('起点页面数据格式已变化。');
  return data as Record<string,unknown>;
}
export function qidianBookNumber(bookId: string) {
  const url=bookUrlFromId(bookId);
  const id=url.pathname.match(/^\/book\/(\d+)(?:\.html|\/)?$/)?.[1];
  if (url.hostname !== 'm.qidian.com' || !id) throw new Error('起点书籍地址无效，请重新搜索。');
  return id;
}
export function parseQidianCatalog(html: string, bookId: string): ChapterMeta[] {
  const id=qidianBookNumber(bookId), data=qidianState(html);
  if (String(data.bookId) !== id || !Array.isArray(data.vs)) throw new Error('起点返回的目录与书籍不匹配。');
  const chapters: ChapterMeta[]=[],seen=new Set<string>();
  for (const raw of data.vs) {
    const volume=obj(raw);
    if (!Array.isArray(volume.cs) || Number(volume.cCnt) !== volume.cs.length) throw new Error('起点目录未完整返回，请刷新重试。');
    for (const item of volume.cs) {
      const chapter=obj(item), cid=String(chapter.id);
      if (!/^\d+$/.test(cid) || !chapter.cN || seen.has(cid)) continue;
      seen.add(cid); chapters.push({id:cid,bookId,title:String(chapter.cN),volume:String(volume.vN || ''),locked:Number(volume.vS) === 1 && Number(chapter.sS) !== 1});
    }
  }
  if (!chapters.length || chapters.length > 20000) throw new Error('起点没有返回有效目录，或目录超出 20000 章。');
  return chapters;
}
export function parseQidianChapter(html: string, bookId: string, chapterId: string): Chapter {
  const data=qidianState(html), info=obj(data.bookInfo), chapter=obj(data.chapterInfo);
  if (String(info.bookId ?? info.bid) !== qidianBookNumber(bookId) || String(chapter.chapterId ?? chapter.id) !== chapterId) throw new Error('起点返回的章节与目录不匹配。');
  if (Number(chapter.vipStatus ?? chapter.isVip) === 1 && Number(chapter.isBuy) !== 1 && Number(chapter.limitFree) !== 1) throw new Error('该章节需要在起点官方购买或解锁。');
  const paragraphs=paragraphsFromHtml(String(chapter.content || ''));
  if (!paragraphs.length) throw new Error('起点没有返回可阅读的正文，该章节可能需要官方解锁。');
  return {id:chapterId,bookId,title:String(chapter.chapterName || chapter.cN || '正文'),paragraphs};
}
export function createQidianReader(sourceId: string) {
  const catalogs=new Map<string,ChapterMeta[]>(), pending=new Map<string,{signal?:AbortSignal;promise:Promise<ChapterMeta[]>}>(), bodies=new Map<string,Chapter>();
  return {
    async getBook(bookId: string,signal?:AbortSignal):Promise<Book> {
      const id=qidianBookNumber(bookId), data=qidianState(await fetchReadingPage(`https://m.qidian.com/book/${id}/`,signal)), info=obj(data.bookInfo);
      if (String(info.bookId ?? info.bid) !== id) throw new Error('起点书籍信息不匹配。');
      return {id:bookId,sourceId,title:String(info.bookName || info.bName || ''),author:String(info.authorName || '未知作者'),summary:paragraphsFromHtml(String(info.desc || '')).join('\n'),category:String(info.chanName || info.subCateName || '小说'),status:/完/.test(String(info.actionStatus))?'已完结':'连载中',accent:'#526C63',coverUrl:`https://bookcover.yuewen.com/qdbimg/349573/${id}/180`};
    },
    async getChapters(bookId:string,signal?:AbortSignal):Promise<ChapterMeta[]> {
      signal?.throwIfAborted();
      const cached=catalogs.get(bookId); if(cached)return cached;
      const running=pending.get(bookId);if(running && !running.signal?.aborted)return running.promise;
      const promise=fetchReadingPage(`https://m.qidian.com/book/${qidianBookNumber(bookId)}/catalog/`,signal).then(html=>{
        const chapters=parseQidianCatalog(html,bookId);catalogs.set(bookId,chapters);while(catalogs.size>2)catalogs.delete(catalogs.keys().next().value!);return chapters;
      }).finally(()=>{if(pending.get(bookId)?.promise===promise)pending.delete(bookId);});
      pending.set(bookId,{signal,promise});return promise;
    },
    async getChapter(bookId:string,chapterId:string,signal?:AbortSignal):Promise<Chapter> {
      signal?.throwIfAborted();if(!/^\d+$/.test(chapterId))throw new Error('章节标识无效。');
      const key=`${bookId}/${chapterId}`,cached=bodies.get(key);if(cached)return cached;
      const chapter=parseQidianChapter(await fetchReadingPage(`https://m.qidian.com/chapter/${qidianBookNumber(bookId)}/${chapterId}/`,signal),bookId,chapterId);
      bodies.set(key,chapter);while(bodies.size>3)bodies.delete(bodies.keys().next().value!);return chapter;
    },
  };
}
