import { allowedBrowserUrl, BrowserPage, BrowserPageRequest } from './browser-policy';

export type BrowserTask = { id: number; request: BrowserPageRequest; finish(page: BrowserPage): void; fail(error: Error): void };
let tasks: BrowserTask[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());
export const subscribeBrowser = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const currentBrowserTask = () => tasks[0] ?? null;

export function loadBrowserPage(request: BrowserPageRequest, signal?: AbortSignal): Promise<BrowserPage> {
  if (!allowedBrowserUrl(request.source, request.url)) return Promise.reject(new Error('书源浏览器地址不在已确认的网站范围内。'));
  if (signal?.aborted) { const error=new Error('已取消加载。');error.name='AbortError';return Promise.reject(error); }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const done = (error?: Error, page?: BrowserPage) => {
      if (!tasks.some(task => task.id === id)) return;
      tasks = tasks.filter(task => task.id !== id); clearTimeout(timer); signal?.removeEventListener('abort', abort); changed();
      if (error) reject(error); else resolve(page!);
    };
    const abort = () => { const error = new Error('已取消加载。'); error.name = 'AbortError'; done(error); };
    const timer = setTimeout(() => done(new Error('网页验证等待超时，请重新搜索或重试。')), 300000);
    tasks = [...tasks, { id, request, finish: page => {
      if (!allowedBrowserUrl(request.source, page.url) || page.html.length > 5 * 1024 * 1024) return done(new Error('网页地址或内容大小无效。'));
      done(undefined, page);
    }, fail: error => done(error) }];
    signal?.addEventListener('abort', abort, { once: true }); changed();
  });
}
