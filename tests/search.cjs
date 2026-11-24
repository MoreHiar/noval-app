const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

// Compile only this test process's source imports using the installed TypeScript compiler.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};

const { buildSearchRequest, createLegadoSearchAdapter } = require('../src/sources/legado-search.ts');
const { fanqieDocument } = require('../src/sources/fanqie.ts');
const { searchSources, summarizeSearch } = require('../src/sources/search.ts');
const fiveSources = require('./fixtures/five-source-search.json');

const document = {
  bookSourceName: '测试来源', bookSourceUrl: 'https://fixture.example',
  searchUrl: '/search?q={{key}}&page={{page}}',
  ruleSearch: { bookList: 'class.item', name: 'tag.h3.0@tag.a.0@text', author: 'tag.p.1@tag.a.0@text##作者：', bookUrl: 'tag.a.0@href', intro: '.intro@text' },
};
const html = '<script>const unused = "<div>";</script><div class="item"><h3><a href="../book/1?a=1&amp;b=2">书生 &amp; 山海</a></h3><p>玄幻</p><p><a>作者：某人</a></p><p class="intro">故事 &lt;开始&gt;</p></div>';

test('user-provided Qidian XPath definition searches the current SSR layout without altering stored rules', async t => {
  const source = fiveSources[2];
  const before = JSON.stringify(source);
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(new URL(url).pathname, '/so/不死不灭.html'.replace('不死不灭', encodeURIComponent('不死不灭')));
    return new Response('<a data-bid="20117" href="//m.qidian.com/chapter/20117/0/"><div><img data-src="//bookcover.yuewen.com/qdbimg/349573/20117/180" alt="不死不灭在线阅读"></div><div><h2>不死不灭</h2><p class="_searchBookDesc_hash">故事简介</p><div><p class="_searchBookAuthor_hash">辰东</p><div class="_tags_hash"><p>武侠</p><p>完结</p><p>79万字</p></div></div></div></a>');
  });
  const adapter = createLegadoSearchAdapter(source);
  assert.equal(adapter.searchUnavailableReason, undefined);
  const [book] = await adapter.search('不死不灭');
  assert.equal(book.title, '不死不灭');
  assert.equal(book.author, '辰东');
  assert.equal(book.summary, '故事简介');
  assert.equal(book.category, '武侠 完结');
  assert.equal(book.coverUrl, 'https://bookcover.yuewen.com/qdbimg/349573/20117/180');
  assert.equal(book.id.slice(4).match(/.{4}/g).map(hex => String.fromCharCode(parseInt(hex,16))).join(''), 'https://m.qidian.com/book/20117.html');
  assert.equal(JSON.stringify(source), before);
  const modified = structuredClone(source);
  modified.ruleSearch.bookList = '//*[@class="something-else"]';
  assert.ok(createLegadoSearchAdapter(modified).searchUnavailableReason);
});

test('known Yuyouku script discovers a same-origin form, encodes keywords, and respects inclusive list slicing', async t => {
  const before = JSON.stringify(fiveSources[1]);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    if (calls === 1) return new Response('<form role="form" action="/search?scope=books"></form>');
    assert.equal(new URL(url).searchParams.get('keyword'), '剑 & 来');
    assert.equal(new URL(url).searchParams.get('scope'), 'books');
    const row = title => `<li class="list-group-item"><div><i>仙侠</i></div><div><a href="/book/1">${title}</a></div><div><a>新章节</a></div><div>作者</div></li>`;
    return new Response(row('表头')+row('剑来')+row('最后一本')+row('页码'));
  });
  const adapter = createLegadoSearchAdapter(fiveSources[1]);
  assert.equal(adapter.searchUnavailableReason, undefined);
  // Identical book links deduplicate; the final footer must not replace the book title.
  assert.deepEqual((await adapter.search('剑 & 来')).map(book => book.title), ['最后一本']);
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(fiveSources[1]), before);
});

test('form discovery rejects external actions, missing forms and cancellation before a second request', async t => {
  for (const action of ['https://other.example/search', 'https://user:secret@www.yuyouku.com/search', 'javascript:alert(1)', '']) {
    const stub = t.mock.method(globalThis, 'fetch', async () => new Response(`<form role="form" action="${action}"></form>`));
    await assert.rejects(createLegadoSearchAdapter(fiveSources[1]).search('书'), /表单|其他网站/);
    assert.equal(stub.mock.callCount(), 1);
    stub.mock.restore();
  }
  const controller = new AbortController();
  const stub = t.mock.method(globalThis, 'fetch', async () => { controller.abort(); return new Response('<form role="form" action="/search"></form>'); });
  await assert.rejects(createLegadoSearchAdapter(fiveSources[1]).search('书', controller.signal), { name: 'AbortError' });
  assert.equal(stub.mock.callCount(), 1);
});

test('browser sources use the shared browser session without executing supplied scripts', async t => {
  const stub = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not request'); });
  const browser = require('../src/sources/browser-session.ts');
  const requests=[];
  t.mock.method(browser,'loadBrowserPage',async request=>{
    requests.push(request);
    return {url:request.url,html:request.source==='linovelib'?'<ol class="book-ol"><li><h3 class="book-title"><a href="/novel/1.html">剑来</a></h3></li></ol>':request.source==='biquting'?'<ul class="clearfix"><li><a class="tit" href="/book/1/">剑来</a></li></ul>':'<dl class="item"><dt><a href="/book/1/">剑来</a></dt></dl>'};
  });
  for (const index of [0,3,4]) {
    const adapter = createLegadoSearchAdapter(fiveSources[index]);
    assert.equal(adapter.searchUnavailableReason,undefined);
    assert.equal((await adapter.search('剑来'))[0].title,'剑来');
  }
  assert.deepEqual(requests.map(item=>item.source),['linovelib','biquting','bg94']);
  const modified = { ...fiveSources[1], searchUrl: fiveSources[1].searchUrl + ';globalThis.injected=true' };
  assert.match(createLegadoSearchAdapter(modified).searchUnavailableReason, /脚本/);
  assert.equal(stub.mock.callCount(), 0);
  assert.equal(globalThis.injected, undefined);
});

test('real Legado traversal format extracts title, author, entities and relative links; deduplicates stable IDs', async t => {
  let calls = 0;
  t.mock.method(global, 'fetch', async url => {
    calls++;
    assert.equal(new URL(url).searchParams.get('q'), '书生');
    return new Response(html + html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
  const adapter = createLegadoSearchAdapter(document);
  assert.equal(adapter.searchUnavailableReason, undefined);
  assert.deepEqual(await adapter.search(''), []);
  assert.equal(calls, 0);
  const [book, ...rest] = await adapter.search('书生');
  assert.equal(rest.length, 0);
  assert.equal(book.title, '书生 & 山海');
  assert.equal(book.author, '某人');
  assert.equal(book.summary, '故事 <开始>');
  assert.equal(book.status, '状态未知');
  assert.equal(decodeURIComponent(book.id), book.id);
  assert.equal((await adapter.search('书生'))[0].id, book.id);
  assert.deepEqual(await adapter.getBook(book.id), book);
});

test('CSS child/attribute/pseudo selectors parse malformed-but-valid HTML and reject empty or unsafe book links', async t => {
  const source = { ...document, ruleSearch: { bookList: '.results > li:nth-child(n+2)', name: 'a[data-book]@title', bookUrl: 'a[data-book]@href' } };
  t.mock.method(global, 'fetch', async () => new Response('<ul class="results"><li>标题<li><a data-book title="第一本" href="/one">1</a><li><a data-book title="无链接">2</a><li><a data-book title="脚本" href="javascript:alert(1)">3</a></ul>'));
  const books = await createLegadoSearchAdapter(source).search('书');
  assert.deepEqual(books.map(book => book.title), ['第一本']);
});

test('parses JSON5 POST options without executing code and encodes keyword exactly once', () => {
  const request = buildSearchRequest({ ...document, header: '{"Cookie":"secret","User-Agent":"fixture"}', searchUrl: "/search/,{'method':'post','body':'keyword={{key}}&page={{page}}'}" }, '山 & 海');
  assert.equal(request.init.method, 'POST');
  assert.equal(new URLSearchParams(request.init.body).get('keyword'), '山 & 海');
  assert.equal(request.init.headers.Cookie, undefined);
  assert.equal(request.init.headers['User-Agent'], 'fixture');
  assert.equal(buildSearchRequest({ ...document, header: '' }, 'a').init.method, 'GET');
});

test('unsupported required rules report reasons before making requests; optional metadata cannot break results', async t => {
  t.mock.method(global, 'fetch', async () => new Response(html));
  for (const source of [
    { ...document, searchUrl: '@js:java.ajax(baseUrl)' },
    { ...document, ruleSearch: { ...document.ruleSearch, bookList: '$..data[?(@.enabled)]' } },
    { ...document, ruleSearch: { ...document.ruleSearch, bookUrl: '@onclick@js:result' } },
    { ...document, searchUrl: "/s,{'charset':'gbk','method':'POST','body':'q={{key}}'}" },
  ]) {
    const adapter = createLegadoSearchAdapter(source);
    assert.ok(adapter.searchUnavailableReason);
    await assert.rejects(adapter.search('书生'));
  }
  assert.equal(fetch.mock.callCount(), 0);
  const adapter = createLegadoSearchAdapter({ ...document, ruleSearch: { ...document.ruleSearch, kind: 'tag.p.0@tag.span[0:1]@text' } });
  assert.equal((await adapter.search('书生')).length, 1);
});

test('JSON API results support JSONPath lists, numeric IDs, metadata and book URL templates', async t => {
  const source = {
    ...document, bookSourceUrl: 'http://appi.kuwo.cn',
    ruleSearch: { bookList: '$.data', name: '$.title', author: '$.author_name', intro: '$.intro', coverUrl: '$.cover_url', bookUrl: '/novels/api/book/{{$.book_id}}' },
  };
  t.mock.method(global, 'fetch', async url => {
    assert.equal(new URL(url).protocol, 'https:');
    return new Response(JSON.stringify({ data: [{ book_id: 123, title: '测试小说', author_name: '作者甲', intro: '简介', cover_url: 'https://covers.example/book.jpg' }] }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  });
  const adapter = createLegadoSearchAdapter(source);
  assert.equal(adapter.searchUnavailableReason, undefined);
  const books = await adapter.search('测试');
  assert.equal(books.length, 1);
  assert.equal(books[0].title, '测试小说');
  assert.equal(books[0].author, '作者甲');
  assert.equal(books[0].summary, '简介');
  assert.equal(books[0].coverUrl, 'https://covers.example/book.jpg');
  assert.equal(books[0].id.slice(4).match(/.{4}/g).map(hex => String.fromCharCode(parseInt(hex, 16))).join(''), 'https://appi.kuwo.cn/novels/api/book/123');
});

test('built-in Fanqie rule searches novel results and preserves the cover and detail URL', async t => {
  const request = buildSearchRequest(fanqieDocument, '斗罗');
  assert.equal(new URL(request.url).searchParams.get('offset'), '0');
  assert.equal(new URL(request.url).searchParams.get('q'), '斗罗');
  t.mock.method(global, 'fetch', async url => {
    assert.equal(url, request.url);
    return Response.json({ code: 0, data: { ret_data: [
      { genre: '0', title: '斗罗小说', author: '作者', abstract: '简介', thumb_url: 'https://example.com/cover.jpg', audio_thumb_uri: 'https://example.com/fallback.jpg', book_id: '7366848355118353447' },
      { genre: '1', title: '非小说', book_id: '2' },
    ] } });
  });
  const adapter = createLegadoSearchAdapter(fanqieDocument);
  assert.equal(adapter.searchUnavailableReason, undefined);
  const books = await adapter.search('斗罗');
  assert.equal(books.length, 1);
  assert.equal(books[0].title, '斗罗小说');
  assert.equal(books[0].coverUrl, 'https://example.com/cover.jpg');
  assert.equal(books[0].coverFallbackUrl, 'https://example.com/fallback.jpg');
  assert.equal(books[0].id.slice(4).match(/.{4}/g).map(hex => String.fromCharCode(parseInt(hex, 16))).join(''), 'https://fanqienovel.com/page/7366848355118353447');
  fetch.mock.mockImplementation(async () => Response.json({ code: 0, data: { ret_data: [{ genre: '1', title: '非小说', book_id: '2' }] } }));
  assert.deepEqual(await adapter.search('斗罗'), []);
});

test('online completion counts exclude both offline adapters and distinguish unsupported rules from failures', () => {
  const result = (id, kind, error, unavailable) => ({ source: { info: { id, kind }, searchUnavailableReason: unavailable }, books: [], error });
  assert.deepEqual(summarizeSearch([
    result('demo1', 'builtin'), result('demo2', 'javascript'), result('network', 'legado'),
    result('http-error', 'legado', 'HTTP 503'), result('script', 'legado', '暂不支持脚本', '暂不支持脚本'),
  ]), { completed: 1, matched: 0, empty: 1, failed: 1, unsupported: 1, settled: 3, demoBooks: 0 });
});

test('HTML cover links resolve against the response and invalid optional artwork preserves the book', async t => {
  const source = { ...document, ruleSearch: { ...document.ruleSearch, coverUrl: 'img@src' } };
  t.mock.method(global, 'fetch', async () => new Response(html.replace('<h3>', '<img src="/covers/1.jpg"><h3>')));
  assert.equal((await createLegadoSearchAdapter(source).search('书'))[0].coverUrl, 'https://fixture.example/covers/1.jpg');
  fetch.mock.mockImplementation(async () => new Response(html.replace('<h3>', '<img src="javascript:bad"><h3>')));
  const books = await createLegadoSearchAdapter(source).search('书');
  assert.equal(books.length, 1);
  assert.equal(books[0].coverUrl, undefined);
});

test('empty JSON lists are valid, missing lists and HTTP-200 API errors are reported as failures', async t => {
  const source = { ...document, ruleSearch: { bookList: '$.data', name: '$.title', bookUrl: '$.url' } };
  t.mock.method(global, 'fetch', async () => Response.json({ code: 200, data: [] }));
  assert.deepEqual(await createLegadoSearchAdapter(source).search('皮嫁骨'), []);
  fetch.mock.mockImplementation(async () => Response.json({ code: 200, wrong: [] }));
  await assert.rejects(createLegadoSearchAdapter(source).search('书'), /缺少搜索列表/);
  fetch.mock.mockImplementation(async () => Response.json({ code: 503, data: [] }));
  await assert.rejects(createLegadoSearchAdapter(source).search('书'), /503/);
});

test('legacy Sudugu uses the verified new host and parses both list and single-result detail responses', async t => {
  const source = { bookSourceName: '速读谷', bookSourceUrl: 'https://www.sudugu.co', searchUrl: "/modules/article/search.php,{'method':'post','body':'searchkey={{key}}&searchtype=all'}", ruleSearch: { bookList: 'class.bookbox', name: 'tag.a.0@text', author: 'class.author.0@text##作者：', bookUrl: 'tag.a.0@href' } };
  const original = JSON.stringify(source);
  t.mock.method(global, 'fetch', async (url, init) => {
    assert.equal(new URL(url).hostname, 'www.sudugu.cc');
    assert.equal(init.method, 'POST');
    assert.equal(new URLSearchParams(init.body).get('searchkey'), '我有');
    const response = new Response('<div class="container"><div class="content"><div class="item clear"><div class="itemtxt"><h3><a href="/1800/">我有一个修仙模拟器</a></h3><ul><li>作者：作者甲</li></ul><p>简介文字</p></div></div></div></div>');
    Object.defineProperty(response, 'url', { value: url });
    return response;
  });
  const [listBook] = await createLegadoSearchAdapter(source).search('我有');
  assert.equal(listBook.author, '作者甲');
  assert.equal(listBook.coverUrl, 'https://www.sudugu.cc/files/article/image/1/1800/1800s.jpg');
  fetch.mock.mockImplementation(async () => {
    const response = new Response('<div class="container"><div class="item"><img src="/files/article/image/6/6266/6266s.jpg"><div class="itemtxt"><h1><a href="/6266/#dir">皮嫁骨，雨中戏，诡异入侵我杀疯了</a></h1><p><a href="/modules/article/authorarticle.php?author=绯月">作者：绯月</a></p><ul><li>最新章节</li></ul></div></div><ul><li><a href="/unrelated/">相关书籍</a></li></ul></div>');
    Object.defineProperty(response, 'url', { value: 'https://www.sudugu.cc/6266/' });
    return response;
  });
  const books = await createLegadoSearchAdapter(source).search('皮嫁骨');
  assert.equal(books.length, 1);
  assert.equal(books[0].title, '皮嫁骨，雨中戏，诡异入侵我杀疯了');
  assert.equal(books[0].author, '绯月');
  assert.equal(books[0].coverUrl, 'https://www.sudugu.cc/files/article/image/6/6266/6266s.jpg');
  assert.equal(JSON.stringify(source), original);
});

test('HTTP failures and site challenges are errors, while a genuine empty search is successful', async t => {
  t.mock.method(global, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(createLegadoSearchAdapter(document).search('书'), /503/);
  fetch.mock.mockImplementation(async () => new Response('{"error":"challenge_required","challenge_url":"/verify"}'));
  await assert.rejects(createLegadoSearchAdapter(document).search('书'), /验证/);
  fetch.mock.mockImplementation(async () => new Response('<p>没有结果</p>'));
  assert.deepEqual(await createLegadoSearchAdapter(document).search('书'), []);
});

test('abort propagates into fetch and prevents stale results from being published', async t => {
  t.mock.method(global, 'fetch', (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const controller = new AbortController();
  const results = [];
  const pending = searchSources([createLegadoSearchAdapter(document)], '书', controller.signal, result => results.push(result));
  controller.abort();
  await pending;
  assert.equal(results.length, 0);
});

test('publishes fast results independently, bounds concurrency, and cancels queued requests', async () => {
  let active = 0;
  let maximum = 0;
  const release = [];
  const started = [];
  const sources = Array.from({ length: 8 }, (_, index) => ({
    info: { id: String(index), name: String(index), kind: 'legado' },
    search: () => new Promise(resolve => {
      started.push(index);
      active++;
      maximum = Math.max(maximum, active);
      release[index] = () => { active--; resolve([]); };
    }),
  }));
  const controller = new AbortController();
  const results = [];
  const pending = searchSources(sources, '书', controller.signal, result => results.push(result));
  assert.equal(started.length, 3);
  release[1]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(results[0].source.info.id, '1');
  assert.equal(started.length, 4);
  controller.abort();
  release[0](); release[2](); release[3]();
  await pending;
  assert.equal(maximum, 3);
  assert.equal(started.length, 4);
  assert.equal(results.length, 1);
});
