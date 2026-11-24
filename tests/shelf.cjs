const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};

const { fanqieSource, fanqieSourceId } = require('../src/sources/fanqie.ts');
const { javascriptDocument } = require('../src/sources/javascript.ts');
const { definitionId } = require('../src/sources/legado.ts');
const { createLegadoSearchAdapter } = require('../src/sources/legado-search.ts');
const { bookKey, deleteDefinition, deleteRuleSources, getShelfBooks, mergeSources, parseLibraryData, saveDefinition, setAllRuleSourcesEnabled, setShelfBook } = require('../src/sources/management.ts');
const { createLibraryDatabase, SOURCE_RESET_ID } = require('../src/storage/library-database.ts');


const initial = () => ({ version: 1, definitions: [fanqieSource(), { kind: 'javascript', enabled: true, document: javascriptDocument }], shelf: ['js-example/clock'] });
const book = (overrides = {}) => ({ id: 'web-book', sourceId: fanqieSourceId, title: '测试小说', author: '作者', summary: '简介', category: '小说', status: '状态未知', accent: '#526C63', coverUrl: 'https://example.com/cover.jpg', ...overrides });

// Exercise the production SQL against an actual SQLite engine, including rollback and file reopen.
async function database(t, filename = ':memory:') {
  const raw = new DatabaseSync(filename);
  let closed = false;
  const close = () => { if (!closed) { raw.close(); closed = true; } };
  t.after(close);
  let failSql;
  const db = {
    execAsync: async sql => raw.exec(sql),
    runAsync: async (sql, ...params) => {
      if (failSql?.test(sql)) throw new Error('injected disk write failure');
      return raw.prepare(sql).run(...params);
    },
    getFirstAsync: async (sql, ...params) => raw.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql, ...params) => raw.prepare(sql).all(...params),
    withTransactionAsync: async action => {
      raw.exec('BEGIN');
      try { await action(); raw.exec('COMMIT'); }
      catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
  return { raw, db, close, store: await createLibraryDatabase(db), fail: expression => { failSql = expression; } };
}
const noLegacy = async () => null;
const forbiddenLegacy = async () => { throw new Error('migration must not run again'); };

test('collected online metadata survives reopening the database and a fresh search adapter', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noval-shelf-'));
  const filename = path.join(dir, 'library.db');
  const first = await database(t, filename);
  const restored = await first.store.load(initial(), noLegacy);
  const collected = setShelfBook(restored, book(), true);
  await first.store.save(setShelfBook(collected, book(), true));
  assert.equal(first.raw.prepare('SELECT count(*) AS count FROM shelf_books').get().count, 2);
  first.close();
  const second = await database(t, filename);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cold = await second.store.load(initial(), forbiddenLegacy);
  assert.deepEqual(getShelfBooks(cold).map(item => item.title), ['时钟与海', '测试小说']);
  const adapter = createLegadoSearchAdapter(fanqieSource().document, id => second.store.getBook(fanqieSourceId, id));
  assert.deepEqual(await adapter.getBook(book().id), book());
  assert.equal(await adapter.getBook('not-collected'), null);
});

test('remove deletes the stored metadata, survives restart, and repeated remove is harmless', async t => {
  const { store, raw } = await database(t);
  let data = await store.load(initial(), noLegacy);
  data = setShelfBook(data, book(), true);
  await store.save(data);
  data = setShelfBook(data, book(), false);
  await store.save(setShelfBook(data, book(), false));
  assert.equal(raw.prepare('SELECT count(*) AS count FROM shelf_books WHERE source_id = ?').get(fanqieSourceId).count, 0);
  const cold = await store.load(initial(), forbiddenLegacy);
  assert.deepEqual(cold.shelf, ['js-example/clock']);
  assert.equal(cold.shelfBooks.some(item => item.id === book().id), false);
});

test('migration preserves disabled sources, order and old collections and never reseeds an empty shelf', async t => {
  const { store } = await database(t);
  const legacy = { ...initial(), definitions: [fanqieSource(false), initial().definitions[1]] };
  let reads = 0;
  let data = await store.load(initial(), async () => { reads++; return JSON.stringify(legacy); });
  assert.equal(data.definitions[0].enabled, false);
  assert.deepEqual(data.shelf, legacy.shelf);
  data = setShelfBook(data, getShelfBooks(data)[0], false);
  await store.save(data);
  const cold = await store.load(initial(), async () => { reads++; return JSON.stringify(legacy); });
  assert.equal(reads, 1);
  assert.deepEqual(cold.shelf, []);
});

test('migration rolls back every table on disk failure and can be retried without losing legacy data', async t => {
  const { store, raw, fail } = await database(t);
  const legacy = JSON.stringify(initial());
  fail(/INSERT INTO shelf_books/);
  await assert.rejects(store.load(initial(), async () => legacy), /disk write failure/);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM library_settings').get().count, 0);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM shelf_books').get().count, 0);
  fail(undefined);
  assert.deepEqual((await store.load(initial(), async () => legacy)).shelf, initial().shelf);
});

test('failed removal rolls back source edits and shelf changes together; the write queue recovers', async t => {
  const { store, fail } = await database(t);
  const before = setShelfBook(await store.load(initial(), noLegacy), book(), true);
  await store.save(before);
  const after = setAllRuleSourcesEnabled(setShelfBook(before, book(), false), false);
  fail(/DELETE FROM shelf_books/);
  await assert.rejects(store.save(after), /disk write failure/);
  const unchanged = await store.load(initial(), forbiddenLegacy);
  assert.deepEqual(unchanged.shelf, before.shelf);
  assert.equal(unchanged.definitions[0].enabled, true);
  fail(undefined);
  await store.save(after);
  assert.equal((await store.load(initial(), forbiddenLegacy)).definitions[0].enabled, false);
});

test('source rename, disable, import replacement and deletion keep shelf metadata consistent', async t => {
  const { store, raw } = await database(t);
  const source = { kind: 'legado', enabled: true, document: { bookSourceName: '自定义', bookSourceUrl: 'https://one.example', enabled: true } };
  let data = { ...initial(), definitions: [...initial().definitions, source] };
  const customBook = book({ sourceId: definitionId(source) });
  data = setShelfBook(data, customBook, true);
  const renamed = { ...source.document, bookSourceUrl: 'https://two.example' };
  data = saveDefinition(data, renamed, false, definitionId(source));
  const sourceId = definitionId(data.definitions.at(-1));
  assert.deepEqual(data.shelfBooks.map(item => item.sourceId), [sourceId]);
  data = mergeSources(data, [{ kind: 'legado', enabled: false, document: renamed }], true).data;
  await store.save(data);
  assert.equal((await store.load(initial(), forbiddenLegacy)).shelfBooks.find(item => item.id === customBook.id).sourceId, sourceId);
  assert.equal(deleteRuleSources(data, [sourceId]).shelfBooks.length, 0);
  await store.save(deleteDefinition(data, sourceId));
  assert.equal(raw.prepare('SELECT count(*) AS count FROM shelf_books WHERE source_id = ?').get(sourceId).count, 0);
});

test('only collected metadata is stored, metadata is bounded, and identical IDs in different sources stay separate', async t => {
  const { store, raw } = await database(t);
  let data = await store.load(initial(), noLegacy);
  const oversized = book({ title: '书'.repeat(2000), summary: '文'.repeat(20000), coverUrl: 'data:image/png;base64,abc', responseHtml: 'x'.repeat(100000) });
  data = setShelfBook(data, oversized, true);
  const second = { kind: 'legado', enabled: true, document: { bookSourceName: '其他', bookSourceUrl: 'https://other.example' } };
  data = { ...data, definitions: [...data.definitions, second] };
  data = setShelfBook(data, book({ sourceId: definitionId(second), title: '另一来源' }), true);
  await store.save(data);
  const metadata = JSON.parse(raw.prepare('SELECT metadata FROM shelf_books WHERE source_id = ?').get(fanqieSourceId).metadata);
  assert.equal(metadata.title.length, 512);
  assert.equal(metadata.summary.length, 4000);
  assert.equal(metadata.coverUrl, undefined);
  assert.equal(metadata.responseHtml, undefined);
  assert.equal(data.shelf.length, 3);
  assert.equal(setShelfBook(data, oversized, false).shelf.includes(bookKey(book({ sourceId: definitionId(second) }))), true);
});

test('invalid legacy data does not initialize an empty replacement library', async t => {
  const { store, raw } = await database(t);
  await assert.rejects(store.load(initial(), async () => '{broken'));
  assert.equal(raw.prepare('SELECT count(*) AS count FROM library_settings').get().count, 0);
  assert.throws(() => setShelfBook(initial(), book({ sourceId: 'deleted-source' }), true), /书源已被删除/);
  assert.throws(() => parseLibraryData(JSON.stringify({ ...initial(), shelfBooks: [{}] })), /书架书籍信息/);
});

test('search memory retains at most 100 books and evicted collections still resolve from SQLite', async t => {
  const { store } = await database(t);
  let data = await store.load(initial(), noLegacy);
  let responseBooks = Array.from({ length: 100 }, (_, index) => ({ title: `小说${index}`, abstract: '文'.repeat(8000), book_id: String(10000 + index), genre: '0' }));
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { ret_data: responseBooks } }), { headers: { 'Content-Type': 'application/json' } }));
  const adapter = createLegadoSearchAdapter(fanqieSource().document, id => store.getBook(fanqieSourceId, id));
  const results = await adapter.search('第一批');
  assert.equal(results[0].summary.length, 4000);
  data = setShelfBook(data, results[0], true);
  await store.save(data);
  responseBooks = Array.from({ length: 100 }, (_, index) => ({ title: `新小说${index}`, book_id: String(20000 + index), genre: '0' }));
  await adapter.search('第二批');
  // An evicted online book can now be fetched from its public detail page.
  t.mock.method(globalThis, 'fetch', async () => new Response(`<script>window.__INITIAL_STATE__=${JSON.stringify({ page: { bookId: '10001', bookName: '重新获取的小说', chapterTotal: 0 } })};</script>`));
  assert.equal((await adapter.getBook(results[1].id)).title, '重新获取的小说');
  assert.deepEqual(await adapter.getBook(results[0].id), results[0]);
  assert.equal(data.shelf.length, 2);
});

test('reading position survives a cold database open, rejects stale writes, and is deleted with a collection', async t => {
  const { store, db, raw } = await database(t);
  let data = setShelfBook(await store.load(initial(), noLegacy), book(), true);
  await store.save(data);
  const position = { sourceId: fanqieSourceId, bookId: book().id, chapterId: '2', chapterTitle: '第二章', offset: 500, updatedAt: 200 };
  await store.saveProgress(position);
  await store.saveProgress({ ...position, chapterId: '1', offset: 0, updatedAt: 100 });
  const cold = await createLibraryDatabase(db);
  assert.deepEqual({ ...await cold.getProgress(position.sourceId, position.bookId) }, position);
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 4);
  await assert.rejects(store.saveProgress({ ...position, offset: -1 }), /进度格式无效/);
  data = setShelfBook(data, book(), false);
  await store.save(data);
  assert.equal(await store.getProgress(position.sourceId, position.bookId), null);
});

test('progress keeps only 200 recent books and removing a source cleans its history', async t => {
  const { store, raw } = await database(t);
  const extra = { kind: 'legado', enabled: true, document: { bookSourceName: '临时', bookSourceUrl: 'https://progress.example' } };
  const data = { ...initial(), definitions: [...initial().definitions, extra] };
  const collected = setShelfBook(data, book({ sourceId: definitionId(extra), id: 'collected' }), true);
  await store.load(collected, noLegacy);
  await store.saveProgress({ sourceId: definitionId(extra), bookId: 'collected', chapterId: '9', chapterTitle: '第九章', offset: 0, updatedAt: 0 });
  for (let index = 0; index < 205; index++) await store.saveProgress({ sourceId: definitionId(extra), bookId: String(index), chapterId: '1', chapterTitle: '第一章', offset: 0, updatedAt: index });
  assert.equal(raw.prepare('SELECT count(*) AS count FROM reading_progress').get().count, 201);
  assert.equal((await store.getProgress(definitionId(extra), 'collected')).chapterId, '9');
  assert.equal(await store.getProgress(definitionId(extra), '0'), null);
  assert.equal((await store.getProgress(definitionId(extra), '204')).chapterId, '1');
  await store.save(deleteDefinition(data, definitionId(extra)));
  assert.equal(raw.prepare('SELECT count(*) AS count FROM reading_progress').get().count, 0);
  await assert.rejects(store.saveProgress({ sourceId: definitionId(extra), bookId: '204', chapterId: '2', chapterTitle: '第二章', offset: 0, updatedAt: 300 }), /书源已被删除/);
});

test('schema version 1 upgrades without altering existing shelf rows', async t => {
  const { store, db, raw } = await database(t);
  await store.load(initial(), noLegacy);
  raw.exec('DROP TABLE reading_progress; PRAGMA user_version = 1;');
  const upgraded = await createLibraryDatabase(db);
  assert.deepEqual((await upgraded.load(initial(), forbiddenLegacy)).shelf, initial().shelf);
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 4);
  raw.exec('PRAGMA user_version = 999;');
  await assert.rejects(createLibraryDatabase(db), /更新版本/);
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 999);
});


test('requested source reset snapshots data and progress once, then preserves new imports', async t => {
  const { store, db, raw } = await database(t);
  const old = setShelfBook(initial(), book(), true);
  await store.save(old);
  const progress = { sourceId: fanqieSourceId, bookId: book().id, chapterId: '2', chapterTitle: '第二章', offset: 150, updatedAt: 100 };
  await store.saveProgress(progress);
  raw.exec('PRAGMA user_version = 3;');
  const upgraded = await createLibraryDatabase(db, { resetSources: true });
  const cleared = await upgraded.load(initial(), forbiddenLegacy);
  assert.deepEqual(cleared, { version: 1, definitions: [], shelf: [], shelfBooks: [] });
  assert.equal(raw.prepare('SELECT count(*) AS count FROM shelf_books').get().count, 0);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM reading_progress').get().count, 0);
  const backup = JSON.parse(raw.prepare('SELECT payload FROM library_backups WHERE id = ?').get(SOURCE_RESET_ID).payload);
  assert.deepEqual(backup.library.definitions, old.definitions);
  assert.deepEqual(backup.library.shelf, old.shelf);
  assert.deepEqual(getShelfBooks(backup.library), getShelfBooks(old));
  assert.equal(backup.progress[0].offset, 150);
  const imported = mergeSources(cleared, [fanqieSource(false)], false).data;
  await upgraded.save(imported);
  const cold = await (await createLibraryDatabase(db, { resetSources: true })).load(initial(), forbiddenLegacy);
  assert.deepEqual(cold, imported);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM library_backups').get().count, 1);
});

test('source reset failure rolls back backup, sources, shelf and progress and can retry', async t => {
  const { store, db, raw, fail } = await database(t);
  const old = setShelfBook(initial(), book(), true);
  await store.save(old);
  await store.saveProgress({ sourceId: fanqieSourceId, bookId: book().id, chapterId: '1', chapterTitle: '首章', offset: 10, updatedAt: 100 });
  const resetting = await createLibraryDatabase(db, { resetSources: true });
  fail(/DELETE FROM shelf_books/);
  await assert.rejects(resetting.load(initial(), forbiddenLegacy), /disk write failure/);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM library_backups').get().count, 0);
  assert.equal(JSON.parse(raw.prepare('SELECT definitions FROM library_settings').get().definitions).length, 2);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM shelf_books').get().count, 2);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM reading_progress').get().count, 1);
  fail(undefined);
  assert.deepEqual((await resetting.load(initial(), forbiddenLegacy)).definitions, []);
});

test('fresh and legacy installs remain empty after reset without importing old defaults again', async t => {
  for (const legacy of [null, JSON.stringify(initial())]) {
    const { db, raw } = await database(t);
    const store = await createLibraryDatabase(db, { resetSources: true });
    const empty = { version: 1, definitions: [], shelf: [] };
    assert.deepEqual((await store.load(empty, async () => legacy)).definitions, []);
    assert.deepEqual((await store.load(empty, forbiddenLegacy)).definitions, []);
    assert.equal(raw.prepare('SELECT count(*) AS count FROM library_backups').get().count, 1);
  }
});

test('four newly selected defaults install once, preserve same-address edits and do not return after deletion',async t=>{
  const {selectedDefaultBundle}=require('../src/sources/defaults.ts');
  assert.deepEqual(selectedDefaultBundle.sources.map(x=>x.document.bookSourceName),['哔哩轻小说','起点男频','笔趣庭','笔趣阁94']);
  const {db,store,raw}=await database(t);
  const custom={...selectedDefaultBundle.sources[1],enabled:false,document:{...selectedDefaultBundle.sources[1].document,enabled:false,bookSourceName:'我的起点'}};
  await store.save({...initial(),definitions:[...initial().definitions,custom]});
  const updated=await createLibraryDatabase(db,{defaultBundle:selectedDefaultBundle});
  let current=await updated.load(initial(),forbiddenLegacy);
  assert.equal(current.definitions.length,6);
  assert.deepEqual(current.definitions.find(x=>definitionId(x)===definitionId(custom)),custom);
  assert.deepEqual(current.shelf,initial().shelf);
  current=deleteDefinition(current,definitionId(selectedDefaultBundle.sources[0]));await updated.save(current);
  assert.deepEqual(await(await createLibraryDatabase(db,{defaultBundle:selectedDefaultBundle})).load(initial(),forbiddenLegacy),current);
  assert.equal(raw.prepare('SELECT count(*) AS count FROM default_source_bundles').get().count,1);
});
