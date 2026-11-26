const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};

const { createLegadoSearchAdapter, firstExploreUrl } = require('../src/sources/legado-search.ts');
const { imageUrlsFromRule } = require('../src/sources/rule-reader.ts');
const { getShelfBooks, parseLibraryData, setShelfBook } = require('../src/sources/management.ts');
const guazimanhua = require('../docs/sources/guazimanhua.json');

const source = {
  bookSourceName: '漫画测试源', bookSourceUrl: 'https://fixture.example', bookSourceType: 2,
  enabled: true, enabledExplore: true, exploreUrl: '首页::/home&&分类::/category',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: 'a@text', bookUrl: 'a@href', coverUrl: 'img@src' },
  ruleExplore: { bookList: '.book', name: 'a@text', bookUrl: 'a@href', coverUrl: 'img@src' },
  ruleBookInfo: { name: 'h1@text', author: '.author@text', intro: '.intro@text', tocUrl: '.catalog@href' },
  ruleToc: { chapterList: '.chapters a', chapterName: 'text', chapterUrl: 'href' },
  ruleContent: { content: '.pages@html' },
};

test('picture source search and first discover entry preserve media type and open the same book', async t => {
  assert.equal(firstExploreUrl(source.exploreUrl), '/home');
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const path = new URL(url).pathname;
    requests.push(path);
    if (path === '/home' || path === '/search') return new Response('<div class="book"><a href="/book/1">海风日记</a><img src="/cover.jpg"></div>');
    if (path === '/book/1') return new Response('<h1>海风日记</h1><p class="author">作者</p><p class="intro">海边的故事</p><a class="catalog" href="/toc/1">目录</a>');
    if (path === '/toc/1') return new Response('<div class="chapters"><a href="/chapter/1">第一话</a></div>');
    if (path === '/chapter/1') return new Response('<div class="pages"><img data-src="/a.jpg"><img src="/b.jpg"></div>');
    throw new Error(`Unexpected ${path}`);
  });
  const adapter = createLegadoSearchAdapter(source);
  assert.equal(adapter.info.mediaType, 'manga');
  assert.equal(adapter.discoverUnavailableReason, undefined);
  const [book] = await adapter.discover();
  assert.equal(book.mediaType, 'manga');
  assert.equal(book.title, '海风日记');
  const details = await adapter.getBook(book.id);
  assert.equal(details.id, book.id);
  assert.equal(details.summary, '海边的故事');
  assert.equal(requests.filter(path => path === '/book/1').length, 1);
  const [chapter] = await adapter.getChapters(book.id);
  assert.equal(chapter.title, '第一话');
  const content = await adapter.getChapter(book.id, chapter.id);
  assert.deepEqual(content.imageUrls, ['https://fixture.example/a.jpg', 'https://fixture.example/b.jpg']);
  assert.deepEqual((await adapter.search('海风日记')).map(item => item.mediaType), ['manga']);
});

test('Guazi rules parse search, home, detail and ascending chapters from its public HTML structure', async t => {
  const pages = new Map([
    ['/category.php', '<article class="card"><a class="cover-wrap" href="/comic.php?id=13508"><img src="/cover.webp"></a><h3><a href="/comic.php?id=13508">斗破苍穹</a></h3><div class="meta">知音漫客 · 热血</div></article>'],
    ['/', '<article class="comic-card"><a class="hot-art" href="/comic.php?id=13508"><img src="/cover.webp"></a><h3><a href="/comic.php?id=13508">斗破苍穹</a></h3><p>热血 / 玄幻</p></article>'],
    ['/comic.php', '<section class="mobile-comic-hero"><img class="mobile-comic-cover" src="/cover.webp"><div class="mobile-comic-title">斗破苍穹</div><p class="mobile-comic-tags" data-mobile-comic-author><a>知音漫客</a></p><p class="mobile-comic-desc">少年修行的故事</p></section><div class="mobile-chapter-grid"><a href="/chapter.php?id=2">第二话</a><a href="/chapter.php?id=1">第一话</a></div>'],
    ['/chapter.php', '<div class="reader-images"><img class="reading-image" src="/page-1.webp"><img class="reading-image" src="/page-2.webp"></div><div class="recommend-cover"><img src="/unrelated.webp"></div>'],
  ]);
  t.mock.method(globalThis, 'fetch', async url => new Response(pages.get(new URL(url).pathname) ?? '', { status: pages.has(new URL(url).pathname) ? 200 : 404 }));
  const adapter = createLegadoSearchAdapter(guazimanhua);
  assert.equal(adapter.info.mediaType, 'manga');
  assert.equal(adapter.searchUnavailableReason, undefined);
  assert.equal(adapter.discoverUnavailableReason, undefined);
  const [search] = await adapter.search('斗破苍穹');
  const [recommended] = await adapter.discover();
  assert.equal(search.author, '知音漫客');
  assert.equal(search.category, '热血');
  assert.equal(recommended.id, search.id);
  assert.equal((await adapter.getBook(search.id)).summary, '少年修行的故事');
  const chapters = await adapter.getChapters(search.id);
  assert.deepEqual(chapters.map(chapter => chapter.title), ['第一话', '第二话']);
  assert.deepEqual((await adapter.getChapter(search.id, chapters[0].id)).imageUrls, ['https://www.guazimanhua.com/page-1.webp', 'https://www.guazimanhua.com/page-2.webp']);
});

test('image rules handle bare image selectors and reject script schemes', () => {
  const body = '<div class="pages"><img data-src="/a.jpg"><img src="javascript:alert(1)"><img src="https://other.example/b.jpg"></div>';
  assert.deepEqual(imageUrlsFromRule(body, '.pages img', 'https://fixture.example/chapter'), ['https://fixture.example/a.jpg', 'https://other.example/b.jpg']);
});

test('manga shelf snapshots retain their tag while older books default to novels', () => {
  const definition = { kind: 'legado', enabled: true, document: source };
  const adapter = createLegadoSearchAdapter(source);
  const manga = { id: 'web-0061', sourceId: adapter.info.id, title: '海风日记', author: '作者', summary: '', category: '漫画', status: '状态未知', accent: '#455D6B', mediaType: 'manga' };
  const current = setShelfBook({ version: 1, definitions: [definition], shelf: [] }, manga, true);
  assert.equal(getShelfBooks(parseLibraryData(JSON.stringify(current)))[0].mediaType, 'manga');
  const old = { ...manga }; delete old.mediaType;
  assert.equal(getShelfBooks(parseLibraryData(JSON.stringify(setShelfBook({ version: 1, definitions: [definition], shelf: [] }, old, true))))[0].mediaType, undefined);
});
