const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { bookUrlFromId, parseFanqieState, parseFanqieBook, parseFanqieChapter, paragraphsFromHtml, createFanqieReader } = require('../src/sources/reading.ts');
const { paginateText, paginateMeasuredLines, pageAtOffset, readingText, swipeDirection, turnDestination } = require('../src/reader/pagination.ts');
const id = 'web-' + Array.from('https://fanqienovel.com/page/123456').map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
const stateHtml = value => `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify(value)}; maliciousCode();</script></html>`;
const item = (number, title) => ({ itemId: number, title, needPay: 0 });
const bookPage = { bookId: '123456', bookName: '测试书籍', author: '作者', abstract: '简介', chapterTotal: 3, chapterListWithVolume: [[item('11', '第一章'), item('12', '第二章')], [item('13', '第三章'), item('11', '重复')]] };
const chapterPage = { common: {}, reader: { chapterData: { bookId: '123456', itemId: '11', title: '第一章', content: '<p>第一段。</p><p>第二段 &amp; 文字<br>换行</p>' } } };
const { parseQidianCatalog,parseQidianChapter,createQidianReader }=require('../src/sources/qidian-reader.ts');
const {urlBookId,createBrowserReader}=require('../src/sources/browser-reader.ts');
const { createLegadoSearchAdapter } = require('../src/sources/legado-search.ts');
const { parseJgwxsBook, parseJgwxsChapter } = require('../src/sources/jgwxs-reader.ts');
const jgwxsSource = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../docs/sources/jgwxs.json'), 'utf8'));
const jgwxsId = urlBookId('https://www.jgwxs.com/novel/177171');
const jgwxsHtml = data => `<script>window.__INITIAL_STATE__=${JSON.stringify({ app: { data } })};</script>`;
const qidianId=urlBookId('https://m.qidian.com/book/123.html');
const qidianHtml=data=>`<script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify({pageContext:{pageProps:{pageData:data}}})}</script>`;

test('Jgwxs source searches and reads its catalog and chapter', async t => {
  const bookPage = jgwxsHtml({ novel: { id: 177171, name: '夜无疆', authName: '辰东', synopsis: '简介', cover: 'cover.jpg', end: false }, index: [{ page: 2, title: '第二章' }, { page: 1, title: '第一章' }] });
  const chapterPage = jgwxsHtml({ chapter: { novelId: 177171, page: 1, title: '第一章', content: '第一段\n第二段' } });
  const requested = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requested.push(String(url));
    return new Response(String(url).includes('/novel/search') ? JSON.stringify({ data: { res: { records: new URL(String(url)).searchParams.get('keyword') === '无结果' ? [] : [{ id: 177171, name: '夜无疆', authName: '辰东', synopsis: '简介', cover: 'cover.jpg' }] } } }) : String(url).includes('/chapter/') ? chapterPage : bookPage);
  });
  const adapter = createLegadoSearchAdapter(jgwxsSource);
  const results = await adapter.search('夜无疆');
  assert.equal(results[0].id, jgwxsId);
  assert.equal(results[0].coverUrl, 'https://static.ttkan.co/cover/cover.jpg');
  assert.equal((await adapter.getBook(jgwxsId)).title, '夜无疆');
  assert.deepEqual((await adapter.getChapters(jgwxsId)).map(x => x.id), ['1', '2']);
  assert.deepEqual((await adapter.getChapter(jgwxsId, '1')).paragraphs, ['第一段', '第二段']);
  assert.equal(requested.length, 3);
  assert.deepEqual(await adapter.search('无结果'), []);
  assert.throws(() => parseJgwxsBook(jgwxsHtml({ novel: { id: 99, name: '错书' }, index: [{ page: 1, title: '第一章' }] }), 'source', jgwxsId), /不匹配/);
  assert.throws(() => parseJgwxsChapter(jgwxsHtml({ chapter: { novelId: 99, page: 1, content: '正文' } }), jgwxsId, '1'), /不匹配/);
});

test('Qidian volumes preserve chapter order, lock state and book identity instead of returning zero',()=>{
  const html=qidianHtml({bookId:123,vs:[{vN:'第一卷',cCnt:2,vS:0,cs:[{id:10,cN:'第一章',sS:1},{id:11,cN:'第二章',sS:1}]},{vN:'VIP',cCnt:1,vS:1,cs:[{id:12,cN:'第三章',sS:0}]}]});
  const chapters=parseQidianCatalog(html,qidianId);
  assert.deepEqual(chapters.map(x=>[x.id,x.volume,x.locked]),[['10','第一卷',false],['11','第一卷',false],['12','VIP',true]]);
  assert.throws(()=>parseQidianCatalog(html,urlBookId('https://m.qidian.com/book/456.html')),/不匹配/);
  assert.throws(()=>parseQidianCatalog(qidianHtml({bookId:123,vs:[{cCnt:2,cs:[]}]}),qidianId),/未完整/);
});
test('Qidian reader rejects paywalled, empty or mismatched content and keeps paragraphs',()=>{
  const data={bookInfo:{bookId:123},chapterInfo:{chapterId:10,chapterName:'第一章',vipStatus:0,content:'<p>正文<p>第二段'}};
  assert.deepEqual(parseQidianChapter(qidianHtml(data),qidianId,'10').paragraphs,['正文','第二段']);
  assert.throws(()=>parseQidianChapter(qidianHtml(data),qidianId,'11'),/不匹配/);
  assert.throws(()=>parseQidianChapter(qidianHtml({...data,chapterInfo:{...data.chapterInfo,vipStatus:1,isBuy:0}}),qidianId,'10'),/解锁/);
  assert.throws(()=>parseQidianChapter(qidianHtml({...data,chapterInfo:{...data.chapterInfo,content:''}}),qidianId,'10'),/正文/);
});
test('Qidian adapter loads metadata and shared catalog plus a selected chapter',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async url=>{calls++;return new Response(url.includes('/catalog/')?qidianHtml({bookId:123,vs:[{cCnt:1,vS:0,cs:[{id:10,cN:'第一章',sS:1}]}]}):url.includes('/chapter/')?qidianHtml({bookInfo:{bookId:123},chapterInfo:{chapterId:10,chapterName:'第一章',content:'<p>第一段'}}):qidianHtml({bookInfo:{bookId:123,bookName:'书',authorName:'作者',desc:'简介',actionStatus:'已完结'}}));});
  const reader=createQidianReader('source');
  assert.equal((await reader.getBook(qidianId)).title,'书');
  const [one,two]=await Promise.all([reader.getChapters(qidianId),reader.getChapters(qidianId)]);assert.deepEqual(one,two);
  assert.equal((await reader.getChapter(qidianId,'10')).title,'第一章');
  await reader.getChapter(qidianId,'10');assert.equal(calls,3);
});
test('browser reader follows a detail directory and merges only same-chapter pages',async t=>{
  const browser=require('../src/sources/browser-session.ts');
  const requests=[];
  t.mock.method(browser,'loadBrowserPage',async request=>{
    requests.push(request.url);
    const url=request.url;
    return {url,html:url.endsWith('/book/1/')?'<meta property="og:novel:book_name" content="书"><ul id="ul1"><li><a href="/book/1/10.html">第一章</a></li><li><a href="/book/1/11.html">第二章</a></li></ul>':url.endsWith('_2.html')?'<div class="read-section"><p>第二页</p></div><a href="11.html">下一页</a>':'<div class="read-section"><p>第一页<script>bad()</script></p></div><a href="10_2.html">下一页</a>'};
  });
  const reader=createBrowserReader({bookSourceName:'笔趣庭',bookSourceUrl:'https://m.biquting.org/'}),bookId=urlBookId('https://m.biquting.org/book/1/');
  const chapters=await reader.getChapters(bookId);assert.equal(chapters.length,2);
  const chapter=await reader.getChapter(bookId,chapters[0].id);assert.deepEqual(chapter.paragraphs,['第一页','第二页']);
  assert.equal(requests.length,3);assert.equal(requests.some(x=>x.endsWith('11.html')),false);
  await assert.rejects(reader.getChapter(bookId,urlBookId('https://m.biquting.org/book/2/1.html')),/不在当前书籍/);
});

test('public JSON payload parsing never executes page scripts and handles braces in string content', () => {
  const payload = { value: '这是 {文字}，引号 " 与反斜杠 \\。' };
  assert.deepEqual(parseFanqieState(stateHtml(payload)), payload);
  assert.equal(bookUrlFromId(id).href, 'https://fanqienovel.com/page/123456');
  assert.throws(() => parseFanqieState('<html>verification required</html>'), /验证|下架/);
  assert.throws(() => bookUrlFromId('bad-link'), /链接无效/);
});

test('catalogs preserve volume order, deduplicate chapters and expose locked chapters', () => {
  const { chapters } = parseFanqieBook(stateHtml({ page: bookPage }), 'source', id);
  assert.deepEqual(chapters.map(chapter => chapter.id), ['11', '12', '13']);
  assert.equal(parseFanqieBook(stateHtml({ page: { ...bookPage, chapterListWithVolume: [[{ ...item('11', '付费章'), needPay: 1 }]] } }), 'source', id).chapters[0].locked, true);
  assert.throws(() => parseFanqieBook(stateHtml({ page: { ...bookPage, bookId: '9' } }), 'source', id), /不匹配/);
  assert.throws(() => parseFanqieBook(stateHtml({ page: { ...bookPage, chapterListWithVolume: [] } }), 'source', id), /目录格式/);
});

test('content is split into paragraphs, scripts are discarded, mismatched and locked chapters fail clearly', () => {
  assert.deepEqual(parseFanqieChapter(stateHtml(chapterPage), id, '11').paragraphs, ['第一段。', '第二段 & 文字', '换行']);
  assert.deepEqual(paragraphsFromHtml('<script>bad()</script>甲<br>乙<style>bad</style>'), ['甲', '乙']);
  assert.throws(() => parseFanqieChapter(stateHtml(chapterPage), id, '12'), /不匹配/);
  assert.throws(() => parseFanqieChapter(stateHtml({ ...chapterPage, reader: { chapterData: { ...chapterPage.reader.chapterData, isChapterLock: true } } }), id, '11'), /解锁/);
  assert.throws(() => parseFanqieChapter(stateHtml({ ...chapterPage, reader: { chapterData: { ...chapterPage.reader.chapterData, content: '' } } }), id, '11'), /未返回正文/);
});

test('font-dependent public content requires a trusted companion font', () => {
  const payload = { common: { css: '@font-face{src:url(https://lf6-awef.bytetos.com/obj/awesome-font/c/abc.otf)}' }, reader: { chapterData: { ...chapterPage.reader.chapterData, content: '<p>正文\ue123</p>' } } };
  assert.equal(parseFanqieChapter(stateHtml(payload), id, '11').fontUrl, 'https://lf6-awef.bytetos.com/obj/awesome-font/c/abc.otf');
  payload.common.css = '@font-face{src:url(https://unknown.example/font.otf)}';
  assert.throws(() => parseFanqieChapter(stateHtml(payload), id, '11'), /字体/);
});

test('network reader shares catalog requests, limits chapter memory, and propagates cancellation', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => { calls++; return new Response(stateHtml(url.includes('/page/') ? { page: bookPage } : { ...chapterPage, reader: { chapterData: { ...chapterPage.reader.chapterData, itemId: url.split('/').pop() } } })); });
  const reader = createFanqieReader('source');
  const [book, chapters] = await Promise.all([reader.getBook(id), reader.getChapters(id)]);
  assert.equal(calls, 1); assert.equal(book.title, '测试书籍'); assert.equal(chapters.length, 3);
  for (const chapterId of ['11', '12', '13', '14']) await reader.getChapter(id, chapterId);
  await reader.getChapter(id, '14'); assert.equal(calls, 5);
  await reader.getChapter(id, '11'); assert.equal(calls, 6);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(reader.getChapter(id, '12', controller.signal), error => error.name === 'AbortError');
  assert.equal(calls, 6);
});

test('pagination conserves every character at different sizes and resumes by character position', () => {
  const text = readingText(['一二三四五六七八九十'.repeat(30), 'emoji 😀 test ABC 123', '下一段']);
  for (const [columns, rows] of [[10, 4], [20, 8], [1, 1], [50, 20]]) {
    const pages = paginateText(text, columns, rows);
    assert.equal(pages.map(page => page.text).join(''), text);
    pages.forEach((page, index) => { assert.equal(pageAtOffset(pages, page.start), index); if (index) assert.equal(page.start, pages[index - 1].end); });
    assert.equal(pageAtOffset(pages, Number.MAX_SAFE_INTEGER), pages.length - 1);
  }
  assert.deepEqual(paginateText('', 10, 4), [{ text: '', start: 0, end: 0 }]);
  const measured = paginateMeasuredLines('一二\n三四', [{ text: '一二' }, { text: '三四' }], 1);
  assert.equal(measured.map(page => page.text).join(''), '一二\n三四');
  assert.equal(paginateMeasuredLines('一二', [{ text: '错误' }], 1), null);
});

test('left/right swipes and chapter boundaries agree, including previous chapter last page', () => {
  assert.equal(swipeDirection(-80, 2, -0.2, 390), 1);
  assert.equal(swipeDirection(80, 2, 0.2, 390), -1);
  assert.equal(swipeDirection(10, 0, 0.1, 390), null);
  assert.equal(swipeDirection(100, 120, 1, 390), null);
  assert.deepEqual(turnDestination(2, 3, 0, 2, 1), { kind: 'chapter', index: 1, position: 'start' });
  assert.deepEqual(turnDestination(0, 3, 1, 2, -1), { kind: 'chapter', index: 0, position: 'end' });
  assert.deepEqual(turnDestination(0, 3, 0, 2, -1), { kind: 'boundary' });
  assert.deepEqual(turnDestination(2, 3, 1, 2, 1), { kind: 'boundary' });
  assert.deepEqual(turnDestination(0, 3, 0, 2, 1), { kind: 'page', index: 1 });
});

test('reader preferences recover invalid stored values and typography changes retain the reading anchor', () => {
  const { parseReaderPreferences, DEFAULT_READER_PREFERENCES } = require('../src/reader/preferences.ts');
  assert.deepEqual(parseReaderPreferences(null), DEFAULT_READER_PREFERENCES);
  assert.deepEqual(parseReaderPreferences({ fontSize: NaN, lineSpacing: 'wide', animation: 'unknown' }), DEFAULT_READER_PREFERENCES);
  assert.deepEqual(parseReaderPreferences({ fontSize: 100, lineSpacing: 2.3, animation: 'none' }), { fontSize: 30, lineSpacing: 2.3, animation: 'none' });
  assert.equal(parseReaderPreferences({ fontSize: -2 }).fontSize, 14);
  const text = readingText(['这是一段用于验证调整字号和行间距后阅读位置的正文。'.repeat(100)]);
  const original = paginateText(text, 19, 20);
  const anchor = original[3].start;
  for (const [columns, lines] of [[12, 12], [24, 25]]) {
    const adjusted = paginateText(text, columns, lines);
    const resumed = adjusted[pageAtOffset(adjusted, anchor)];
    assert.ok(resumed.start <= anchor && resumed.end > anchor);
    assert.equal(adjusted.map(page => page.text).join(''), text);
  }
});
