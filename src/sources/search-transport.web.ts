import type { SearchRequest, SearchResponse } from './search-transport';

export async function fetchSearchResponse(request: SearchRequest, signal: AbortSignal): Promise<SearchResponse> {
  let response: Response;
  try {
    response = await fetch('/api/source-fetch', {
      method: 'POST', signal, credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: request.url, method: request.init.method, headers: request.init.headers, body: request.init.body }),
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error('无法连接应用的书源转发服务，请确认 Expo 开发服务正在运行。');
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new Error('书源转发服务未启动，请重启 Expo；部署网页版时需要同时部署服务端。');
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : '书源转发服务返回 HTTP ' + response.status);
  if (typeof result.body !== 'string' || typeof result.url !== 'string' || !Number.isInteger(result.status)) throw new Error('书源转发服务响应格式无效。');
  return {
    ok: result.status >= 200 && result.status < 300, status: result.status, url: result.url,
    headers: new Headers({ 'Content-Type': result.contentType ?? '' }),
    text: async () => result.body,
  };
}
