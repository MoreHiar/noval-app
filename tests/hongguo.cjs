const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(result.outputText, filename);
};

const { parseDiscover, parseSearch, parseDetail, parsePreview } = require('../src/dramas/hongguo.ts');
const id = '7703109492040272921';
const vid = 'v1_LT3aQba_O_qfWJm5yb8sXH-KIKI';
const otherVid = 'v1_PNFCZ-o8upgsLsrllUwEeHN2uOQ';
const series = { series_id: id, series_name: '测试短剧', series_title: '测试短剧', episode_cnt: 20, vid_list: [vid, otherVid], accessible_episode_cnt: 2 };
const router = value => `<script>_ROUTER_DATA = ${JSON.stringify({ loaderData: value })};</script>`;

test('home, search and detail keep the requested series and its public episode list', () => {
  const home = router({ page: { isSuccess: true, homeSections: [{ tab_type: 'all', video_list: [series, series, { ...series, series_id: 'bad' }] }] } });
  assert.deepEqual(parseDiscover(home).map(item => item.id), [id]);
  assert.deepEqual(parseSearch({ searchList: [{ video_data: series }], hasMore: true }, 1).items.map(item => item.id), [id]);
  const detail = parseDetail(router({ detail_page: { isSuccess: true, seriesDetail: series } }), id);
  assert.equal(detail.episodeCount, 20);
  assert.deepEqual(detail.episodes.map(item => item.id), [vid, otherVid]);
  assert.throws(() => parseDetail(router({ detail_page: { isSuccess: true, seriesDetail: series } }), '7700000000000000000'), /不匹配/);
});

test('preview accepts only the current episode media and preserves its preview status', () => {
  const page = { isSuccess: true, series_id: id, vid, protectedPlayback: true, publicVideoSeo: { available: true, seriesId: id, itemId: vid } };
  const video = { '@type': 'VideoObject', url: `https://hongguoduanju.com/player/${id}/${vid}`, contentUrl: `https://hongguoduanju.com/video/public/${vid}/360p.mp4` };
  const html = `${router({ 'player_(series_id)/(vid)/page': page })}<script type="application/ld+json">${JSON.stringify(video)}</script>`;
  assert.deepEqual(parsePreview(html, id, vid), { url: video.contentUrl, previewOnly: true });
  assert.throws(() => parsePreview(html, id, otherVid), /没有可用/);
  assert.throws(() => parsePreview(html.replace('hongguoduanju.com/video/public', 'evil.example/video/public'), id, vid), /没有可播放/);
});
