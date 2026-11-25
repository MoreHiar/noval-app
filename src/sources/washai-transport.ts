import { loadBrowserPage } from './browser-session';
import { browserPageMatches, type BrowserPageRequest } from './browser-policy';
import type { SearchRequest, SearchResponse } from './search-transport';

type Transport = (request: SearchRequest, signal: AbortSignal) => Promise<SearchResponse>;
const MAX_SIZE = 5 * 1024 * 1024;

export function washaiPageRequest(input: string): BrowserPageRequest | undefined {
  const url = new URL(input);
  if (url.origin !== 'https://book.washai.net' || url.username || url.password) return;
  const page = url.pathname;
  const info = page === '/book/bookclass.html' ? { selector: '#bookList', purpose: '搜索与验证' }
    : /^\/book\/indexList-\d+\.html$|^\/book\/indexList\/\d+\/\d+\.html$/.test(page) ? { selector: '#indexPager[data-ssr-complete="1"]', purpose: '加载目录' }
      : /^\/book\/\d+\/\d+\.html$/.test(page) ? { selector: '#readPageBootstrap', purpose: '加载章节' }
        : /^\/book\/\d+\.html$/.test(page) ? { selector: '#allIndexLink', purpose: '加载书籍' } : undefined;
  return info ? { source: 'washai', name: '书海阁', url: url.toString(), ...info } : undefined;
}

// Keep protected requests inside the browser once verification is required. Fetch
// cannot reuse a WebView's browser identity merely by copying its cookies.
export function createWashaiTransport(direct: Transport): Transport {
  let browserSession = false;
  return async (request, signal) => {
    const browser = request.init.method === 'GET' ? washaiPageRequest(request.url) : undefined;
    if (!browser) return direct(request, signal);
    signal.throwIfAborted();
    if (!browserSession) {
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('书海阁连接超时，请重试。')), 45000);
      try {
        const response = await direct(request, controller.signal);
        if (response.url && !browserPageMatches(browser, response.url)) throw new Error('书海阁跳转到了其他页面，请重新搜索。');
        if (Number(response.headers.get('content-length')) > MAX_SIZE) throw new Error('书源响应超过 5 MB。');
        const body = await response.text();
        if (body.length > MAX_SIZE) throw new Error('书源响应超过 5 MB。');
        signal.throwIfAborted();
        const challenge = response.headers.get('cf-mitigated') === 'challenge' ||
          /<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(body) ||
          (!response.ok && /\/cdn-cgi\/challenge-platform\//i.test(body));
        if (!challenge) return { ok: response.ok, status: response.status, url: response.url, headers: response.headers, text: async () => body };
        browserSession = true;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    }
    const page = await loadBrowserPage(browser, signal);
    return { ok: true, status: 200, url: page.url, headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }), text: async () => page.html };
  };
}
