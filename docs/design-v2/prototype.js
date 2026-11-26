/* Standalone discussion prototype. All content and changes stay inside this page. */
(() => {
  'use strict';
  const pages = [
    { id: 'shelf', title: '书架', note: '一个书架，收下两种故事。', copy: '类型筛选和每本书的标签同时出现，混合收藏时也能快速识别。', points: [['全部为默认入口', '混合内容默认列表视图；在单一类型中仍可切换立体浏览。'], ['保留原有收藏路径', '从收藏进入详情，移出书架仍在详情和列表中可达。']], states: [['default', '全部'], ['novels', '只看小说'], ['manga', '只看漫画'], ['empty', '空筛选']] },
    { id: 'novels', title: '小说', note: '推荐来自可用的小说书源。', copy: '首个已启用且发现规则可运行的文本源决定推荐内容。', points: [['无规则时诚实呈现', '当前内置书源没有已接通的发现流程，因此初始画板展示空状态。'], ['有源后的排版', '另一状态展示推荐源、头部推荐和列表；书名内容仅用于评审布局。']], states: [['default', '无推荐规则'], ['populated', '有推荐示意']] },
    { id: 'comics', title: '漫画', note: '让画面成为第一眼。', copy: '漫画源尚未接入，默认状态提供明确的管理入口。', points: [['来源清楚', '推荐区标出当前图片书源；不把未知首页直接抓取为推荐。'], ['封面优先', '有源时使用更大的图像区域，同时保留标题、作者和来源。']], states: [['default', '待接入漫画源'], ['populated', '有推荐示意']] },
    { id: 'search', title: '搜索', note: '搜索框固定，结果自由滚动。', copy: '新进入清空关键词；从详情返回保留输入、结果和滚动位置。', points: [['范围随入口变化', '书架为全部，小说和漫画为对应类型；搜索页可再切换。'], ['历史可复用', '点击历史立即搜索；单条删除和全部清空位于历史区。']], states: [['idle', '搜索历史'], ['results', '搜索结果'], ['empty', '无结果']] },
    { id: 'profile', title: '我的', note: '书源管理有固定位置。', copy: '保留阅读统计与外观设置，在设置区域加入清晰的书源管理行。', points: [['固定入口', '书源管理不用藏在更多菜单或临时按钮里。'], ['统计跟随内容', '正式应用需分别统计小说、漫画和启用书源，示意数字不代表当前数据。']], states: [['default', '我的阅读']] },
    { id: 'sources', title: '书源管理', note: '一种管理页，两类书源。', copy: '从“我的”进入后继续使用现有导入、编辑、启停和删除流程。', points: [['类型清晰', '文本和图片书源分别标识，便于判断小说与漫画推荐的候选源。'], ['能力真实', '“含发现规则”只表示配置字段存在，不能宣称解析已经可用。']], states: [['default', '书源列表']] },
    { id: 'novel-detail', title: '小说详情', note: '从搜索回到原处。', copy: '详情结构沿用 V1；从搜索进入时，返回后恢复关键词和结果位置。', points: [['保持阅读路径', '简介、收藏、目录和继续阅读仍按 V1 布局。'], ['返回状态', '书架或小说页进入详情，也会返回各自的入口页面。']], states: [['default', '小说详情']] },
    { id: 'comic-detail', title: '漫画详情', note: '先了解，再开始阅读。', copy: '漫画详情沿用小说详情的信息层级，目录按话展示。', points: [['收藏明确', '加入书架后显示“漫画”标签，读者能从书架筛选找到。'], ['阅读入口', '实际图片页解析尚需真实漫画源验证；这里只展示预期页面形态。']], states: [['default', '漫画详情']] },
    { id: 'comic-reader', title: '漫画阅读', note: '让画面自然向下流动。', copy: '纵向连续图片为初版阅读方向。', points: [['图片按需加载', '正式实现要避免一次挂载整章所有高分辨率图片。'], ['进度留在本机', '章节和图片位置的恢复策略需用真实源验证。']], states: [['default', '纵向阅读']] },
  ];
  const params = new URLSearchParams(location.search);
  let current = pages.some(p => p.id === params.get('screen')) ? params.get('screen') : 'shelf';
  let variant = params.get('state') || (current === 'search' ? 'idle' : 'default');
  let shelfView = 'list';
  let searchScope = 'all';
  let selectedSearchSource = '全部已启用书源';
  let sourcePickerOpen = false;
  let query = variant === 'results' ? '万相之王' : '';
  let searchState = variant === 'results' ? 'results' : variant === 'empty' ? 'empty' : 'idle';
  let searchHistory = ['万相之王', '剑来'];
  let searchScroll = 0;
  let searchOrigin = 'shelf';
  let searchOriginVariant = 'default';
  let previousScreen = 'shelf';
  let previousVariant = 'default';
  let sourceEnabled = true;
  let searchTimer;
  let messageTimer;
  const app = document.querySelector('#app');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  if (params.get('embed') === '1') document.body.classList.add('embedded');

  const tabbar = active => `<nav class="tabbar" aria-label="底部导航">${[['shelf', '▥', '书架'], ['novels', '▤', '小说'], ['comics', '▣', '漫画'], ['profile', '♙', '我的']].map(([id, symbol, label]) => `<button data-go="${id}" class="${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}><span class="symbol ${id === 'comics' ? 'comic' : ''}" aria-hidden="true">${symbol}</span><span>${label}</span></button>`).join('')}</nav>`;
  const head = (title, kicker, action = '') => `<header class="page-head"><div><p>${kicker}</p><h1>${title}</h1></div>${action}</header>`;
  const searchEntry = scope => `<button class="search-entry" data-search-entry="${scope}" aria-label="进入搜索"><span class="magnify" aria-hidden="true">⌕</span><span>${scope === 'comics' ? '搜索漫画名称或作者' : scope === 'novels' ? '搜索小说名称或作者' : '搜索书名或作者'}</span><span class="shortcut">搜索</span></button>`;
  const cover = (title, type = 'novel', large = false) => `<div class="cover ${type} ${large ? 'large' : ''}" aria-label="${esc(title)}示意封面"><small>NOVAL / STORIES</small><strong>${esc(title)}</strong><i>${type === 'manga' ? 'COMIC' : 'NOVEL'}</i></div>`;
  const tag = type => `<span class="tag ${type === 'manga' ? 'manga' : ''}">${type === 'manga' ? '漫画' : '小说'}</span>`;
  const row = (title, author, type = 'novel', source = '示例书源') => `<button class="book-row" data-detail="${type}" aria-label="查看${esc(title)}"><span>${cover(title, type)}</span><span class="book-copy"><h3>${esc(title)}</h3><p>${esc(author)} · ${type === 'manga' ? '连载中' : '玄幻'}</p><span class="meta">${tag(type)}<span class="source-name">${esc(source)}</span></span></span><span class="chevron" aria-hidden="true">›</span></button>`;
  const empty = (symbol, title, copy, action = '') => `<div class="empty-state"><div class="empty-symbol" aria-hidden="true">${symbol}</div><h2>${title}</h2><p>${copy}</p>${action}</div>`;
  const sourceStrip = (kind, name) => `<div class="source-strip"><span class="source-avatar">${kind === 'comics' ? '漫' : '文'}</span><div><strong>${name}</strong><small>${kind === 'comics' ? '图片' : '文本'}书源 · 推荐来源</small></div><button data-go="sources">管理 ›</button></div>`;

  function shelf() {
    const filter = variant === 'novels' ? 'novels' : variant === 'manga' ? 'manga' : 'all';
    const filterNames = { all: '全部', novels: '小说', manga: '漫画' };
    let content = '';
    if (variant === 'empty') content = empty('▥', '这里还没有收藏', '找到喜欢的作品后，<br>可从详情页加入书架。', '<button class="primary" data-search-entry="all">去搜索</button>');
    else if (shelfView === 'carousel') content = `<div class="shelf-hero">${cover(filter === 'manga' ? '星海来信' : '剑来', filter === 'manga' ? 'manga' : 'novel')}${cover(filter === 'manga' ? '海风日记' : '万相之王', filter === 'manga' ? 'manga' : 'novel')}${cover(filter === 'novels' ? '长夜余火' : '星海来信', filter === 'novels' ? 'novel' : 'manga')}</div><div class="shelf-caption">${tag(filter === 'manga' ? 'manga' : 'novel')}<h2>${filter === 'manga' ? '海风日记' : '万相之王'}</h2><p>${filter === 'manga' ? '示例漫画书源' : '甲骨文小说'}</p><button class="primary full" style="margin-top:20px" data-detail="${filter === 'manga' ? 'manga' : 'novel'}">查看作品 →</button></div>`;
    else content = `${filter !== 'manga' ? row('万相之王', '天蚕土豆', 'novel', '甲骨文小说') + row('剑来', '烽火戏诸侯', 'novel', '笔趣阁349') : ''}${filter !== 'novels' ? row('海风日记', '示例作者', 'manga', '示例漫画书源') + row('星海来信', '示例作者', 'manga', '示例漫画书源') : ''}`;
    const tools = variant === 'empty' ? '' : `<div class="shelf-tools"><p>${filterNames[filter]}收藏 · ${filter === 'all' ? 4 : 2} 本</p><div class="view-toggle" role="group" aria-label="书架视图"><button class="${shelfView === 'list' ? 'active' : ''}" data-view="list" aria-label="列表视图" aria-pressed="${shelfView === 'list'}">☷</button><button class="${shelfView === 'carousel' ? 'active' : ''}" data-view="carousel" aria-label="立体视图" aria-pressed="${shelfView === 'carousel'}">▥</button></div></div>`;
    return `<section class="screen">${head('我的书架', 'NOVAL / 把故事带在身边', '<button class="icon-button" data-search-entry="all" aria-label="搜索">⌕</button>')}<div class="segmented" role="group" aria-label="收藏类型">${[['all','全部'],['novels','小说'],['manga','漫画']].map(([id,label])=>`<button data-filter="${id}" class="${filter===id?'active':''}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>${tools}${content}</section>${tabbar('shelf')}`;
  }
  function category(kind) {
    const isComic = kind === 'comics';
    const title = isComic ? '漫画' : '小说';
    const populated = variant === 'populated';
    const source = isComic ? '示例漫画书源' : '示例小说书源';
    const main = populated ? `${sourceStrip(kind, source)}<div class="section-title"><h2>为你发现</h2><span>来自当前书源</span></div>${isComic ? '<div class="manga-lead"><button class="manga-banner" data-detail="manga" aria-label="查看海风日记"><span>COMIC / FEATURED</span><strong>海风日记</strong></button><h3>海风日记</h3><p>示例作者 · 连载中</p></div>' : `<button class="recommend-lead" data-detail="novel">${cover('万相之王', 'novel')}<span class="book-copy">${tag('novel')}<h3>万相之王</h3><p>天蚕土豆 · 玄幻<br>从一次意外，走向更广阔的天地。</p></span></button>`}<div class="section-title"><h2>继续发现</h2><span>更新于当前书源</span></div>${isComic ? row('星海来信','示例作者','manga',source)+row('雾中旅人','示例作者','manga',source) : row('剑来','烽火戏诸侯','novel',source)+row('长夜余火','爱潜水的乌贼','novel',source)}` : `${sourceStrip(kind, isComic ? '暂无已启用的漫画书源' : '暂无可用的推荐源')}${empty(isComic ? '▣' : '▤', isComic ? '漫画书源，等待加入' : '暂时没有小说推荐', isComic ? '添加并启用图片书源后，<br>这里将展示可读取的发现内容。' : '当前书源尚无可运行的发现规则。<br>搜索仍可照常使用。', '<button class="secondary" data-go="sources">管理书源</button>')}`;
    return `<section class="screen">${head(title, isComic ? '画面里的另一种旅程' : '把下一本好书，放在眼前')}${searchEntry(kind)}${main}</section>${tabbar(kind)}`;
  }
  function search() {
    const options = [['all','全部'],['novels','小说'],['comics','漫画']];
    const sourceOptions = ['全部已启用书源', ...(searchScope !== 'comics' ? ['甲骨文小说', '笔趣阁349'] : []), ...(searchScope !== 'novels' ? ['示例漫画书源'] : [])];
    const availableResults = [
      { title: '万相之王', author: '天蚕土豆', type: 'novel', source: '甲骨文小说' },
      { title: '剑来', author: '烽火戏诸侯', type: 'novel', source: '笔趣阁349' },
      { title: '海风日记', author: '示例作者', type: 'manga', source: '示例漫画书源' },
    ].filter(item => (searchScope === 'all' || (searchScope === 'novels' ? item.type === 'novel' : item.type === 'manga')) && (selectedSearchSource === '全部已启用书源' || item.source === selectedSearchSource));
    const input = `<header class="search-fixed"><form id="search-form"><div class="search-top"><button type="button" class="back-button" data-back aria-label="返回">‹</button><div class="search-input-wrap"><span aria-hidden="true">⌕</span><input id="search-query" type="search" value="${esc(query)}" placeholder="搜索书名或作者" aria-label="搜索书名或作者" autocomplete="off"><button type="button" data-clear-query aria-label="清空搜索">×</button></div></div></form><div class="search-filters" role="group" aria-label="搜索类型">${options.map(([id,label])=>`<button data-scope="${id}" class="${searchScope===id?'active':''}" aria-pressed="${searchScope===id}">${label}</button>`).join('')}</div></header>`;
    let body;
    if (searchState === 'idle') body = `<div class="history-head"><h2>最近搜索</h2>${searchHistory.length ? '<button data-clear-history>清空全部</button>' : ''}</div>${searchHistory.length ? searchHistory.map((item, index)=>`<div class="history-row"><button data-history="${index}">◷　${esc(item)}</button><button data-delete-history="${index}" aria-label="删除${esc(item)}">×</button></div>`).join('') : empty('⌕','还没有搜索记录','输入书名或作者开始寻找。')}`;
    else if (searchState === 'empty') body = `${empty('⌕','没有找到相关作品','试试更短的关键词，或切换小说、漫画范围。','<button class="secondary" data-clear-query>重新输入</button>')}`;
    else body = `<p class="search-summary">找到 ${availableResults.length} 本作品 · 搜索结果</p><button class="search-status" data-status>各书源搜索情况 <span>⌄</span></button>${availableResults.map(item => row(item.title,item.author,item.type,item.source)).join('')}`;
    const picker = sourcePickerOpen ? `<div class="picker-backdrop"><button class="picker-shade" data-close-picker aria-label="关闭书源选择"></button><div class="picker-sheet" role="dialog" aria-modal="true" aria-label="选择搜索书源"><div class="picker-head"><h2>选择搜索书源</h2><button data-close-picker aria-label="关闭">×</button></div>${sourceOptions.map((name,index)=>`<button class="picker-option" data-pick-source="${index}"><span>${name}</span><span>${selectedSearchSource === name ? '✓' : ''}</span></button>`).join('')}</div></div>` : '';
    return `<div class="search-page">${input}<div class="search-results"><button class="source-selector" data-source-picker>▦　${esc(selectedSearchSource)} <span>⌄</span></button>${body}</div>${picker}</div>`;
  }
  function profile() {
    return `<section class="screen">${head('我的阅读','给自己，留一点阅读的时间')}<div class="profile-banner"><span>“</span><h2>让故事，<br>慢慢发生。</h2><p>小说与漫画，都在你的阅读空间。</p></div><div class="stats"><div><strong>4</strong><span>书架收藏</span></div><div><strong>1</strong><span>已启用书源</span></div></div><div class="settings-group"><h2>阅读与内容</h2><button class="setting-row" data-go="sources"><span class="setting-icon">▦</span><span class="setting-copy"><strong>书源管理</strong><small>导入、启停与编辑小说和漫画书源</small></span><span class="chevron">›</span></button><div class="setting-row"><span class="setting-icon">▣</span><span class="setting-copy"><strong>本机阅读进度</strong><small>打开作品即可继续阅读</small></span></div></div><div class="settings-group"><h2>外观</h2><button class="setting-row" data-message="外观设置沿用 V1"><span class="setting-icon">◐</span><span class="setting-copy"><strong>跟随系统</strong><small>浅色、深色模式在正式应用中保留</small></span><span class="chevron">›</span></button></div></section>${tabbar('profile')}`;
  }
  function sources() {
    return `<section class="screen"><div class="detail-top"><button data-go="profile" aria-label="返回我的">‹</button><span>我的</span></div>${head('书源管理','让故事，有处可寻')}<div class="source-summary"><div><strong>${sourceEnabled ? 1 : 0}</strong> 个书源已启用<p>小说 1 · 漫画 0</p></div><span style="font-size:25px;color:var(--green)">▦</span></div><div style="display:flex;gap:9px"><button class="primary" style="flex:1" data-message="导入流程沿用 V1">导入书源</button><button class="secondary" data-message="新增流程沿用 V1">＋ 新增</button></div><div class="section-title"><h2>已添加书源</h2><span>按添加顺序</span></div><article class="source-card"><div class="source-card-head"><span class="source-avatar">甲</span><div><strong>甲骨文小说</strong><small>www.jgwxs.com</small></div><button class="switch ${sourceEnabled?'':'off'}" data-toggle-source role="switch" aria-checked="${sourceEnabled}" aria-label="启用甲骨文小说"></button></div><span class="tag">文本书源</span><p>无可运行的发现入口 · ${sourceEnabled?'已启用':'已停用'}</p><div class="source-card-actions"><button data-message="编辑流程沿用 V1">编辑</button><button data-message="导出流程沿用 V1">导出</button><button data-message="删除流程沿用 V1">删除</button></div></article><div class="quiet-note">漫画推荐需添加图片书源，并验证其发现规则可运行。</div></section>`;
  }
  function detail() {
    const comic = current === 'comic-detail';
    return `<section class="screen"><div class="detail-top"><button data-back-detail aria-label="返回">‹</button><span>${comic?'漫画':'小说'}详情</span></div><div class="detail-head">${cover(comic?'海风日记':'万相之王',comic?'manga':'novel',true)}<div><h1>${comic?'海风日记':'万相之王'}</h1><p>${comic?'示例作者':'天蚕土豆'} 著</p>${tag(comic?'manga':'novel')}<p>来源：${comic?'示例漫画书源':'甲骨文小说'}</p></div></div><section class="detail-section"><h2>内容简介</h2><p>${comic?'沿着海岸线，一封未寄出的信带来新的旅程。风吹过小镇，也吹动了迟迟没有说出口的话。':'天地间有万相。李洛在新的旅途中，一步步走向更广阔的天地。'}</p></section><div class="detail-actions"><button class="primary" ${comic?'data-go="comic-reader"':'data-message="小说阅读器沿用 V1"'}>${comic?'开始阅读':'继续阅读'} →</button><button class="secondary" data-message="收藏状态为设计示意">加入书架</button></div><section class="detail-section"><h2>${comic?'漫画目录':'章节目录'}</h2>${[1,2,3,4,5].map(i=>`<button class="chapter-row" ${comic?'data-go="comic-reader"':'data-message="小说阅读器沿用 V1"'}><span>${String(i).padStart(2,'0')}</span><span>第 ${i} ${comic?'话':'章'}　${['海边的信','再见之前','风的方向','远方来客','新的日子'][i-1]}</span><span>›</span></button>`).join('')}</section></section>`;
  }
  function comicReader() {
    return `<div class="comic-reader"><div class="reader-bar"><button data-go="comic-detail" aria-label="返回漫画详情">‹</button><span>海风日记 · 第 1 话</span><small>1 / 12</small></div><div class="comic-pages"><div class="comic-panel scene-one"><span>01 / 12</span></div><div class="comic-panel scene-two"><span>02 / 12</span></div><div class="comic-panel scene-three"><span>03 / 12</span></div></div><div class="reader-bottom"><button data-message="已是第一话">上一话</button><button data-message="目录设计待真实书源验证">目录 · 第 1 话</button><button data-message="下一话为设计示意">下一话 ›</button></div></div>`;
  }

  function render() {
    const page = pages.find(item => item.id === current);
    document.querySelector('#page-nav').innerHTML = pages.map((item,i)=>`<button class="nav-item ${current===item.id?'active':''}" data-go="${item.id}"><span>${String(i+1).padStart(2,'0')}</span>${item.title}</button>`).join('');
    document.querySelector('#screen-index').textContent = String(pages.indexOf(page)+1).padStart(2,'0');
    document.querySelector('#screen-label').textContent = page.title;
    document.querySelector('#note-title').textContent = page.note;
    document.querySelector('#note-copy').textContent = page.copy;
    document.querySelector('#note-list').innerHTML = page.points.map(([title,copy])=>`<div class="note-item"><strong>${title}</strong><p>${copy}</p></div>`).join('');
    document.querySelector('#state-options').innerHTML = page.states.map(([id,label])=>`<button data-state="${id}" class="${variant===id?'active':''}">${label}</button>`).join('');
    app.innerHTML = current === 'shelf' ? shelf() : current === 'novels' || current === 'comics' ? category(current) : current === 'search' ? search() : current === 'profile' ? profile() : current === 'sources' ? sources() : current === 'comic-reader' ? comicReader() : detail();
    if (current === 'search') app.querySelector('.search-results').scrollTop = searchScroll;
  }
  function go(next, state = 'default') {
    if (current === 'search') searchScroll = app.querySelector('.search-results')?.scrollTop || 0;
    current = next;
    variant = next === 'search' ? searchState : state;
    render();
  }
  function enterSearch(scope) {
    searchOrigin = current;
    searchOriginVariant = variant;
    searchScope = scope;
    selectedSearchSource = '全部已启用书源';
    sourcePickerOpen = false;
    query = '';
    searchState = 'idle';
    searchScroll = 0;
    go('search', 'idle');
    if (params.get('embed') !== '1') app.querySelector('#search-query')?.focus();
  }
  function runSearch(value) {
    query = value.trim();
    searchState = query ? (query.includes('不存在') ? 'empty' : 'results') : 'idle';
    variant = searchState;
    if (query) searchHistory = [query, ...searchHistory.filter(item=>item!==query)].slice(0,20);
    searchScroll = 0;
    render();
  }
  function toast(message) {
    clearTimeout(messageTimer);
    app.querySelector('.toast')?.remove();
    app.insertAdjacentHTML('beforeend',`<div class="toast" role="status">${esc(message)}</div>`);
    messageTimer = setTimeout(()=>app.querySelector('.toast')?.remove(),2200);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.searchEntry) return enterSearch(button.dataset.searchEntry);
    if (button.dataset.go) return go(button.dataset.go);
    if (button.dataset.state) { variant = button.dataset.state; if (current === 'search') { searchState = variant; query = variant === 'results' ? '万相之王' : ''; searchScroll = 0; } render(); return; }
    if (button.dataset.filter) { variant = button.dataset.filter === 'all' ? 'default' : button.dataset.filter; shelfView = 'list'; render(); return; }
    if (button.dataset.view) { shelfView = button.dataset.view; render(); return; }
    if (button.dataset.scope) { searchScope = button.dataset.scope; selectedSearchSource = '全部已启用书源'; searchScroll = 0; render(); return; }
    if (button.hasAttribute('data-source-picker')) { sourcePickerOpen = true; render(); return; }
    if (button.hasAttribute('data-close-picker')) { sourcePickerOpen = false; render(); return; }
    if (button.dataset.pickSource !== undefined) { selectedSearchSource = ['全部已启用书源', ...(searchScope !== 'comics' ? ['甲骨文小说', '笔趣阁349'] : []), ...(searchScope !== 'novels' ? ['示例漫画书源'] : [])][Number(button.dataset.pickSource)]; sourcePickerOpen = false; render(); return; }
    if (button.dataset.detail) { previousScreen = current; previousVariant = variant; go(button.dataset.detail === 'manga' ? 'comic-detail' : 'novel-detail'); return; }
    if (button.hasAttribute('data-back-detail')) return go(previousScreen, previousVariant);
    if (button.hasAttribute('data-back')) return go(searchOrigin, searchOriginVariant);
    if (button.hasAttribute('data-clear-query')) { query = ''; searchState = 'idle'; variant = 'idle'; searchScroll = 0; render(); app.querySelector('#search-query')?.focus(); return; }
    if (button.dataset.history !== undefined) return runSearch(searchHistory[Number(button.dataset.history)]);
    if (button.dataset.deleteHistory !== undefined) { searchHistory.splice(Number(button.dataset.deleteHistory),1); render(); return; }
    if (button.hasAttribute('data-clear-history')) { searchHistory=[]; render(); return; }
    if (button.hasAttribute('data-toggle-source')) { sourceEnabled=!sourceEnabled; render(); return; }
    if (button.dataset.message) return toast(button.dataset.message);
    if (button.hasAttribute('data-status')) return toast('逐源搜索状态沿用 V1，新增类型筛选');
  });
  document.addEventListener('input', event => {
    if (event.target.id !== 'search-query') return;
    clearTimeout(searchTimer);
    const value = event.target.value;
    query = value;
    searchTimer = setTimeout(()=>runSearch(value),350);
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'search-form') return;
    event.preventDefault();
    clearTimeout(searchTimer);
    runSearch(app.querySelector('#search-query').value);
  });
  render();
})();
