export type BrowserSource = 'linovelib' | 'biquting' | 'bg94';
export type BrowserPageRequest = { source: BrowserSource; name: string; url: string; selector: string; purpose: string };
export type BrowserPage = { url: string; html: string };

const hosts: Record<BrowserSource, string[]> = {
  linovelib: ['w.linovelib.com', 'www.linovelib.com', 'tw.linovelib.com', 'www.bilinovel.com', 'www.bilinovel.net'],
  biquting: ['m.biquting.org', 'www.biquting.org'],
  bg94: ['m.bg94.cc', 'www.bg94.cc'],
};
export function browserSource(url: string): BrowserSource | undefined {
  try { const host = new URL(url).hostname; return (Object.keys(hosts) as BrowserSource[]).find(key => hosts[key].includes(host)); }
  catch { return undefined; }
}
export function allowedBrowserUrl(source: BrowserSource, input: string): boolean {
  try { const url = new URL(input); return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts[source].includes(url.hostname); }
  catch { return false; }
}
export const browserPageReady = (title: string, found: boolean, text: string) =>
  !/验证码|搜索验证|人机验证|Just a moment|Attention Required|Access denied/i.test(title) &&
  (found || /没有找到|未找到相关|没有相关|搜索结果为空|暂无搜索结果/.test(text));

// Fixed app-owned DOM extraction, never evaluates source-supplied JavaScript.
export function snapshotScript(selector: string) {
  return `(() => { const found = !!document.querySelector(${JSON.stringify(selector)}); return {url:location.href,title:document.title,found,text:document.body?.innerText.slice(0,3000)||'',html:document.documentElement.outerHTML}; })()`;
}
