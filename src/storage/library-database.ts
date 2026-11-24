import type { SQLiteDatabase } from 'expo-sqlite';
import type { Book } from '../domain/books';
import { bookKey, getShelfBooks, LibraryData, parseLibraryData } from '../sources/management';

type Database = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'>;
type ShelfRow = { source_id: string; book_id: string; position: number; metadata: string | null };

export const LEGACY_LIBRARY_KEY = 'noval.library.v1';

export async function createLibraryDatabase(db: Database) {
  const schema = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (schema && schema.user_version > 1) throw new Error('本地数据库由更新版本创建，请更新应用。');
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
    PRAGMA user_version = 1;
  `);

  async function write(current: LibraryData) {
    const definitions = JSON.stringify(current.definitions);
    await db.runAsync(`INSERT INTO library_settings (id, version, definitions) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET version = excluded.version, definitions = excluded.definitions
      WHERE version != excluded.version OR definitions != excluded.definitions`, current.version, definitions);
    const rows = await db.getAllAsync<ShelfRow>('SELECT source_id, book_id, position, metadata FROM shelf_books');
    const existing = new Map(rows.map(row => [`${row.source_id}/${row.book_id}`, row]));
    const keys = new Set(current.shelf);
    for (const row of rows) {
      if (!keys.has(`${row.source_id}/${row.book_id}`)) await db.runAsync('DELETE FROM shelf_books WHERE source_id = ? AND book_id = ?', row.source_id, row.book_id);
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

  // The repository owns this connection and serializes reads/writes on every platform.
  let queue: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }

  return {
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
          return parseLibraryData(JSON.stringify({ version: settings.version, definitions: JSON.parse(settings.definitions),
            shelf: rows.map(row => `${row.source_id}/${row.book_id}`), shelfBooks: rows.flatMap(row => row.metadata === null ? [] : [JSON.parse(row.metadata)]) }));
        }
        const legacy = await readLegacy();
        const restored = parseLibraryData(JSON.stringify(legacy === null ? initial : JSON.parse(legacy)));
        // Source definitions and shelf migrate together. Failed migration leaves legacy data intact.
        await db.withTransactionAsync(() => write(restored));
        return restored;
      });
    },
    save(current: LibraryData): Promise<void> {
      return serialize(() => db.withTransactionAsync(() => write(current)));
    },
  };
}
