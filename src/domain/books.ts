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
