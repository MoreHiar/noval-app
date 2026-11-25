import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

const MAX_SIZE = 5 * 1024 * 1024;
// Exact hosts from the public source list. Never turn this endpoint into an open URL proxy.
const sourceHosts = new Set([
  'www.qidian.com', 'fqapi.komr.cn', 'appi.kuwo.cn', 'www.69shuba.com', '69shuba.cx',
  'www.sudugu.co', 'www.sudugu.cc', 'www.deqixs.com', 'www.kuaishu5.com', 'cn.ttkan.co', 'www.dbxsd.com',
  'www.shoujix.com', 'www.23qb.com', 'm.laikan9.com', 'www.wcxsw.org', 'www.siluke.com',
  'www.ddxs.com', 'hetushu.com', 'm.aitbooks.com', 'm.suixkan.com', 'www.92xs.info',
  'www.81zw2.com', 'www.50zw.so',
  'novel.snssdk.com', 'fanqienovel.com',
  'm.qidian.com', 'www.yuyouku.com',
  'www.jgwxs.com',
  // Exact public sites in the user-selected Yiove default collection.
  'm.cuoceng.org', 'm.jhssd.com', 'm.libahao.com', 'm.powenwu16.com', 'www.20xs.org',
  'www.38xs.com', 'www.biquge7.top', 'www.biquges123.com', 'www.biqusa.com', 'www.kanshuw.com',
  'www.kxwx.org', 'www.sudugu.org', 'www.yingsx.com',
]);
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedV4.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 96], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blockedV6.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  return version === 4 ? !blockedV4.check(address, 'ipv4') : version === 6 && !blockedV6.check(address, 'ipv6');
}

export function validateSourceTarget(input: string): URL {
  const url = new URL(input);
  const extraHosts = (process.env.NOVAL_SOURCE_HOSTS ?? '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || isIP(url.hostname) || (!sourceHosts.has(url.hostname) && !extraHosts.includes(url.hostname))) {
    throw new Error('网页暂不支持此书源地址，请更新书源或联系服务维护者。');
  }
  return url;
}

type RelayInput = { url: string; method: string; headers: Record<string, string>; body?: string };

// Resolve once, reject local addresses, then pin that address to the outgoing socket.
async function requestSource(input: RelayInput, signal: AbortSignal) {
  const url = validateSourceTarget(input.url);
  signal.throwIfAborted();
  let abortLookup: () => void = () => undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abortLookup = () => reject(signal.reason ?? new Error('已取消搜索。'));
    signal.addEventListener('abort', abortLookup, { once: true });
  });
  const addresses = await Promise.race([lookup(url.hostname, { all: true }), cancelled]).finally(() => signal.removeEventListener('abort', abortLookup));
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('书源域名未解析到可访问的公网地址。');
  const address = addresses.find(item => item.family === 4) ?? addresses[0];
  return new Promise<{ status: number; contentType: string; body: string; location?: string }>((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const outgoing = send(url, {
      method: input.method, signal, family: address.family,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Mozilla/5.0 Noval/1.0', ...input.headers, 'Accept-Encoding': 'identity' },
    }, incoming => {
      const status = incoming.statusCode ?? 502;
      const location = incoming.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        incoming.resume();
        resolve({ status, location, body: '', contentType: '' });
        return;
      }
      if (Number(incoming.headers['content-length']) > MAX_SIZE) {
        incoming.destroy(); reject(new Error('搜索响应超过 5 MB。')); return;
      }
      const encoding = incoming.headers['content-encoding'];
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : undefined;
      const stream = decoder ? incoming.pipe(decoder) : incoming;
      incoming.on('error', error => { decoder?.destroy(error); reject(error); });
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_SIZE) {
          incoming.destroy(); stream.destroy(); reject(new Error('搜索响应超过 5 MB。'));
        } else chunks.push(chunk);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8'), contentType: incoming.headers['content-type'] ?? '' }));
    });
    outgoing.on('error', reject);
    outgoing.end(input.body);
  });
}

export async function relaySource(input: RelayInput, signal: AbortSignal) {
  let current = input;
  for (let redirects = 0; redirects < 5; redirects++) {
    const response = await requestSource(current, signal);
    if (!response.location) return { ...response, url: current.url };
    const nextUrl = new URL(response.location, current.url);
    let next: URL;
    try { next = validateSourceTarget(nextUrl.toString()); }
    catch { throw new Error(`书源跳转到未配置的地址（${nextUrl.hostname}），原地址或规则可能已失效。`); }
    const switchToGet = response.status === 303 || ([301, 302].includes(response.status) && current.method === 'POST');
    current = { ...current, url: next.toString(), ...(switchToGet ? { method: 'GET', body: undefined } : {}) };
  }
  throw new Error('书源重定向次数过多。');
}

export async function handleSourceFetch(request: Request): Promise<Response> {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '仅允许应用同源请求。' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: '请求必须使用 JSON。' }, 415);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; cancel(); }, 18000);
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  try {
    const text = await request.text();
    if (text.length > 65536) return json({ error: '书源请求参数过大。' }, 413);
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.url !== 'string' || !['GET', 'POST'].includes(raw.method) || (raw.body !== undefined && (typeof raw.body !== 'string' || raw.method !== 'POST'))) return json({ error: '书源请求参数无效。' }, 400);
    try { validateSourceTarget(raw.url); }
    catch (cause) { return json({ error: (cause as Error).message }, 403); }
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.headers ?? {})) {
      if (/^(accept|accept-language|content-type|user-agent|referer)$/i.test(key) && typeof value === 'string' && !/[\r\n]/.test(value)) headers[key] = value;
    }
    const result = await relaySource({ url: raw.url, method: raw.method, headers, body: raw.body }, controller.signal);
    return json(result);
  } catch (cause) {
    if (timedOut) return json({ error: '书源站点连接超时，请稍后重试。' }, 504);
    if (request.signal.aborted) return json({ error: '已取消搜索。' }, 499);
    if (cause instanceof SyntaxError) return json({ error: '请求 JSON 无效。' }, 400);
    const code = (cause as NodeJS.ErrnoException)?.code;
    const message = cause instanceof Error ? cause.message : '';
    const error = code === 'ENOTFOUND' ? '书源域名无法解析，地址可能已失效。' : code === 'ECONNRESET' ? '书源站点断开了连接。' : /certificate|SSL|TLS/i.test(message) ? '无法验证书源网站的 HTTPS 证书，请稍后重试或更换书源。' : '书源转发失败：' + (message || '网络错误。');
    return json({ error }, 502);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', cancel);
  }
}
