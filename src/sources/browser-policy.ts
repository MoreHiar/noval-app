export type BrowserSource = 'linovelib' | 'biquting' | 'bg94' | 'washai';
export type BrowserPageRequest = { source: BrowserSource; name: string; url: string; selector: string; purpose: string };
export type BrowserPage = { url: string; html: string };

const hosts: Record<BrowserSource, string[]> = {
  linovelib: ['w.linovelib.com', 'www.linovelib.com', 'tw.linovelib.com', 'www.bilinovel.com', 'www.bilinovel.net'],
  biquting: ['m.biquting.org', 'www.biquting.org'],
  bg94: ['m.bg94.cc', 'www.bg94.cc'],
  washai: ['book.washai.net'],
};
export function browserSource(url: string): BrowserSource | undefined {
  try { const host = new URL(url).hostname; return (Object.keys(hosts) as BrowserSource[]).find(key => hosts[key].includes(host)); }
  catch { return undefined; }
}
export function allowedBrowserUrl(source: BrowserSource, input: string): boolean {
  try { const url = new URL(input); return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts[source].includes(url.hostname); }
  catch { return false; }
}
export function browserPageMatches(request: BrowserPageRequest, input: string): boolean {
  try {
    const expected = new URL(request.url);
    const actual = new URL(input);
    return expected.origin === actual.origin && expected.pathname === actual.pathname &&
      [...expected.searchParams].every(([key, value]) => actual.searchParams.get(key) === value);
  } catch { return false; }
}
export const browserPageReady = (title: string, found: boolean, text: string) =>
  !/验证码|搜索验证|人机验证|Just a moment|Attention Required|Access denied/i.test(title) &&
  (found || /没有找到|未找到相关|没有相关|搜索结果为空|暂无搜索结果/.test(text));

export type BrowserSnapshot = BrowserPage & { title: string; found: boolean; text: string; manual?: boolean; challenge?: boolean };

export function browserPagePresentation(page: BrowserSnapshot, elapsedMs: number): 'ready' | 'background' | 'interactive' {
  if (!page.manual && browserPageReady(page.title, page.found, page.text)) return 'ready';
  // Allow the site's ordinary JavaScript checks to finish before asking for input.
  if ((page.manual && elapsedMs >= 6000) || (page.challenge && elapsedMs >= 25000)) return 'interactive';
  return 'background';
}

// Fixed app-owned DOM extraction, never evaluates source-supplied JavaScript.
export function snapshotScript(selector: string) {
  return `(() => {
    const found = !!document.querySelector(${JSON.stringify(selector)});
    const text = document.body?.innerText.slice(0,3000)||'';
    const visible = node => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none';
    const input = Array.from(document.querySelectorAll('input[name*="captcha" i],input[id*="captcha" i],input[name*="verify" i],input[autocomplete="one-time-code"]')).some(visible);
    const frame = Array.from(document.querySelectorAll('iframe[src*="challenges.cloudflare.com"],iframe[src*="recaptcha"],iframe[src*="hcaptcha"],.cf-turnstile')).some(visible);
    const manual = input || (frame && /verify you are human|confirm you are human|验证您是真人|确认您是真人|请完成.*验证|请.*点击|我不是机器人/i.test(text));
    const challenge = manual || /Just a moment|Attention Required|验证码|搜索验证|人机验证/i.test(document.title);
    return {url:location.href,title:document.title,found,text,manual,challenge,html:document.documentElement.outerHTML};
  })()`;
}
