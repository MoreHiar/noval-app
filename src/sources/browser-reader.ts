import { parseDocument } from 'htmlparser2';
import { selectAll } from 'css-select';
import { getInnerHTML, textContent } from 'domutils';
import type { Book, Chapter, ChapterMeta, RuleSourceDocument } from '../domain/books';
import { allowedBrowserUrl, browserSource } from './browser-policy';
import { loadBrowserPage } from './browser-session';
import { bookUrlFromId, paragraphsFromHtml } from './reading';
import { ruleSourceId } from './legado';

export const urlBookId=(url:string)=>'web-'+url.split('').map(char=>char.charCodeAt(0).toString(16).padStart(4,'0')).join('');
const attribute=(node:unknown,key:string):string=>{const value=node as {attribs?:Record<string,string>}|undefined;return value?.attribs?.[key]||'';};
export function createBrowserReader(document:RuleSourceDocument) {
  const source=browserSource(document.bookSourceUrl)!;
  const sourceId=ruleSourceId(document);
  const catalogs=new Map<string,{book:Book;chapters:ChapterMeta[]}>();
  const pending=new Map<string,{signal?:AbortSignal;promise:Promise<{book:Book;chapters:ChapterMeta[]}>}>();
  const bodies=new Map<string,Chapter>();
  const page=(url:string,selector:string,purpose:string,signal?:AbortSignal)=>loadBrowserPage({source,name:document.bookSourceName,url,selector,purpose},signal);
  const valid=(url:string)=>{if(!allowedBrowserUrl(source,url))throw new Error('书源链接跳转到了未确认的网站。');return url;};
  async function catalog(bookId:string,signal?:AbortSignal) {
    signal?.throwIfAborted();const cached=catalogs.get(bookId);if(cached)return cached;
    const running=pending.get(bookId);if(running&&!running.signal?.aborted)return running.promise;
    const promise=(async()=>{
      const url=valid(bookUrlFromId(bookId).href);
      const info=await page(url,'meta[property="og:novel:book_name"], .book-title, .bookname, h1','加载书籍',signal);
      const root=parseDocument(info.html);
      const meta=(name:string)=>attribute(selectAll(`meta[property="${name}"]`,root)[0],'content');
      const title=meta('og:novel:book_name')||meta('og:title')||textContent(selectAll('h1, .book-title, .bookname',root)[0]||root).trim().slice(0,512);
      const cover=meta('og:image');
      const book:Book={id:bookId,sourceId,title,author:meta('og:novel:author')||'未知作者',summary:meta('og:description')||textContent(selectAll('#bookSummary, .intro',root)[0]||parseDocument('')).trim().slice(0,4000),category:meta('og:novel:category')||'小说',status:/完/.test(meta('og:novel:status'))?'已完结':'状态未知',accent:'#526C63',...(cover?{coverUrl:new URL(cover,info.url).href}:{})};
      const selector=source==='linovelib'?'#volumes a, .volume-list a, .catalog a':source==='biquting'?'#ul1 li a':'dl dd a';
      let toc=info;
      if(!selectAll(selector,root).length){
        const link=selectAll(source==='linovelib'?'a.btn-normal.red, a[href*="catalog"]':source==='bg94'?'.book_more a':'a[href*="list"], a[href*="catalog"]',root).map(node=>attribute(node,'href')).find(Boolean);
        if(!link)throw new Error('书籍页未找到目录入口，请检查站点是否已更新。');
        toc=await page(valid(new URL(link,info.url).href),selector,'加载目录',signal);
      }
      const seen=new Set<string>(),chapters:ChapterMeta[]=[];
      let unresolved=0;
      for(const node of selectAll(selector,parseDocument(toc.html))){
        const href=attribute(node,'href'),title=textContent(node).trim();
        if(!href||!title)continue;
        if(/^javascript:/i.test(href)){unresolved++;continue;}
        const url=new URL(href,toc.url).href;
        if(!allowedBrowserUrl(source,url)||seen.has(url))continue;
        seen.add(url);chapters.push({id:urlBookId(url),bookId,title});
      }
      if(unresolved)throw new Error(`目录有 ${unresolved} 个章节链接尚未由网站生成，请在验证网页中等待加载后重试。`);
      if(!chapters.length||chapters.length>20000)throw new Error('网站未返回有效目录，或目录超过 20000 章。');
      const value={book,chapters};catalogs.set(bookId,value);while(catalogs.size>2)catalogs.delete(catalogs.keys().next().value!);return value;
    })().finally(()=>{if(pending.get(bookId)?.promise===promise)pending.delete(bookId);});
    pending.set(bookId,{signal,promise});return promise;
  }
  return {
    async getBook(bookId:string,signal?:AbortSignal){return(await catalog(bookId,signal)).book;},
    async getChapters(bookId:string,signal?:AbortSignal){return(await catalog(bookId,signal)).chapters;},
    async getChapter(bookId:string,chapterId:string,signal?:AbortSignal):Promise<Chapter>{
      signal?.throwIfAborted();const key=`${bookId}/${chapterId}`,cached=bodies.get(key);if(cached)return cached;
      const chapters=(await catalog(bookId,signal)).chapters,meta=chapters.find(item=>item.id===chapterId);
      if(!meta)throw new Error('章节不在当前书籍目录中，请返回目录刷新。');
      let url=valid(bookUrlFromId(chapterId).href);
      const selector=source==='linovelib'?'#acontent, #TextContent, .read-content':source==='biquting'?'.read-section':'#chaptercontent';
      const paragraphs:string[]=[],seen=new Set<string>();
      for(let count=0;count<20;count++){
        if(seen.has(url))throw new Error('章节分页出现循环，已停止加载。');seen.add(url);
        const result=await page(url,selector,'加载正文',signal),root=parseDocument(result.html);
        const content=selectAll(selector,root)[0];if(!content)throw new Error('网页未返回正文，请完成验证后重试。');
        for(const node of selectAll('script,style,iframe,.ads,[data-ad-client]',content)){if(node.parent)node.parent.children=node.parent.children.filter(item=>item!==node);}
        paragraphs.push(...paragraphsFromHtml(getInnerHTML(content)));
        if(paragraphs.join('').length>200000)throw new Error('单章正文超过 200000 字符。');
        const next=selectAll('a',root).find(node=>textContent(node).trim()==='下一页');
        const nextLink=attribute(next,'href')||result.html.match(/url_next\s*:\s*['"]([^'"]+)['"]/)?.[1];
        if(!nextLink)break;
        const nextUrl=new URL(nextLink,result.url);
        // Only merge pages with the same chapter stem; next chapter stays a reader action.
        const stem=(path:string)=>path.replace(/_\d+(?=\.html$)/,'');
        if(stem(nextUrl.pathname)!==stem(new URL(url).pathname))break;
        url=valid(nextUrl.href);if(count===19)throw new Error('单章分页超过 20 页，请在网站阅读。');
      }
      if(!paragraphs.length)throw new Error('没有可阅读的正文。');
      const chapter={id:chapterId,bookId,title:meta.title,paragraphs};bodies.set(key,chapter);while(bodies.size>3)bodies.delete(bodies.keys().next().value!);return chapter;
    },
  };
}
