export type SourceKind = 'builtin' | 'json' | 'javascript';

export type SourceInfo = {
  id: string;
  name: string;
  kind: SourceKind;
  description: string;
};

export type Book = {
  id: string;
  sourceId: string;
  title: string;
  author: string;
  summary: string;
  category: string;
  status: '连载中' | '已完结';
  accent: string;
};

export type ChapterMeta = {
  id: string;
  bookId: string;
  title: string;
};

export type Chapter = ChapterMeta & {
  paragraphs: string[];
};

export type SourceAdapter = {
  info: SourceInfo;
  search(query: string): Promise<Book[]>;
  getBook(bookId: string): Promise<Book | null>;
  getChapters(bookId: string): Promise<ChapterMeta[]>;
  getChapter(bookId: string, chapterId: string): Promise<Chapter | null>;
};

export type StaticSourceDocument = {
  version: 1;
  id: string;
  name: string;
  description?: string;
  books: Omit<Book, 'sourceId'>[];
  chapters: Chapter[];
};

// Offline fixtures belong to the demo reader, not to the Legado exchange format.
export type StaticManagedSource = {
  kind: SourceKind;
  enabled: boolean;
  document: StaticSourceDocument;
};

export type RuleSourceDocument = {
  bookSourceName: string;
  bookSourceUrl: string;
  bookSourceType?: number;
  bookSourceGroup?: string;
  bookSourceComment?: string;
  enabled?: boolean;
  enabledCookieJar?: boolean;
  enabledExplore?: boolean;
  searchUrl?: string;
  exploreUrl?: string;
  ruleSearch?: Record<string, unknown>;
  ruleBookInfo?: Record<string, unknown>;
  ruleToc?: Record<string, unknown>;
  ruleContent?: Record<string, unknown>;
  ruleExplore?: Record<string, unknown>;
  // Preserve scripts, headers, login settings and future Legado fields verbatim.
  [key: string]: unknown;
};

export type RuleManagedSource = {
  kind: 'legado';
  enabled: boolean;
  document: RuleSourceDocument;
};

export type ManagedSource = StaticManagedSource | RuleManagedSource;
