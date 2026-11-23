import { parseSourceImport } from './management';

export const XIU2_SOURCE_URL = 'https://yuedu.xiu2.xyz/shuyuan';
const MAX_SIZE = 10 * 1024 * 1024;

export async function downloadSourceJson(input: string, signal?: AbortSignal) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('请输入完整的 HTTP 或 HTTPS 书源 JSON 地址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请使用不含账号密码的 HTTP 或 HTTPS 地址。');
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel);
  const timer = setTimeout(() => { timedOut = true; cancel(); }, 25000);
  try {
    // Source headers/cookies are data; never send them when downloading a source list.
    const response = await fetch(url.toString(), { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}），请检查链接或稍后重试。`);
    if (Number(response.headers.get('content-length')) > MAX_SIZE) throw new Error('书源文件超过 10 MB，请拆分后导入。');
    const text = await response.text();
    if (text.length > MAX_SIZE) throw new Error('书源文件超过 10 MB，请拆分后导入。');
    return { text, sources: parseSourceImport(text) };
  } catch (cause) {
    if (timedOut) throw new Error('下载超时，请重试或下载 JSON 文件后本地导入。');
    if (signal?.aborted) throw new Error('已取消下载。');
    if (cause instanceof TypeError) throw new Error('无法下载书源，请检查网络。网页版还可能受网站跨域限制，可下载 JSON 文件后本地导入。');
    throw cause;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
