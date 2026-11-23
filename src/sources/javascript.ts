import { Book, Chapter, SourceAdapter, StaticSourceDocument } from '../domain/books';

// Trusted, bundled JavaScript source example. User-supplied scripts need an isolated host (phase 2).
const books: Book[] = [{ id: 'clock', sourceId: 'js-example', title: '时钟与海', author: '示例作者', summary: '由 JavaScript 适配器提供的演示小说。', category: '短篇', status: '已完结', accent: '#8477A0' }];
const chapters: Chapter[] = [{ id: '1', bookId: 'clock', title: '第一章 · 潮汐', paragraphs: ['海边的钟每到整点，总比城里的钟慢一分钟。', '阿澄想知道，那一分钟究竟去了哪里。'] }];

// Local demo metadata for persistence; excluded from rule source import/export.
export const javascriptDocument: StaticSourceDocument = {
  version: 1,
  id: 'js-example',
  name: 'JavaScript 示例源',
  description: '随应用打包的可信脚本示例。',
  books: books.map(({ sourceId: _sourceId, ...book }) => book),
  chapters,
};

export const javascriptExampleSource: SourceAdapter = {
  info: { id: 'js-example', name: 'JavaScript 示例源', kind: 'javascript', description: '随应用打包的可信脚本示例。' },
  async search(query) { return books.filter((book) => `${book.title} ${book.author}`.includes(query.trim())); },
  async getBook(bookId) { return books.find((book) => book.id === bookId) ?? null; },
  async getChapters(bookId) {
    return chapters.filter((chapter) => chapter.bookId === bookId).map(({ id, bookId: chapterBookId, title }) => ({ id, bookId: chapterBookId, title }));
  },
  async getChapter(bookId, chapterId) { return chapters.find((chapter) => chapter.bookId === bookId && chapter.id === chapterId) ?? null; },
};
