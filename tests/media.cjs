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
  assert.equal((await adapter.getBook(book.id)).id, book.id);
  assert.ok(!requests.includes('/book/1'), 'the discovered book remains available in the adapter cache');
  const [chapter] = await adapter.getChapters(book.id);
  assert.equal(chapter.title, '第一话');
  const content = await adapter.getChapter(book.id, chapter.id);
  assert.deepEqual(content.imageUrls, ['https://fixture.example/a.jpg', 'https://fixture.example/b.jpg']);
  assert.deepEqual((await adapter.search('海风日记')).map(item => item.mediaType), ['manga']);
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
