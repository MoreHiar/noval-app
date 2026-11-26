const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};

const { handleSourceFetch, isPublicAddress, validateSourceTarget } = require('../src/server/source-fetch.ts');
const { fetchSearchResponse } = require('../src/sources/search-transport.web.ts');

test('relay only accepts configured exact hosts, normal web ports and public DNS addresses', () => {
  assert.equal(validateSourceTarget('https://appi.kuwo.cn/novels/api/book/search').hostname, 'appi.kuwo.cn');
  assert.equal(validateSourceTarget('https://www.sudugu.cc/modules/article/search.php').hostname, 'www.sudugu.cc');
  assert.equal(validateSourceTarget('https://novel.snssdk.com/api/novel/channel/homepage/search/search/v1/').hostname, 'novel.snssdk.com');
  assert.equal(validateSourceTarget('https://m.cuoceng.org/book/so/test/1.html').hostname, 'm.cuoceng.org');
  assert.equal(validateSourceTarget('https://www.yingsx.com/cse/search?q=test').hostname, 'www.yingsx.com');
  assert.equal(validateSourceTarget('https://m.qidian.com/so/test.html').hostname, 'm.qidian.com');
  assert.equal(validateSourceTarget('https://www.yuyouku.com/search').hostname, 'www.yuyouku.com');
  assert.equal(validateSourceTarget('https://v1.gyks.cf/search').hostname, 'v1.gyks.cf');
  assert.equal(validateSourceTarget('https://book.washai.net/book/bookclass.html?k=test').hostname, 'book.washai.net');
  assert.equal(validateSourceTarget('https://www.bqg349.xyz/api/search?q=test').hostname, 'www.bqg349.xyz');
  assert.equal(validateSourceTarget('https://www.guazimanhua.com/category.php?keyword=test').hostname, 'www.guazimanhua.com');
  assert.throws(() => validateSourceTarget('https://www.guazimanhua.com.evil.test/chapter.php'));
  assert.throws(() => validateSourceTarget('https://www.bqg349.xyz.evil.test/api/search?q=test'));
  for (const url of ['http://127.0.0.1', 'http://169.254.169.254', 'file:///etc/passwd', 'https://appi.kuwo.cn.evil.test', 'https://appi.kuwo.cn:1234', 'https://user:secret@appi.kuwo.cn', 'http://[::1]']) assert.throws(() => validateSourceTarget(url));
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.2', '169.254.169.254', '100.64.0.2', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('relay reports a changed unconfigured redirect host and never sends a request to it', async t => {
  const { EventEmitter } = require('node:events');
  const { PassThrough } = require('node:stream');
  const dns = require('node:dns/promises');
  const https = require('node:https');
  t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  t.mock.method(https, 'request', (url, _options, callback) => {
    assert.equal(url.hostname, 'm.aitbooks.com');
    const outgoing = new EventEmitter();
    outgoing.end = () => {
      const incoming = new PassThrough();
      incoming.statusCode = 301;
      incoming.headers = { location: 'https://unconfigured.example' };
      callback(incoming);
      incoming.end();
    };
    return outgoing;
  });
  const response = await handleSourceFetch(new Request('http://localhost/api/source-fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://m.aitbooks.com/search/', method: 'GET' }) }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /跳转.*unconfigured\.example/);
  assert.equal(https.request.mock.callCount(), 1);
});

test('relay rejects cross-site, invalid and unconfigured requests before sending anything upstream', async t => {
  const dns = require('node:dns/promises');
  t.mock.method(dns, 'lookup', () => { throw new Error('Must not resolve'); });
  const request = (body, headers = {}) => new Request('http://localhost:8083/api/source-fetch', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await handleSourceFetch(request({ url: 'http://127.0.0.1', method: 'GET' }))).status, 403);
  assert.equal((await handleSourceFetch(request({ url: 'https://appi.kuwo.cn', method: 'GET' }, { Origin: 'https://foreign.example' }))).status, 403);
  assert.equal((await handleSourceFetch(request({ url: 'https://appi.kuwo.cn', method: 'DELETE' }))).status, 400);
  assert.equal((await handleSourceFetch(request(null))).status, 400);
  assert.equal((await handleSourceFetch(request({ url: 'https://appi.kuwo.cn', method: 'POST', body: 'a'.repeat(65536) }))).status, 413);
  assert.equal(dns.lookup.mock.callCount(), 0);
});

test('relay rejects a configured host resolving to an internal address', async t => {
  const dns = require('node:dns/promises');
  t.mock.method(dns, 'lookup', async () => [{ address: '127.0.0.1', family: 4 }]);
  const response = await handleSourceFetch(new Request('http://localhost:8083/api/source-fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://appi.kuwo.cn', method: 'GET' }) }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /公网/);
});

test('web search only fetches the same-origin service and preserves upstream URL, body, status and cancellation', async t => {
  const controller = new AbortController();
  t.mock.method(global, 'fetch', async (url, init) => {
    assert.equal(url, '/api/source-fetch');
    assert.equal(init.signal, controller.signal);
    assert.equal(init.credentials, 'omit');
    assert.deepEqual(JSON.parse(init.body), { url: 'https://appi.kuwo.cn/search', method: 'POST', body: 'q=test', headers: { Accept: 'application/json' } });
    return Response.json({ url: 'https://appi.kuwo.cn/search', status: 503, body: 'upstream error', contentType: 'text/plain' });
  });
  const result = await fetchSearchResponse({ url: 'https://appi.kuwo.cn/search', init: { method: 'POST', body: 'q=test', headers: { Accept: 'application/json' }, credentials: 'omit' } }, controller.signal);
  assert.equal(result.status, 503);
  assert.equal(result.ok, false);
  assert.equal(result.url, 'https://appi.kuwo.cn/search');
  assert.equal(await result.text(), 'upstream error');
});

test('web service errors and missing server deployment are reported accurately', async t => {
  t.mock.method(global, 'fetch', async () => Response.json({ error: '书源域名无法解析' }, { status: 502 }));
  const request = { url: 'https://appi.kuwo.cn/search', init: { method: 'GET', headers: {}, credentials: 'omit' } };
  await assert.rejects(fetchSearchResponse(request, new AbortController().signal), /域名无法解析/);
  fetch.mock.mockImplementation(async () => new Response('<html>SPA fallback</html>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(fetchSearchResponse(request, new AbortController().signal), /服务端/);
});
