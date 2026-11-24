import type { ManagedSource, RuleManagedSource, RuleSourceDocument } from '../domain/books';

export const isRuleSource = (entry: ManagedSource): entry is RuleManagedSource => entry.kind === 'legado';
// Hex code units are collision-free and survive Router's query decoding unchanged.
export const ruleSourceId = (document: RuleSourceDocument) => `legado-${document.bookSourceUrl.trim().split('').map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;
export const definitionId = (entry: ManagedSource) => isRuleSource(entry) ? ruleSourceId(entry.document) : entry.document.id;

export function readSourceJson(input: string): unknown {
  if (/^\s*</.test(input)) throw new Error('这个地址返回了网页，请使用直接返回书源 JSON 的地址，或下载 JSON 文件后本地导入。');
  try { return JSON.parse(input.replace(/^\uFEFF/, '')); }
  catch { throw new Error('JSON 格式无效，请检查文件是否完整、标点和引号是否正确。'); }
}

export function parseRuleSource(raw: unknown): RuleSourceDocument {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('书源必须是 JSON 对象。');
  const item = raw as Record<string, unknown>;
  for (const key of ['bookSourceName', 'bookSourceUrl']) {
    if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`缺少 ${key}：请使用「阅读 / Legado」规则书源格式。`);
  }
  for (const key of ['bookSourceGroup', 'bookSourceComment', 'searchUrl', 'exploreUrl']) {
    if (item[key] !== undefined && typeof item[key] !== 'string') throw new Error(`${key} 必须是字符串。`);
  }
  for (const key of ['enabled', 'enabledExplore', 'enabledCookieJar']) {
    if (item[key] !== undefined && typeof item[key] !== 'boolean') throw new Error(`${key} 必须为 true 或 false。`);
  }
  if (item.bookSourceType !== undefined && (!Number.isInteger(item.bookSourceType) || ![0, 1, 2, 3].includes(item.bookSourceType as number))) {
    throw new Error('bookSourceType 应为 0（文本）、1（音频）、2（图片）或 3（文件）。');
  }
  for (const key of ['ruleSearch', 'ruleBookInfo', 'ruleToc', 'ruleContent', 'ruleExplore']) {
    if (item[key] !== undefined && (typeof item[key] !== 'object' || item[key] === null || Array.isArray(item[key]))) throw new Error(`${key} 必须是规则对象。`);
  }
  return item as RuleSourceDocument;
}

export const sourceTypeName = (document: RuleSourceDocument) => ['文本', '音频', '图片', '文件'][document.bookSourceType ?? 0];

// Template used when creating a custom source.
export const ruleSourceExample: RuleSourceDocument = {
  bookSourceName: '示例书源（请替换网站与规则）',
  bookSourceUrl: 'https://example.com',
  bookSourceType: 0,
  bookSourceGroup: '自定义',
  bookSourceComment: '格式示例，不提供真实书籍。请按目标网站填写解析规则。',
  enabled: true,
  enabledCookieJar: true,
  enabledExplore: false,
  searchUrl: '/search?keyword={{key}}&page={{page}}',
  ruleSearch: { bookList: '.book-list li', name: 'a@text', author: '.author@text', bookUrl: 'a@href', coverUrl: 'img@src' },
  ruleBookInfo: { name: 'h1@text', author: '.author@text', intro: '.intro@text', tocUrl: '.catalog@href' },
  ruleToc: { chapterList: '.chapter-list a', chapterName: 'text', chapterUrl: 'href' },
  ruleContent: { content: '#content@html' },
};
