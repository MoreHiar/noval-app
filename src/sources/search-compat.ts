import type { RuleSourceDocument } from '../domain/books';

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
