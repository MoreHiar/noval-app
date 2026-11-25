import type { SQLiteDatabase } from 'expo-sqlite';
import type { Book, ReadingProgress, RuleManagedSource } from '../domain/books';
import { bookKey, getShelfBooks, LibraryData, mergeSources, parseLibraryData } from '../sources/management';
import { definitionId } from '../sources/legado';

type Database = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'>;
type ShelfRow = { source_id: string; book_id: string; position: number; metadata: string | null };

export const LEGACY_LIBRARY_KEY = 'noval.library.v1';

export async function createLibraryDatabase(db: Database, options: { defaultBundle?: { id: string; sources: RuleManagedSource[] } } = {}) {
  const schema = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (schema && schema.user_version > 5) throw new Error('本地数据库由更新版本创建，请更新应用。');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA journal_size_limit = 1048576;
    PRAGMA wal_autocheckpoint = 128;
    CREATE TABLE IF NOT EXISTS library_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      definitions TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shelf_books (
      source_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      metadata TEXT,
      PRIMARY KEY (source_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS reading_progress (
      source_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      chapter_title TEXT NOT NULL,
      offset INTEGER NOT NULL CHECK (offset >= 0),
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (source_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS default_source_bundles (
      id TEXT PRIMARY KEY NOT NULL
    );
  `);
  if ((schema?.user_version ?? 0) < 5) await db.execAsync('PRAGMA user_version = 5;');

  async function write(current: LibraryData) {
    const definitions = JSON.stringify(current.definitions);
    await db.runAsync(`INSERT INTO library_settings (id, version, definitions) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET version = excluded.version, definitions = excluded.definitions
      WHERE version != excluded.version OR definitions != excluded.definitions`, current.version, definitions);
    const rows = await db.getAllAsync<ShelfRow>('SELECT source_id, book_id, position, metadata FROM shelf_books');
    const existing = new Map(rows.map(row => [`${row.source_id}/${row.book_id}`, row]));
    const keys = new Set(current.shelf);
    for (const row of rows) {
      if (!keys.has(`${row.source_id}/${row.book_id}`)) {
        await db.runAsync('DELETE FROM shelf_books WHERE source_id = ? AND book_id = ?', row.source_id, row.book_id);
        await db.runAsync('DELETE FROM reading_progress WHERE source_id = ? AND book_id = ?', row.source_id, row.book_id);
      }
    }
    const sourceIds = new Set(current.definitions.map(definitionId));
    for (const row of await db.getAllAsync<{ source_id: string }>('SELECT DISTINCT source_id FROM reading_progress')) {
      if (!sourceIds.has(row.source_id)) await db.runAsync('DELETE FROM reading_progress WHERE source_id = ?', row.source_id);
    }
    const books = new Map(getShelfBooks(current).map(book => [bookKey(book), book]));
    for (const [position, key] of current.shelf.entries()) {
      const split = key.indexOf('/');
      if (split < 1) throw new Error('书架书籍标识无效。');
      const metadata = books.has(key) ? JSON.stringify(books.get(key)) : null;
      const old = existing.get(key);
      if (old?.position === position && old.metadata === metadata) continue;
      await db.runAsync(`INSERT INTO shelf_books (source_id, book_id, position, metadata) VALUES (?, ?, ?, ?)
        ON CONFLICT(source_id, book_id) DO UPDATE SET position = excluded.position, metadata = excluded.metadata`,
      key.slice(0, split), key.slice(split + 1), position, metadata);
    }
  }

  async function prepareLibrary(current: LibraryData, initialize = false): Promise<LibraryData> {
    if (initialize) await write(current);
    const bundle = options.defaultBundle;
    if (!bundle || await db.getFirstAsync('SELECT id FROM default_source_bundles WHERE id = ?', bundle.id)) return current;
    const next = mergeSources(current, bundle.sources, false).data;
    await write(next);
    await db.runAsync('INSERT INTO default_source_bundles (id) VALUES (?)', bundle.id);
    return next;
  }

  // The repository owns this connection and serializes reads/writes on every platform.
  let queue: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }

  return {
    getProgress(sourceId: string, bookId: string): Promise<ReadingProgress | null> {
      return serialize(() => db.getFirstAsync<ReadingProgress>(`SELECT source_id AS sourceId, book_id AS bookId, chapter_id AS chapterId,
        chapter_title AS chapterTitle, offset, updated_at AS updatedAt FROM reading_progress WHERE source_id = ? AND book_id = ?`, sourceId, bookId));
    },
    saveProgress(progress: ReadingProgress): Promise<void> {
      if (!progress.sourceId || !progress.bookId || !progress.chapterId || !Number.isSafeInteger(progress.offset) || progress.offset < 0 ||
        !Number.isSafeInteger(progress.updatedAt) || progress.updatedAt < 0 || typeof progress.chapterTitle !== 'string') return Promise.reject(new Error('阅读进度格式无效。'));
      return serialize(() => db.withTransactionAsync(async () => {
        const settings = await db.getFirstAsync<{ definitions: string }>('SELECT definitions FROM library_settings WHERE id = 1');
        if (!settings || !(JSON.parse(settings.definitions) as LibraryData['definitions']).some(entry => definitionId(entry) === progress.sourceId)) throw new Error('书源已被删除，无法保存进度。');
        await db.runAsync(`INSERT INTO reading_progress (source_id, book_id, chapter_id, chapter_title, offset, updated_at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_id, book_id) DO UPDATE SET chapter_id = excluded.chapter_id, chapter_title = excluded.chapter_title,
          offset = excluded.offset, updated_at = excluded.updated_at WHERE excluded.updated_at >= updated_at`,
        progress.sourceId, progress.bookId, progress.chapterId, progress.chapterTitle.slice(0, 512), progress.offset, progress.updatedAt);
        // Keep every collection's position and at most 200 recently read uncollected books.
        await db.runAsync(`DELETE FROM reading_progress WHERE NOT EXISTS (
          SELECT 1 FROM shelf_books WHERE shelf_books.source_id = reading_progress.source_id AND shelf_books.book_id = reading_progress.book_id
        ) AND rowid NOT IN (
          SELECT progress.rowid FROM reading_progress AS progress WHERE NOT EXISTS (
            SELECT 1 FROM shelf_books WHERE shelf_books.source_id = progress.source_id AND shelf_books.book_id = progress.book_id
          ) ORDER BY updated_at DESC, progress.rowid DESC LIMIT 200
        )`);
      }));
    },
    getBook(sourceId: string, bookId: string): Promise<Book | null> {
      return serialize(async () => {
        const row = await db.getFirstAsync<{ metadata: string | null }>('SELECT metadata FROM shelf_books WHERE source_id = ? AND book_id = ?', sourceId, bookId);
        return row?.metadata ? JSON.parse(row.metadata) as Book : null;
      });
    },
    load(initial: LibraryData, readLegacy: () => Promise<string | null>): Promise<LibraryData> {
      return serialize(async () => {
        const settings = await db.getFirstAsync<{ version: number; definitions: string }>('SELECT version, definitions FROM library_settings WHERE id = 1');
        if (settings) {
          const rows = await db.getAllAsync<ShelfRow>('SELECT source_id, book_id, position, metadata FROM shelf_books ORDER BY position');
          const restored = parseLibraryData(JSON.stringify({ version: settings.version, definitions: JSON.parse(settings.definitions),
            shelf: rows.map(row => `${row.source_id}/${row.book_id}`), shelfBooks: rows.flatMap(row => row.metadata === null ? [] : [JSON.parse(row.metadata)]) }));
          let updated = restored;
          await db.withTransactionAsync(async () => { updated = await prepareLibrary(restored); });
          return updated;
        }
        const legacy = await readLegacy();
        const restored = parseLibraryData(JSON.stringify(legacy === null ? initial : JSON.parse(legacy)));
        // Source definitions and shelf migrate together. Failed migration leaves legacy data intact.
        let updated = restored;
        await db.withTransactionAsync(async () => {
          updated = await prepareLibrary(restored, true);
        });
        return updated;
      });
    },
    save(current: LibraryData): Promise<void> {
      return serialize(() => db.withTransactionAsync(() => write(current)));
    },
  };
}
