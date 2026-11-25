const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const source = require('../docs/sources/bqg349.json');
const { createLegadoSearchAdapter } = require('../src/sources/legado-search.ts');
const { urlBookId } = require('../src/sources/browser-reader.ts');
const { bqg349Request, bqg349BookNumber, parseBqg349Book, parseBqg349Catalog, parseBqg349Chapter, createBqg349Reader } = require('../src/sources/bqg349-reader.ts');
const { bqg349DefaultBundle } = require('../src/sources/defaults.ts');
const bookId = urlBookId('https://www.bqg349.xyz/#/book/2530/');
const info = { id: '2530', dirid: '2530', title: '万相之王', author: '天蚕土豆', sortname: '玄幻', full: '连载', intro: '天地间有万相。', lastchapterid: '3' };
const catalog = { list: ['第一章', '第二章', '第三章'] };
const chapter = { id: 2530, dirid: 2530, chapterid: 1, chaptername: '第一章', txt: '第一段。\n　　第二段。\n\n第三段。', cs: 3 };

function parameters(url) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from('a3dc22cf70418a51'), Buffer.from('394c2c3202da6270'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(new URL(url).searchParams.get('token'), 'base64')), decipher.final()]).toString());
}

test('bqg349 request format matches public website vectors without evaluating website scripts', () => {
  assert.equal(new URL(bqg349Request('book', '2530')).searchParams.get('token'), 'IZzVX5XJA1oySI5jozY8vQ==');
  assert.equal(new URL(bqg349Request('chapter', '2530', '1')).searchParams.get('token'), 'b+vXnT3wjuXQsxBmZh033ZjqwezLEinKfOakcVaiDx0=');
  assert.deepEqual(parameters(bqg349Request('chapter', '2530', '1')), { id: 2530, chapterid: 1 });
  assert.throws(() => bqg349Request('chapter', '2530', '../1'), /无效/);
  assert.equal(bqg349DefaultBundle.sources[0].document.bookSourceName, '笔趣阁349');
});

test('bqg349 fixture search and reading share metadata and preserve complete chapter order (mocked HTTP)', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const address = new URL(url);
    assert.equal(address.origin, 'https://www.bqg349.xyz');
    assert.equal(options.credentials, 'omit');
    requests.push(address.pathname);
    let body;
    if (address.pathname === '/api/search') {
      assert.equal(address.searchParams.get('q'), '万相之王');
      body = { data: [{ id: 2530, title: info.title, author: info.author, intro: info.intro }] };
    } else {
      const params = parameters(url);
      assert.equal(params.id, 2530);
      body = address.pathname === '/api/book' ? info : address.pathname === '/api/booklist' ? catalog : { ...chapter, chapterid: params.chapterid };
    }
    return new Response(JSON.stringify(body));
  });
  const adapter = createLegadoSearchAdapter(source);
  assert.equal(adapter.searchUnavailableReason, undefined);
  const results = await adapter.search('万相之王');
  assert.equal(results[0].id, bookId);
  assert.equal(results[0].coverUrl, 'https://www.bqg349.xyz/bookimg/2/2530.jpg');
  const [book, chapters] = await Promise.all([adapter.getBook(bookId), adapter.getChapters(bookId)]);
  assert.equal(book.status, '连载中');
  assert.deepEqual(chapters.map(item => item.id), ['1', '2', '3']);
  assert.deepEqual((await adapter.getChapter(bookId, '1')).paragraphs, ['第一段。', '第二段。', '第三段。']);
  await adapter.getChapter(bookId, '1');
  await assert.rejects(adapter.getChapter(bookId, '4'), /不在当前书籍/);
  assert.deepEqual(requests, ['/api/search', '/api/book', '/api/booklist', '/api/chapter']);
});

test('bqg349 rejects foreign book URLs and mismatched, missing or incomplete API data', () => {
  for (const url of ['http://www.bqg349.xyz/#/book/2530/', 'https://www.bqg349.xyz.evil.test/#/book/2530/', 'https://user:secret@www.bqg349.xyz/#/book/2530/', 'https://www.bqg349.xyz/?other=1#/book/2530/', 'https://www.bqg349.xyz/#/book/2530/1.html']) assert.throws(() => bqg349BookNumber(urlBookId(url)), /无效/);
  assert.throws(() => parseBqg349Book(JSON.stringify({ ...info, id: 999 }), 'source', bookId), /不匹配/);
  assert.throws(() => parseBqg349Book('<html>verification</html>', 'source', bookId), /JSON/);
  assert.throws(() => parseBqg349Catalog(JSON.stringify({ list: ['第一章'] }), bookId, 3), /不完整/);
  assert.throws(() => parseBqg349Catalog(JSON.stringify({ list: ['第一章', '', '第三章'] }), bookId, 3), /不完整/);
  assert.throws(() => parseBqg349Chapter(JSON.stringify({ ...chapter, id: 999 }), bookId, '1', '2530'), /不匹配/);
  assert.throws(() => parseBqg349Chapter(JSON.stringify({ ...chapter, dirid: 999 }), bookId, '1', '2530'), /不匹配/);
  assert.throws(() => parseBqg349Chapter(JSON.stringify(chapter), bookId, '2', '2530'), /不匹配/);
  assert.throws(() => parseBqg349Chapter(JSON.stringify({ ...chapter, txt: '' }), bookId, '1', '2530'), /正文/);
  assert.throws(() => parseBqg349Chapter(JSON.stringify({ ...chapter, txt: '字'.repeat(200001) }), bookId, '1', '2530'), /200000/);
});

test('bqg349 preserves a book alias while using its canonical directory', () => {
  const alias = urlBookId('https://www.bqg349.xyz/#/book/19637/');
  assert.equal(parseBqg349Book(JSON.stringify({ ...info, id: '19637' }), 'source', alias).directoryId, '2530');
  assert.equal(parseBqg349Chapter(JSON.stringify({ ...chapter, id: 19637 }), alias, '1', '2530').bookId, alias);
});

test('bqg349 cancellation reaches the network and cancelled requests never populate the cache', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  });
  const reader = createBqg349Reader('source');
  const controller = new AbortController();
  const pending = reader.getChapters(bookId, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(reader.getChapters(bookId, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
});
