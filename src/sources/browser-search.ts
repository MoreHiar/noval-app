import type { RuleSourceDocument } from '../domain/books';
import { browserSource } from './browser-policy';

export function browserSearch(document: RuleSourceDocument, keyword: string) {
  const source = browserSource(document.bookSourceUrl);
  // Washai uses direct requests until its transport detects a verification page.
  if (source === 'washai') return undefined;
  if (!source || document.bookSourceType && document.bookSourceType !== 0) return undefined;
  const query = encodeURIComponent(keyword);
  if (source === 'linovelib') return { source, name: document.bookSourceName, url:`https://w.linovelib.com/search.html?searchkey=${query}&searchtype=all`, selector:'.book-ol li, .book-list li, .book-cell', purpose:'搜索与验证' };
  if (source === 'biquting') return { source, name: document.bookSourceName, url:`https://m.biquting.org/search.html?keyword=${query}`, selector:'.clearfix li .tit',purpose:'搜索与验证' };
  return { source, name: document.bookSourceName, url:`https://m.bg94.cc/s?q=${query}`,selector:'.item dt a',purpose:'搜索与验证' };
}
export function browserSearchRules(document: RuleSourceDocument) {
  if (browserSource(document.bookSourceUrl) !== 'linovelib') return document.ruleSearch ?? {};
  return { bookList:'.book-ol li, .book-list li, .book-cell', name:'.book-title, h3 a, h4 a.0@text',bookUrl:'a.0@href',author:'.book-author@text',intro:'.book-desc, #bookSummary@text',coverUrl:'img@src',kind:'.tag-small@text' };
}
