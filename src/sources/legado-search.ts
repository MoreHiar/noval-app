import JSON5 from 'json5';
import { parseDocument } from 'htmlparser2';
import { selectAll } from 'css-select';
import type { Book, RuleSourceDocument, SourceAdapter } from '../domain/books';
import { ruleSourceId } from './legado';
import { compileFieldRule, compileListRule, UnsupportedSearchRule } from './legado-rules';
import { fetchSearchResponse } from './search-transport';
import { isLegacyQidianSearch, isLegacySuduguSearch, isYuyoukuFormSearch, knownSearchCover, searchRulesFor } from './search-compat';
import { isFanqieSourceId } from './fanqie';
import { createFanqieReader } from './reading';
import { createJgwxsReader } from './jgwxs-reader';
import { createWashaiReader } from './washai-reader';
import { BQG349_URL, createBqg349Reader } from './bqg349-reader';
import { browserSearch, browserSearchRules } from './browser-search';
import { loadBrowserPage } from './browser-session';
import { createQidianReader } from './qidian-reader';
import { createBrowserReader } from './browser-reader';
import { isQingtianSearch, qingtianBookUrl, qingtianSearchRequest } from './qingtian-search';
import { createRuleReader } from './rule-reader';

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const MAX_CACHED_BOOKS = 100;
type RequestOptions = { method?: string; body?: string; charset?: string; headers?: unknown };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function firstExploreUrl(value: string): string {
  const raw = value.trim();
  if (!raw) throw new UnsupportedSearchRule('发现地址为空。');
  let entry: unknown = raw;
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try { entry = JSON5.parse(raw); }
    catch { throw new UnsupportedSearchRule('发现地址配置不是有效的 JSON。'); }
    if (Array.isArray(entry)) entry = entry[0];
    if (record(entry)) entry = entry.url ?? entry.exploreUrl;
  }
  if (typeof entry !== 'string') throw new UnsupportedSearchRule('暂不支持此发现地址格式。');
  const line = entry.split(/\r?\n|&&/).map(item => item.trim()).find(Boolean) ?? '';
  const url = (line.includes('::') ? line.slice(line.indexOf('::') + 2) : line).trim();
  if (!url || /\{\{\s*key\s*\}\}/i.test(url)) throw new UnsupportedSearchRule('发现地址不能依赖搜索关键词。');
  return url;
}

function httpUrl(value: string, base: string): string {
  if (!value.trim()) throw new Error('搜索结果缺少书籍链接。');
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('搜索链接必须为不含账号密码的 HTTP(S) 地址。');
  return url.toString();
}

function headersFrom(value: unknown): Record<string, string> {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'string') {
    try { value = JSON5.parse(value); }
    catch { throw new UnsupportedSearchRule('请求头不是有效的 JSON 配置，暂不支持脚本请求头。'); }
  }
  if (!record(value)) throw new UnsupportedSearchRule('请求头必须是 JSON 对象。');
  const headers: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string' || /@js:|<js>|\{\{/i.test(item)) throw new UnsupportedSearchRule('暂不支持动态请求头。');
    // This first search implementation is stateless. Never supply saved cookies.
    if (!/^(cookie|cookie2|host|connection|content-length)$/i.test(key)) headers[key] = item;
  }
  return headers;
}

export function buildSearchRequest(document: RuleSourceDocument, keyword: string) {
  if (isQingtianSearch(document)) return qingtianSearchRequest(keyword);
  const endpoint = browserSearch(document,keyword)?.url ?? (isYuyoukuFormSearch(document) ? 'https://www.yuyouku.com/' : document.searchUrl?.trim());
  if (!endpoint) throw new UnsupportedSearchRule('此书源没有搜索地址。');
  if (/java\.getVerificationCode\s*\(/.test(endpoint)) throw new UnsupportedSearchRule('此书源搜索需要浏览器会话和人工验证码；当前尚未接入验证流程，配置完整也不能直接搜索。');
  if (/@js:|<js>/i.test(endpoint) && /webView|startBrowser/.test(endpoint)) throw new UnsupportedSearchRule('此书源需要浏览器执行网页、保留会话并处理验证，当前尚未接入该能力。');
  if (/@js:|<js>/i.test(endpoint)) throw new UnsupportedSearchRule('此书源的搜索地址需要脚本支持。');
  const boundary = endpoint.search(/,\s*\{/);
  let options: RequestOptions = {};
  if (boundary >= 0) {
    let raw: unknown;
    try { raw = JSON5.parse(endpoint.slice(boundary + 1)); }
    catch { throw new UnsupportedSearchRule('搜索请求参数格式暂不支持。'); }
    if (!record(raw)) throw new UnsupportedSearchRule('搜索请求参数必须是对象。');
    if (raw.webView === true) throw new UnsupportedSearchRule('此书源设置了 webView: true，需要浏览器加载搜索页；当前仅支持直接网络请求，尚未接入 WebView 搜索。');
    const unsupported = Object.keys(raw).filter(key => !['method', 'body', 'charset', 'headers'].includes(key));
    if (unsupported.length) throw new UnsupportedSearchRule('此书源含尚未支持的搜索请求选项：' + unsupported.join('、'));
    options = raw as RequestOptions;
  }
  if (options.charset && !/^utf-?8$/i.test(options.charset)) throw new UnsupportedSearchRule('此书源使用 ' + options.charset + ' 编码，尚未接入。');
  const interpolate = (template: string) => {
    const value = template.replace(/\{\{\s*key\s*\}\}/g, encodeURIComponent(keyword)).replace(/\{\{\s*page\s*\}\}/g, '1').replace(/\{\{\s*\(\s*page\s*-\s*1\s*\)\s*\*\s*10\s*\}\}/g, '0').replace(/\{\{\s*baseUrl\s*\}\}/g, document.bookSourceUrl.trim());
    if (/\{\{|@js:|<js>/i.test(value)) throw new UnsupportedSearchRule('此书源的搜索模板需要脚本支持。');
    return value;
  };
  if (options.method !== undefined && typeof options.method !== 'string') throw new UnsupportedSearchRule('搜索请求方法格式无效。');
  const method = (options.method ?? 'GET').toUpperCase();
  if (!['GET', 'POST'].includes(method)) throw new UnsupportedSearchRule('暂不支持此搜索请求方法：' + method);
  if (options.body !== undefined && (typeof options.body !== 'string' || method !== 'POST')) throw new UnsupportedSearchRule('暂仅支持 POST 文字请求体。');
  const headers = browserSearch(document,keyword) ? {} : { ...headersFrom(document.header), ...headersFrom(options.headers) };
  if (options.body !== undefined && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  const url = new URL(httpUrl(interpolate(boundary < 0 ? endpoint : endpoint.slice(0, boundary)), document.bookSourceUrl.trim()));
  // This legacy source advertises HTTP, but its identical HTTPS endpoint is available.
  // Use HTTPS for this verified endpoint so native transport security doesn't reject it.
  if (url.hostname === 'appi.kuwo.cn' && url.protocol === 'http:') url.protocol = 'https:';
  // Avoid the old host's POST → GET redirect, which discards the search keyword.
  if (isLegacySuduguSearch(url)) { url.hostname = 'www.sudugu.cc'; url.protocol = 'https:'; }
  return {
    url: url.toString(),
    init: { method, headers, credentials: 'omit' as const, ...(options.body !== undefined ? { body: interpolate(options.body) } : {}) },
  };
}

async function resolveSearchRequest(document: RuleSourceDocument, keyword: string, signal: AbortSignal) {
  const request = buildSearchRequest(document, keyword);
  if (!isYuyoukuFormSearch(document)) return request;
  const response = await fetchSearchResponse(request, signal);
  if (!response.ok) throw new Error('获取搜索表单失败（HTTP ' + response.status + '）。');
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_SIZE) throw new Error('搜索响应超过 5 MB。');
  const body = await response.text();
  if (body.length > MAX_RESPONSE_SIZE) throw new Error('搜索响应超过 5 MB。');
  signal.throwIfAborted();
  const base = new URL(response.url || request.url);
  if (base.origin !== new URL(request.url).origin) throw new Error('书源已跳转到其他网站，需先更新并确认搜索规则。');
  const action = selectAll('form[role="form"]', parseDocument(body))
    .map(node => 'attribs' in node && record(node.attribs) ? node.attribs.action : undefined)
    .find((value): value is string => typeof value === 'string' && !!value);
  if (!action) throw new Error('网站未返回搜索表单，可能存在验证或页面结构已变化。');
  const target = new URL(action, base);
  if (target.origin !== base.origin || target.username || target.password) throw new Error('搜索表单指向其他网站或无效地址，已停止请求。');
  target.searchParams.set('keyword', keyword);
  return { ...request, url: target.toString() };
}

function compileSearch(document: RuleSourceDocument) {
  if (document.bookSourceType !== undefined && ![0, 2].includes(document.bookSourceType)) throw new UnsupportedSearchRule('搜索暂仅支持文本和图片书源。');
  buildSearchRequest(document, 'test');
  const rules = browserSearch(document,'test') ? browserSearchRules(document) : searchRulesFor(document);
  const qingtian = isQingtianSearch(document);
  const list = compileListRule(rules.bookList);
  if (typeof rules.name !== 'string' || !rules.name.trim() || typeof rules.bookUrl !== 'string' || !rules.bookUrl.trim()) throw new UnsupportedSearchRule('缺少书名或书籍链接搜索规则。');
  const name = compileFieldRule(rules.name);
  const bookUrl = qingtian ? qingtianBookUrl : compileFieldRule(rules.bookUrl);
  const optional = (expression: unknown) => {
    try { return compileFieldRule(expression); }
    catch { return () => ''; }
  };
  return { list, name, bookUrl, coverUrl: optional(rules.coverUrl), coverFallbackUrl: optional(rules.coverFallbackUrl), author: optional(rules.author), intro: optional(rules.intro), kind: optional(rules.kind) };
}

function aborted(): Error {
  const error = new Error('已取消搜索。');
  error.name = 'AbortError';
  return error;
}

export function createLegadoSearchAdapter(document: RuleSourceDocument, getSavedBook?: (bookId: string) => Promise<Book | null>): SourceAdapter {
  const sourceId = ruleSourceId(document);
  const sourceUrl = document.bookSourceUrl.trim().replace(/\/$/, '');
  const ruleReader = createRuleReader(document);
  const reader = isFanqieSourceId(sourceId) ? createFanqieReader(sourceId) : sourceUrl === 'https://www.jgwxs.com' ? createJgwxsReader(sourceId) : sourceUrl === 'https://book.washai.net' ? createWashaiReader(sourceId) : sourceUrl === BQG349_URL ? createBqg349Reader(sourceId) : isLegacyQidianSearch(document) ? createQidianReader(sourceId) : browserSearch(document,'test') ? createBrowserReader(document) : ruleReader;
  const cache = new Map<string, Book>();
  let compiled: ReturnType<typeof compileSearch> | undefined;
  let searchUnavailableReason: string | undefined;
  try { compiled = compileSearch(document); }
  catch (cause) { searchUnavailableReason = cause instanceof Error ? cause.message : '暂不支持此搜索规则。'; }
  let exploreAdapter: SourceAdapter | undefined;
  let discoverUnavailableReason: string | undefined;
  if (document.enabledExplore && document.exploreUrl && document.ruleExplore && !Array.isArray(document.ruleExplore)) {
    try {
      const exploreUrl = firstExploreUrl(document.exploreUrl);
      exploreAdapter = createLegadoSearchAdapter({ ...document, searchUrl: exploreUrl, ruleSearch: document.ruleExplore,
        enabledExplore: false, exploreUrl: undefined, ruleExplore: undefined }, getSavedBook);
      discoverUnavailableReason = exploreAdapter.searchUnavailableReason;
    } catch (cause) { discoverUnavailableReason = cause instanceof Error ? cause.message : '发现规则暂不可用。'; }
  } else discoverUnavailableReason = '此书源没有可用的发现规则。';
  return {
    info: { id: sourceId, name: document.bookSourceName, kind: 'legado', description: document.bookSourceComment ?? '', mediaType: document.bookSourceType === 2 ? 'manga' : 'novel' },
    searchUnavailableReason,
    discoverUnavailableReason,
    ...(exploreAdapter && !discoverUnavailableReason ? { discover: async (signal?: AbortSignal) => {
      const books = await exploreAdapter.search('homepage', signal);
      for (const book of books) { cache.delete(book.id); cache.set(book.id, book); }
      while (cache.size > MAX_CACHED_BOOKS) cache.delete(cache.keys().next().value!);
      return books;
    } } : {}),
    async search(query, signal) {
      if (signal?.aborted) throw aborted();
      if (!query.trim()) return [];
      if (!compiled) throw new UnsupportedSearchRule(searchUnavailableReason);
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel);
      let timedOut = false;
      const browser = browserSearch(document,query.trim());
      const timer = setTimeout(() => { timedOut = true; cancel(); }, browser || sourceUrl === 'https://book.washai.net' ? 300000 : TIMEOUT_MS);
      try {
        const request = browser ? buildSearchRequest(document,query.trim()) : await resolveSearchRequest(document, query.trim(), controller.signal);
        controller.signal.throwIfAborted();
        const page = browser ? await loadBrowserPage(browser,controller.signal) : undefined;
        const response = page ? {ok:true,status:200,url:page.url,headers:new Headers({'content-type':'text/html; charset=utf-8'}),text:async()=>page.html} : await fetchSearchResponse(request, controller.signal);
        if (!response.ok) throw new Error('网站返回 HTTP ' + response.status);
        if (Number(response.headers.get('content-length')) > MAX_RESPONSE_SIZE) throw new Error('搜索响应超过 5 MB。');
        const contentType = response.headers.get('content-type') ?? '';
        const charset = contentType.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1];
        if (charset && !/^utf-?8$/i.test(charset)) throw new Error('网站返回 ' + charset + ' 编码，尚未支持。');
        const html = await response.text();
        if (html.length > MAX_RESPONSE_SIZE) throw new Error('搜索响应超过 5 MB。');
        if (signal?.aborted) throw aborted();
        const items = compiled.list(html);
        if (!items.length && /"(?:challenge_url|error)"\s*:\s*"(?:[^"\n]*challenge[^"\n]*|\/__gatekeeper[^"\n]*)"|<title>\s*(?:Just a moment|Attention Required)/i.test(html)) throw new Error('网站要求防护验证，当前直接搜索无法通过。');
        const results = new Map<string, Book>();
        for (const item of items.slice(0, 100)) {
          const title = compiled.name(item).slice(0, 512);
          const link = compiled.bookUrl(item);
          if (!title || !link) continue;
          let url: string;
          try { url = httpUrl(link, response.url || request.url); }
          catch { continue; }
          let coverUrl: string | undefined;
          const cover = compiled.coverUrl(item);
          if (cover) {
            try { coverUrl = httpUrl(cover, response.url || request.url); }
            catch { /* Invalid optional artwork must not discard a book. */ }
          }
          coverUrl ??= knownSearchCover(document, url);
          let coverFallbackUrl: string | undefined;
          const fallback = compiled.coverFallbackUrl(item);
          if (fallback && fallback !== cover) {
            try { coverFallbackUrl = httpUrl(fallback, response.url || request.url); }
            catch { /* Invalid optional artwork must not discard a book. */ }
          }
          // Hex URLs contain no slash or percent escape, so Router can safely round-trip IDs.
          const id = 'web-' + Array.from(url).map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
          const book: Book = {
            id, sourceId, title, author: compiled.author(item).slice(0, 256) || '未知作者',
            summary: compiled.intro(item).slice(0, 4000), category: compiled.kind(item).slice(0, 128) || '网络书源',
            status: '状态未知', accent: '#526C63',
            ...(document.bookSourceType === 2 ? { mediaType: 'manga' as const } : {}),
            ...(coverUrl ? { coverUrl } : {}),
            ...(coverFallbackUrl ? { coverFallbackUrl } : {}),
          };
          results.set(id, book);
          cache.delete(id);
          cache.set(id, book);
        }
        if (items.length && !results.size) throw new Error('找到了列表，但无法提取有效书名或链接，请检查书源规则是否已失效。');
        while (cache.size > MAX_CACHED_BOOKS) cache.delete(cache.keys().next().value!);
        return [...results.values()];
      } catch (cause) {
        if (signal?.aborted) throw aborted();
        if (timedOut) throw new Error('搜索超时，请稍后重试。');
        const message = cause instanceof Error ? cause.message : '';
        if (/hostname.*(?:not be found|could not)|ENOTFOUND|name.*not.*resolved/i.test(message)) throw new Error('书源域名无法解析，地址可能已失效。');
        if (/certificate|SSL|TLS/i.test(message)) throw new Error('无法验证书源网站的 HTTPS 证书，请稍后重试或更换书源。');
        if (/network connection was lost|ECONNRESET/i.test(message)) throw new Error('书源网站中断了连接，请稍后重试。');
        if (cause instanceof TypeError) throw new Error('无法连接书源网站，请检查网络或稍后重试。');
        throw cause;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
    },
    async getBook(bookId, signal) {
      if (reader && reader !== ruleReader && !isFanqieSourceId(sourceId)) return reader.getBook(bookId, signal);
      const snapshot = cache.get(bookId) ?? (await getSavedBook?.(bookId));
      if (document.bookSourceType === 2 && ruleReader && reader === ruleReader) {
        try {
          const details = await ruleReader.getBook(bookId, signal);
          if (details) {
            const book = { ...snapshot, ...details, category: snapshot?.category ?? details.category };
            cache.set(bookId, book);
            return book;
          }
        } catch (error) {
          if (!snapshot || signal?.aborted) throw error;
        }
      }
      return snapshot ?? (reader ? reader.getBook(bookId, signal) : null);
    },
    async getChapters(bookId, signal) { return reader ? reader.getChapters(bookId, signal) : []; },
    async getChapter(bookId, chapterId, signal) { return reader ? reader.getChapter(bookId, chapterId, signal) : null; },
  };
}
