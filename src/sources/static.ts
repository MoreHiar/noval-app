import { Book, SourceAdapter, SourceInfo, StaticSourceDocument } from '../domain/books';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isId = (value: unknown): value is string => isText(value) && /^[a-z0-9][a-z0-9_-]*$/i.test(value);

export function parseStaticSource(input: string): StaticSourceDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(input.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('JSON 格式无效，请检查标点和引号。');
  }
  if (!isRecord(raw) || raw.version !== 1 || !isText(raw.id) || !isText(raw.name)) {
    throw new Error('书源需要 version: 1、id 和 name。');
  }
  if (!isId(raw.id)) {
    throw new Error('书源 id 只能包含字母、数字、下划线和短横线。');
  }
  if (raw.description !== undefined && typeof raw.description !== 'string') {
    throw new Error('书源说明 description 必须是文字。');
  }
  if (!Array.isArray(raw.books) || !Array.isArray(raw.chapters)) {
    throw new Error('书源需要 books 和 chapters 数组。');
  }
  const bookIds = new Set<string>();
  for (const book of raw.books) {
    if (!isRecord(book) || !isId(book.id) || !isText(book.title) || !isText(book.author) ||
      !isText(book.summary) || !isText(book.category) || typeof book.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(book.accent) ||
      (book.status !== '连载中' && book.status !== '已完结')) {
      throw new Error('books 中有条目缺少必填字段。');
    }
    if (bookIds.has(book.id)) throw new Error(`重复的书籍 id：${book.id}`);
    bookIds.add(book.id);
  }
  const chapterIds = new Set<string>();
  for (const chapter of raw.chapters) {
    if (!isRecord(chapter) || !isId(chapter.id) || !isText(chapter.bookId) ||
      !isText(chapter.title) || !Array.isArray(chapter.paragraphs) ||
      !chapter.paragraphs.every(isText) || !bookIds.has(chapter.bookId)) {
      throw new Error('chapters 中有无效章节，或引用了不存在的书籍。');
    }
    const key = `${chapter.bookId}/${chapter.id}`;
    if (chapterIds.has(key)) throw new Error(`重复的章节 id：${key}`);
    chapterIds.add(key);
  }
  return {
    version: 1, id: raw.id, name: raw.name.trim(), description: raw.description ?? '',
    books: raw.books, chapters: raw.chapters,
  } as StaticSourceDocument;
}

export function createStaticAdapter(document: StaticSourceDocument, kind: SourceInfo['kind']): SourceAdapter {
  const books: Book[] = document.books.map((book) => ({ ...book, sourceId: document.id }));
  const chapters = document.chapters;
  return {
    info: { id: document.id, name: document.name, kind, description: document.description ?? '' },
    async search(query) {
      const term = query.trim().toLocaleLowerCase();
      return books.filter((book) => !term || `${book.title} ${book.author} ${book.category}`.toLocaleLowerCase().includes(term));
    },
    async getBook(bookId) { return books.find((book) => book.id === bookId) ?? null; },
    async getChapters(bookId) {
      return chapters.filter((chapter) => chapter.bookId === bookId).map(({ id, bookId: chapterBookId, title }) => ({ id, bookId: chapterBookId, title }));
    },
    async getChapter(bookId, chapterId) {
      return chapters.find((chapter) => chapter.bookId === bookId && chapter.id === chapterId) ?? null;
    },
  };
}
