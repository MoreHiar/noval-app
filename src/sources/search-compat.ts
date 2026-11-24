import type { RuleSourceDocument } from '../domain/books';

export function isLegacyQidianSearch(document: RuleSourceDocument): boolean {
  return document.bookSourceUrl === 'https://m.qidian.com' &&
    document.searchUrl === '/so/{{key}}.html?pageNum={{page}}' &&
    document.ruleSearch?.bookList === '//*[@class="y-list__item"]' &&
    document.ruleSearch?.bookUrl === '{{@@a.0@href##chapter##book}}##\\/0\\/##.html';
}

// A fixed translation of this known form-discovery script, not a JavaScript interpreter.
export function isYuyoukuFormSearch(document: RuleSourceDocument): boolean {
  return document.bookSourceUrl === 'https://www.yuyouku.com/#xsw8093' &&
    document.ruleSearch?.bookList === '.list-group-item[1:-2]' &&
    document.ruleSearch?.bookUrl === 'div.1@a@href' &&
    document.searchUrl?.replace(/\s+/g, '') === YUYOUKU_SEARCH.replace(/\s+/g, '');
}

const YUYOUKU_SEARCH = '@js:\nvar su=source.getKey()\nvar htmlUrl=java.get(su,{}).headers(\'Location\')\njava.log(`重定向：${htmlUrl[0]}`)\nvar posturl=htmlUrl[0]?htmlUrl[0]:(su.includes("#")?su.match(/([^\\#]+)\\#/)[1]:su)\nposturl = posturl.slice(-1)==\'/\'?posturl.slice(0,-1):posturl\ncookie.removeCookie(posturl)\njava.log(`请求：${posturl}`)\n\n\nvar html = java.ajax(posturl);\n\nsearch = org.jsoup.Jsoup.parse(html).select(\'form[role=form]\').attr(\'action\');\n\n\nposturl+search+"?keyword={{key}},"+JSON.stringify({\r\n  "method": "GET"\r\n})';

export function isLegacySuduguSearch(url: URL): boolean {
  return ['www.sudugu.co', 'www.sudugu.cc'].includes(url.hostname) && url.pathname === '/modules/article/search.php';
}

// Compatibility for the public legacy definition, checked against the current site.
// Keep imported/exported documents intact and leave custom rule sets alone.
function hasLegacySuduguRules(document: RuleSourceDocument): boolean {
  const rules = document.ruleSearch ?? {};
  let host: string;
  try { host = new URL(document.bookSourceUrl).hostname; }
  catch { return false; }
  return ['www.sudugu.co', 'www.sudugu.cc'].includes(host) && rules.bookList === 'class.bookbox' && rules.name === 'tag.a.0@text' && rules.author === 'class.author.0@text##作者：';
}

export function searchRulesFor(document: RuleSourceDocument): Record<string, unknown> {
  const rules = document.ruleSearch ?? {};
  if (isLegacyQidianSearch(document)) return {
    // Accommodate both the older wrapper layout and today's server-rendered anchors.
    bookList: '.y-list__item, a[data-bid][href*="/chapter/"]',
    name: 'img@alt##在线阅读',
    bookUrl: 'img@data-src##^.*?/qdbimg/349573/([0-9]+).*$##https://m.qidian.com/book/$1.html',
    author: '[class*="searchBookAuthor"], .y-list__item > a > div > div > p@text',
    intro: '[class*="searchBookDesc"], .y-list__item > a > div > p@text',
    coverUrl: 'img@data-src',
    kind: '[class*="tags"] p:nth-child(-n+2), .y-list__item > a > div > div > div > p:nth-child(-n+2)@text',
  };
  if (!hasLegacySuduguRules(document)) return rules;
  return {
    ...rules,
    // Multiple hits return a list; one hit redirects to the book detail page.
    bookList: '.content > .item, .container > .item:has(h1)',
    name: '.itemtxt h3 a, .itemtxt h1 a@text',
    bookUrl: '.itemtxt h3 a, .itemtxt h1 a@href',
    author: '.itemtxt > p a[href*="authorarticle.php"], .itemtxt:has(h3) > ul > li:first-child@text##^作者：',
    intro: '.itemtxt > p:not(:has(*))@text',
    coverUrl: 'img@src',
  };
}

export function knownSearchCover(document: RuleSourceDocument, bookUrl: string): string | undefined {
  // The list omits artwork; the original source script uses this same image path.
  if (!hasLegacySuduguRules(document)) return;
  const url = new URL(bookUrl);
  if (url.hostname !== 'www.sudugu.cc') return;
  const id = url.pathname.match(/^\/(\d+)\/$/)?.[1];
  if (id) return `https://www.sudugu.cc/files/article/image/${id.length > 3 ? id.slice(0, -3) : '0'}/${id}/${id}s.jpg`;
}
