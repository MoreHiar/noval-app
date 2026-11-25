const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/sources/washai.json'), 'utf8'));
const { urlBookId } = require('../src/sources/browser-reader.ts');
const { createLegadoSearchAdapter } = require('../src/sources/legado-search.ts');
const { jgwxsDefaultBundle, washaiDefaultBundle } = require('../src/sources/defaults.ts');
const { parseWashaiBook, parseWashaiCatalogPage, parseWashaiChapter } = require('../src/sources/washai-reader.ts');
const { createWashaiTransport, washaiPageRequest } = require('../src/sources/washai-transport.ts');
const { currentBrowserTask, subscribeBrowser } = require('../src/sources/browser-session.ts');

const number = '1262260513468565585';
const bookId = urlBookId(`https://book.washai.net/book/${number}.html`);
const chapterId = n => String(2039351400477514380n + BigInt(n));
const searchHtml = `<div id="bookList"><article class="classBookCard"><a class="book-cover-badge">科幻灵异</a><h3 class="classBookTitle"><a href="/book/${number}.html">罪名不朽</a></h3><p class="classBookAuthor">作者：<a>我爱吃猫片哇</a></p><p class="classBookDesc">简介</p><span class="classBookCover"><img src="/localPic/test.jpg"></span></article></div>`;
const detailHtml = `<h1 id="bookName">罪名不朽</h1><a id="bookAuthor">我爱吃猫片哇</a><em id="bookStatus">连载中</em><a id="bookCatBadge">科幻灵异</a><p id="bookDesc">简介</p><img id="bookCoverImg" src="/localPic/test.jpg"><a id="allIndexLink" href="/book/indexList-${number}.html">目录</a><script type="application/ld+json">{"@type":"Book","description":"完整简介"}</script>`;
const pageHtml = (page, count = 101) => {
  const start = (page - 1) * 100 + 1;
  const rows = Array.from({ length: Math.min(100, count - start + 1) }, (_, offset) => {
    const n = start + offset;
    return `<li data-index-id="${chapterId(n)}"><a href="/book/${number}/${chapterId(n)}.html">第${n}章<i>${n === 101 ? '' : ' [免费]'}</i></a></li>`;
  }).join('');
  return `<h1 id="bookName">罪名不朽</h1><ul id="bookIndexList"><li class="catalogVolumeHeading"><h4>第一卷</h4></li>${rows}</ul><div id="indexPager" data-book-id="${number}" data-page="${page}" data-page-size="100" data-total="${count}" data-order="asc" data-ssr-complete="1"></div>`;
};
const chapterHtml = (id = chapterId(1), book = number, needBuy = false) => `<div id="showReading"><section class="readChapterPrimaryBlock" data-index-id="${id}"><div class="readChapterAppendBody"><p>第一段。</p><p>第二段<br>换行。</p></div></section></div><script id="readPageBootstrap" type="application/json">${JSON.stringify({ book: { id: book }, bookIndex: { id, bookId: book, indexName: '第1章' }, needBuy })}</script>`;

test('washai fixture parsing searches, loads complete paginated catalog and reads public chapters (mocked HTTP)', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const value = String(url);
    requests.push(value);
    const body = value.includes('bookclass') ? searchHtml : value.includes('/indexList/') ? pageHtml(2) : value.includes('/indexList-') ? pageHtml(1) : value.includes(`/${chapterId(1)}.html`) ? chapterHtml() : detailHtml;
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
  assert.deepEqual([jgwxsDefaultBundle, washaiDefaultBundle].flatMap(bundle => bundle.sources.map(entry => entry.document.bookSourceName)), ['甲骨文小说', '书海阁']);
  const adapter = createLegadoSearchAdapter(source);
  const results = await adapter.search('罪名不朽');
  assert.equal(results[0].id, bookId);
  assert.equal(results[0].author, '我爱吃猫片哇');
  assert.equal((await adapter.getBook(bookId)).summary, '完整简介');
  const chapters = await adapter.getChapters(bookId);
  assert.equal(chapters.length, 101);
  assert.deepEqual(chapters.slice(0, 2).map(chapter => chapter.title), ['第1章', '第2章']);
  assert.equal(chapters[0].volume, '第一卷');
  assert.equal(chapters[100].locked, true);
  assert.deepEqual((await adapter.getChapter(bookId, chapterId(1))).paragraphs, ['第一段。', '第二段', '换行。']);
  await assert.rejects(adapter.getChapter(bookId, chapterId(101)), /解锁/);
  assert.equal(requests.length, 5);
});

test('washai Cloudflare 403 opens verification and reuses browser transport for search, catalog and chapters', async t => {
  let directRequests = 0;
  const browserRequests = [];
  t.mock.method(globalThis, 'fetch', async () => {
    directRequests++;
    return new Response('<title>Just a moment...</title>', { status: 403, headers: { 'cf-mitigated': 'challenge' } });
  });
  const unsubscribe = subscribeBrowser(() => {
    const task = currentBrowserTask();
    if (!task || browserRequests.some(request => request.id === task.id)) return;
    browserRequests.push({ id: task.id, ...task.request });
    queueMicrotask(() => {
      const url = task.request.url;
      const html = url.includes('bookclass') ? searchHtml : url.includes('/indexList/') ? pageHtml(2) : url.includes('/indexList-') ? pageHtml(1) : url.includes(`/${chapterId(1)}.html`) ? chapterHtml() : detailHtml;
      task.finish({ url, html });
    });
  });
  try {
    const adapter = createLegadoSearchAdapter(source);
    assert.equal((await adapter.search('罪名不朽'))[0].title, '罪名不朽');
    assert.equal((await adapter.getBook(bookId)).title, '罪名不朽');
    assert.equal((await adapter.getChapters(bookId)).length, 101);
    assert.deepEqual((await adapter.getChapter(bookId, chapterId(1))).paragraphs, ['第一段。', '第二段', '换行。']);
    assert.equal(directRequests, 1);
    assert.equal(browserRequests.length, 5);
    assert.ok(browserRequests.every(request => request.source === 'washai'));
    assert.equal(browserRequests[0].selector, '#bookList');
    assert.equal(browserRequests.at(-1).selector, '#readPageBootstrap');
  } finally { unsubscribe(); }
});

test('washai verification supports cancellation and rejects a stale page from another search', async () => {
  const transport = createWashaiTransport(async () => new Response('<title>Just a moment...</title>', { status: 200 }));
  const request = { url: 'https://book.washai.net/book/bookclass.html?k=test', init: { method: 'GET', headers: {}, credentials: 'omit' } };
  const controller = new AbortController();
  let pending = transport(request, controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(currentBrowserTask().request.source, 'washai');
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(currentBrowserTask(), null);
  pending = transport(request, new AbortController().signal);
  currentBrowserTask().finish({ url: request.url.replace('k=test', 'k=wrong'), html: searchHtml });
  await assert.rejects(pending, /不匹配/);
  assert.equal(washaiPageRequest('https://book.washai.net.evil.test/book/123.html'), undefined);
});

test('washai plain HTTP errors remain errors and never produce invented successful search data', async () => {
  const transport = createWashaiTransport(async () => new Response('Forbidden', { status: 403 }));
  const response = await transport({ url: 'https://book.washai.net/book/bookclass.html?k=test', init: { method: 'GET', headers: {}, credentials: 'omit' } }, new AbortController().signal);
  assert.equal(response.status, 403);
  assert.equal(response.ok, false);
  assert.equal(currentBrowserTask(), null);
});

test('washai public pages with Cloudflare background scripts do not unnecessarily open verification', async () => {
  const html = searchHtml + '<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>';
  const transport = createWashaiTransport(async () => new Response(html, { status: 200 }));
  const response = await transport({ url: 'https://book.washai.net/book/bookclass.html?k=test', init: { method: 'GET', headers: {}, credentials: 'omit' } }, new AbortController().signal);
  assert.equal(await response.text(), html);
  assert.equal(currentBrowserTask(), null);
});

test('washai reader rejects mismatched, incomplete and locked pages', () => {
  assert.throws(() => parseWashaiBook(detailHtml.replace(`indexList-${number}`, 'indexList-999'), 'source', bookId), /不匹配/);
  assert.throws(() => parseWashaiCatalogPage(pageHtml(2).replace(/<li data-index-id=.*?<\/li>/, ''), bookId, 2), /不完整/);
  assert.throws(() => parseWashaiCatalogPage(pageHtml(2), bookId, 1), /不匹配/);
  assert.throws(() => parseWashaiChapter(chapterHtml(chapterId(1), '999'), bookId, chapterId(1)), /不匹配/);
  assert.throws(() => parseWashaiChapter(chapterHtml(chapterId(1), number, true), bookId, chapterId(1)), /解锁/);
  assert.throws(() => parseWashaiChapter(chapterHtml().replace('第一段。', '').replace('第二段<br>换行。', ''), bookId, chapterId(1)), /正文/);
});
