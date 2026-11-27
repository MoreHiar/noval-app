const ORIGIN = 'https://hongguoduanju.com';
const SERIES_ID = /^\d{6,30}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{8,80}$/;

export type Drama = {
  id: string;
  title: string;
  cover: string;
  summary: string;
  category: string;
  episodeCount: number;
};

export type DramaEpisode = { id: string; number: number };
export type DramaDetail = Drama & { episodes: DramaEpisode[]; accessibleCount: number | null };
export type DramaSearchPage = { items: Drama[]; page: number; hasMore: boolean };
export type DramaPreview = { url: string; previewOnly: boolean };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }

function image(value: unknown): string {
  const url = text(value);
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : '';
  } catch { return ''; }
}

function dramaFrom(value: unknown): Drama | null {
  const row = record(value);
  if (!row) return null;
  const id = text(row.series_id);
  const title = text(row.series_title) || text(row.series_name);
  if (!SERIES_ID.test(id) || !title) return null;
  const categories = Array.isArray(row.category_list) ? row.category_list : [];
  return {
    id, title,
    cover: image(row.series_cover),
    summary: text(row.series_intro),
    category: categories.map(item => text(record(item)?.name)).filter(Boolean).slice(0, 2).join(' · '),
    episodeCount: Math.max(0, Number(row.episode_cnt) || 0),
  };
}

function unique(items: (Drama | null)[]): Drama[] {
  const seen = new Set<string>();
  return items.filter((item): item is Drama => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function parseRouterData(html: string): Record<string, unknown> {
  const match = /(?:window\.)?_ROUTER_DATA\s*=\s*\{/.exec(html);
  if (!match || match.index === undefined) throw new Error('页面没有返回短剧数据');
  const start = match.index + match[0].length - 1;
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < html.length; index++) {
    const char = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      const parsed = record(JSON.parse(html.slice(start, index + 1)));
      if (parsed) return parsed;
      break;
    }
  }
  throw new Error('页面短剧数据不完整');
}

export function parseDiscover(html: string): Drama[] {
  const page = record(record(parseRouterData(html).loaderData)?.page);
  if (!page || page.isSuccess === false) throw new Error('短剧推荐暂时不可用');
  const sections = Array.isArray(page.homeSections) ? page.homeSections : [];
  const all = sections.find(section => record(section)?.tab_type === 'all');
  const rows = record(all)?.video_list;
  if (!Array.isArray(rows)) throw new Error('短剧推荐格式已变化');
  return unique(rows.map(dramaFrom));
}

export function parseSearch(payload: unknown, page: number): DramaSearchPage {
  const result = record(payload);
  if (!result || !Array.isArray(result.searchList)) throw new Error('短剧搜索格式已变化');
  const items = unique(result.searchList.map((entry: unknown) => {
    const row = record(entry);
    return dramaFrom(record(row?.video_data) ?? row);
  }));
  return { items, page, hasMore: result.hasMore === true && items.length > 0 };
}

export function parseDetail(html: string, requestedId: string): DramaDetail {
  const loaders = record(parseRouterData(html).loaderData);
  const page = record(loaders?.detail_page) ?? record(loaders?.['player_(series_id)/page']);
  const row = record(page?.seriesDetail);
  const drama = dramaFrom(row);
  if (!drama || drama.id !== requestedId || page?.isSuccess === false) throw new Error('短剧详情与请求不匹配');
  if (!Array.isArray(row?.vid_list)) throw new Error('短剧目录格式已变化');
  const vids = row.vid_list.map(text);
  if (!vids.length || vids.some(id => !VIDEO_ID.test(id)) || new Set(vids).size !== vids.length) {
    throw new Error('短剧目录数据无效');
  }
  const count = Number(row.accessible_episode_cnt);
  return {
    ...drama,
    episodeCount: Math.max(drama.episodeCount, vids.length),
    episodes: vids.map((id, index) => ({ id, number: index + 1 })),
    accessibleCount: row.accessible_episode_cnt == null || !Number.isInteger(count) ? null : Math.max(0, Math.min(count, vids.length)),
  };
}

export function parsePreview(html: string, seriesId: string, videoId: string): DramaPreview {
  const loaders = record(parseRouterData(html).loaderData);
  const page = record(loaders?.['player_(series_id)/(vid)/page']);
  const seo = record(page?.publicVideoSeo);
  if (!page || page.isSuccess === false || text(page.series_id) !== seriesId || text(page.vid) !== videoId ||
      seo?.available !== true || text(seo.seriesId) !== seriesId || text(seo.itemId) !== videoId) {
    throw new Error('当前集没有可用的公开预览');
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    let video: Record<string, unknown> | null = null;
    try { video = record(JSON.parse(script[2])); } catch { continue; }
    if (video?.['@type'] !== 'VideoObject') continue;
    const url = image(video.contentUrl);
    try {
      const parsed = new URL(url);
      const expected = `/video/public/${videoId}/`;
      if (parsed.origin === ORIGIN && parsed.pathname.startsWith(expected) && parsed.pathname.endsWith('.mp4') &&
          text(video.url) === `${ORIGIN}/player/${seriesId}/${videoId}`) {
        return { url, previewOnly: page.protectedPlayback === true };
      }
    } catch { /* Ignore unrelated structured data. */ }
  }
  throw new Error('当前集没有可播放的公开预览');
}

async function get(path: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(`${ORIGIN}${path}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: `${ORIGIN}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) throw new Error(`红果请求失败（HTTP ${response.status}）`);
    return response;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function discoverDramas(signal?: AbortSignal): Promise<Drama[]> {
  return parseDiscover(await (await get('/', signal)).text());
}

export async function searchDramas(query: string, page = 1, signal?: AbortSignal): Promise<DramaSearchPage> {
  const keyword = query.trim();
  if (!keyword || keyword.length > 80) throw new Error('请输入 1 至 80 字的剧名或演员');
  if (!Number.isInteger(page) || page < 1 || page > 50) throw new Error('搜索页码无效');
  const params = new URLSearchParams({ aid: '8662', query: keyword, page: String(page) });
  return parseSearch(await (await get(`/api/search/result?${params}`, signal)).json(), page);
}

export async function getDrama(seriesId: string, signal?: AbortSignal): Promise<DramaDetail> {
  if (!SERIES_ID.test(seriesId)) throw new Error('短剧编号无效');
  return parseDetail(await (await get(`/detail?series_id=${seriesId}`, signal)).text(), seriesId);
}

export async function getDramaPreview(seriesId: string, videoId: string, signal?: AbortSignal): Promise<DramaPreview> {
  if (!SERIES_ID.test(seriesId) || !VIDEO_ID.test(videoId)) throw new Error('剧集编号无效');
  return parsePreview(await (await get(`/player/${seriesId}/${videoId}`, signal)).text(), seriesId, videoId);
}
