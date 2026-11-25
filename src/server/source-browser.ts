import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { allowedBrowserUrl, BrowserPageRequest, BrowserSnapshot, browserPagePresentation, browserPageReady, snapshotScript } from '../sources/browser-policy';
import { isPublicAddress } from './source-fetch';

type Session = { context: BrowserContext; page: Page; request: BrowserPageRequest; used: number; started: number; busy: boolean };
type Runtime = { browser?: Promise<Browser>; sessions: Map<string, Session>; cleanup?: ReturnType<typeof setInterval> };
const host = globalThis as typeof globalThis & { novalSourceBrowser?: Runtime };
const runtime: Runtime = host.novalSourceBrowser ??= { sessions: new Map() };
// Keep the browser driver in the Node host; Metro must not bundle its binary paths.
const { chromium } = createRequire(resolve(process.cwd(),'package.json'))('playwright') as typeof import('playwright');
runtime.cleanup ??= setInterval(() => {
  for (const [id,session] of runtime.sessions) if (!session.busy && Date.now()-session.used>1800000) {
    runtime.sessions.delete(id);void session.context.close().catch(()=>undefined);
  }
},60000).unref();

async function publicUrl(input: string) {
  const url = new URL(input);
  if (url.protocol === 'data:' || url.protocol === 'blob:') return true;
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const addresses = await lookup(url.hostname, { all: true });
  return addresses.length > 0 && addresses.every(item => isPublicAddress(item.address));
}
async function createSession(request: BrowserPageRequest) {
  if (!allowedBrowserUrl(request.source, request.url) || !await publicUrl(request.url)) throw new Error('书源浏览器仅支持已确认的公网 HTTPS 网站。');
  for (const [id, session] of runtime.sessions) if (Date.now() - session.used > 1800000) { runtime.sessions.delete(id); await session.context.close(); }
  if (runtime.sessions.size >= 6) throw new Error('网页会话已满，请关闭其他验证窗口后重试。');
  runtime.browser ??= chromium.launch({ headless: true, ...(existsSync(chromium.executablePath()) ? {} : {channel:'chrome'}) }).catch(error => { runtime.browser = undefined; throw error; });
  const browser = await runtime.browser;
  const context = await browser.newContext({ viewport: { width: 390, height: 650 }, locale: 'zh-CN', acceptDownloads: false });
  const page = await context.newPage();
  page.on('popup', popup => { void popup.close(); });
  await context.route('**/*', async route => {
    const req = route.request();
    try {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame() && !allowedBrowserUrl(request.source, req.url())) return await route.abort();
      if (['media', 'websocket'].includes(req.resourceType()) || !await publicUrl(req.url())) return await route.abort();
      await route.continue();
    } catch { await route.abort().catch(() => undefined); }
  });
  const id = randomUUID();
  const session: Session = { context, page, request, used: Date.now(), started: Date.now(), busy: false };
  runtime.sessions.set(id, session);
  return { id, session };
}

export async function handleSourceBrowser(request: Request): Promise<Response> {
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const origin = new URL(request.url).origin;
  if ((request.headers.get('origin') && request.headers.get('origin') !== origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '仅允许同源请求。' },403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: '需要 JSON 请求。' },415);
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: '请求参数过大。' },413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object') throw new Error('请求无效。');
    let id: string = input.id;
    let session = runtime.sessions.get(id);
    if (input.action === 'start') {
      const target = input.request as BrowserPageRequest;
      if (!target || !['linovelib','biquting','bg94','washai'].includes(target.source) || typeof target.url !== 'string' || typeof target.selector !== 'string' || target.selector.length > 1000) throw new Error('书源请求无效。');
      if (session && session.request.source !== target.source) throw new Error('书源会话不匹配。');
      if (!session) ({ id, session } = await createSession(target));
      if (session.busy) throw new Error('网页正在加载，请稍后。');
      session.request = target;
    }
    if (!session) return json({ error: '网页会话已过期，请重试。' },410);
    session.used = Date.now();
    if (session.busy) throw new Error('网页正在处理操作，请稍后。');
    session.busy = true;
    try {
      if (input.action === 'close') { runtime.sessions.delete(id); await session.context.close(); return json({ closed: true }); }
      if (input.action === 'start') {
        if (!allowedBrowserUrl(session.request.source, session.request.url)) throw new Error('网页地址不允许。');
        session.started = Date.now();
        await session.page.goto(session.request.url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(error => {
          if (!allowedBrowserUrl(session!.request.source, session!.page.url())) throw new Error('网站连接失败或跳转到了未确认域名。');
          if (!/Timeout/.test(String(error))) throw error;
        });
      } else if (input.action === 'click') {
        if (!Number.isFinite(input.x) || !Number.isFinite(input.y) || input.x < 0 || input.x > 390 || input.y < 0 || input.y > 650) throw new Error('点击位置无效。');
        await session.page.mouse.click(input.x,input.y);
      } else if (input.action === 'type') {
        if (typeof input.text !== 'string' || input.text.length > 256) throw new Error('输入内容过长。');
        await session.page.keyboard.insertText(input.text);
      } else if (input.action === 'key') {
        if (!['Enter','Backspace','Tab'].includes(input.key)) throw new Error('按键无效。');
        await session.page.keyboard.press(input.key);
      } else if (input.action === 'scroll') {
        if (![1,-1].includes(input.direction)) throw new Error('滚动方向无效。');
        await session.page.mouse.wheel(0,input.direction * 450);
      } else if (input.action !== 'snapshot') throw new Error('操作无效。');
      const url = session.page.url();
      if (!allowedBrowserUrl(session.request.source,url)) throw new Error('网页已离开书源网站。');
      const snapshot = await session.page.evaluate(snapshotScript(session.request.selector)) as BrowserSnapshot;
      if (snapshot.html.length > 5*1024*1024) throw new Error('网页内容超过 5 MB。');
      const presentation = browserPagePresentation(snapshot, Date.now() - session.started);
      const ready = session.request.source === 'washai' ? presentation === 'ready' : browserPageReady(snapshot.title,snapshot.found,snapshot.text);
      if (ready) return json({ id, ready: true, url, html: snapshot.html });
      if (session.request.source === 'washai' && presentation === 'background') return json({ id, ready: false, needsInteraction: false, url });
      const screenshot = (await session.page.screenshot({ type: 'jpeg', quality: 65, timeout: 5000 })).toString('base64');
      return json({ id, ready: false, needsInteraction: true, url, title: snapshot.title, screenshot });
    } finally { session.busy = false; }
  } catch (error) {
    const message = error instanceof Error ? error.message : '网页加载失败。';
    return json({ error: /Executable doesn't exist/.test(message) ? '开发服务尚未安装浏览器，请在项目目录执行 npx playwright install chromium。' : message }, 502);
  }
}
