/* Standalone design prototype. All mutations affect demo data in memory only. */
(() => {
  'use strict';
  const paths = {
    shelf:'M4 4v16h16V4M8 7v10m4-10v10m3-10 3 10', search:'m20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    sources:'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z', profile:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
    list:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', carousel:'M8 4h8v16H8zM4 7v10M20 7v10',
    back:'m14 5-7 7 7 7', arrow:'M5 12h14m-5-5 5 5-5 5', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', close:'m6 6 12 12M6 18 18 6',
    check:'m5 12 4 4L19 6', more:'M4 12h.01M12 12h.01M20 12h.01', plus:'M12 5v14M5 12h14', refresh:'M20 7v5h-5M4 17v-5h5M19 12a7 7 0 0 0-12-5M5 12a7 7 0 0 0 12 5',
    bookmark:'M6 3h12v18l-6-4-6 4V3Zm3 6h6m-3-3v6', settings:'M4 6h16M4 12h16M4 18h16M9 3v6m6 0v6m-5 0v6',
    upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6', lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z', file:'M5 3h9l5 5v13H5V3m9 0v6h5M8 13h8m-8 4h6',
    warning:'M12 3 2 21h20L12 3Zm0 6v5m0 3h.01', leaf:'M20 3C9 2 3 6 4 13s9 10 13 3 3-13 3-13ZM5 20 16 9',
  };
  const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(paths[name] || '').split(/(?=M|m)/).length ? `<path d="${paths[name] || paths.file}"/>` : ''}</svg>`;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const books = [
    {title:'万相之王',author:'天蚕土豆',category:'玄幻',status:'连载中',source:'甲骨文小说',cover:'',summary:'天地间，有万相。而我李洛，终将成为这万相之王。在相力的世界里，一段关于成长与选择的故事，正缓缓展开。'},
    {title:'剑来',author:'烽火戏诸侯',category:'仙侠',status:'连载中',source:'笔趣阁349',cover:'cover-b',summary:'大千世界，无奇不有。小镇少年走过山水，也走向自己的天地。'},
    {title:'长夜余火',author:'爱潜水的乌贼',category:'科幻',status:'已完结',source:'甲骨文小说',cover:'cover-c',summary:'长夜之后，仍有余火。一个关于远行、相遇与希望的故事。'},
  ];
  const chapters = ['南风学府','不想退婚','李洛的空相','洛岚府','未来的路','第一堂课','相术','新的开始','风起南风','山间来信','旧日时光','远行'];
  const sources = [
    {name:'甲骨文小说',url:'www.jgwxs.com',group:'自定义',on:true},
    {name:'笔趣阁349',url:'www.bqg349.xyz',group:'玄幻 · 仙侠',on:true},
    {name:'哇塞文学',url:'www.washai.com',group:'自定义',on:false},
  ];
  const configs = [
    {id:'shelf',title:'书架',label:'书架 · 立体视图',note:'故事，随手可及。',intro:'保留书册的温度，也给常用操作清晰的位置。',items:[['两种熟悉的视图','立体浏览更有书卷感；列表便于快速查找。切换入口使用图标与选中底色。'],['从书架进入详情','书名、作者和状态集中展示。「查看书籍」进入现有详情，再按原有进度继续阅读。'],['让新用户有路可走','空书架只提供一个明确入口：搜索好书。移除操作使用弱化文字，避免干扰浏览。']],states:[['default','立体书架'],['list','列表视图'],['empty','空书架'],['error','加载失败']]},
    {id:'discover',title:'搜索',label:'搜索 · 结果列表',note:'少一点寻找，多一点发现。',intro:'聚焦书名与作者，让结果和搜索范围一眼可见。',items:[['搜索框就是起点','输入区固定在内容开头，书源选择紧随其后，键盘搜索与原有输入触发方式保持一致。'],['结果优先呈现','保留每条结果的书源标识，方便区分同名书；逐源响应情况放在折叠区域。'],['失败也能继续','区分未匹配、部分失败与全部失败，提供重新搜索和切换书源的现有入口。']],states:[['default','搜索结果'],['idle','未输入'],['loading','搜索中'],['empty','无结果'],['error','搜索失败']]},
    {id:'detail',title:'书籍详情',label:'详情 · 简介与目录',note:'了解一本书，再翻开它。',intro:'封面、内容与行动分层排布，减少开始阅读前的犹豫。',items:[['主要操作有主次','阅读使用墨绿实心按钮，收藏使用描边按钮；有进度时显示「继续阅读」。'],['目录状态清晰','在读章节显示文字标识，锁定章节明确标为未解锁。刷新与失败重试留在目录区域。'],['保留现有阅读路径','页面直接展示现有简介与章节列表，不引入评分、推荐、订阅或离线下载。']],states:[['default','已有进度'],['new','首次阅读'],['error','目录失败'],['loading','加载中']]},
    {id:'reader',title:'阅读器',label:'阅读 · 沉浸模式',note:'界面退后，故事向前。',intro:'正文留出呼吸感，工具只在需要的时候出现。',items:[['为长文留白','暖纸色底与深棕文字降低视觉刺激；正文在原有字号、行距范围内调整。'],['保持熟悉的翻页','点击左右区域翻页，中间区域唤出菜单。保留原有手势与章节导航。'],['即时调整并反馈','字号 14–30，行距三档，动画三种；只设计现有设置，不额外加入主题或亮度功能。']],states:[['default','纯净阅读'],['menu','阅读菜单'],['settings','阅读设置'],['chapters','章节目录'],['error','加载失败']]},
    {id:'sources',title:'书源管理',label:'书源 · 管理列表',note:'管理清晰，阅读轻松。',intro:'把日常开关放在眼前，把批量操作收进有标签的菜单。',items:[['常用入口前置','导入和新增保留在首屏，每个书源的启用开关、编辑和导出均直接可达。'],['批量操作集中','全部导出、全部启用、全部禁用及批量删除收纳在「更多」菜单，保留所有现有能力。'],['删除前看清影响','确认弹窗保留书架受影响数量说明。启用仅表达配置状态，不把它等同于可用性检测。']],states:[['default','书源列表'],['batch','批量选择'],['empty','无书源'],['delete','删除确认']]},
    {id:'import',title:'导入书源',label:'书源 · 导入与预览',note:'每一步，都心中有数。',intro:'网络、本地文件和粘贴三种现有方式，路径清楚，结果可预览。',items:[['输入到确认的顺序','输入地址 → 下载并预览 → 确认导入，不跳过现有校验与预览环节。'],['重复项说明直白','默认跳过重复源；开启覆盖前说明规则与启用状态会被替换。'],['导入不等于可阅读','用短句说明已有兼容边界，成功后展示新增、更新、跳过数量。']],states:[['default','网络导入'],['local','文件 / 粘贴'],['preview','预览重复项'],['success','导入完成'],['error','下载失败']]},
    {id:'edit',title:'新增 / 编辑书源',label:'书源 · 编辑表单',note:'清楚填写，安心保存。',intro:'让常规信息与规则配置形成清晰的阅读顺序。',items:[['标签始终可见','名称、地址、分组和说明使用持久标签；示例只在新增模式提供。'],['规则保留原貌','JSON 使用等宽字体，字段映射说明靠近编辑区域，所有原始配置继续保留。'],['错误留在操作附近','保存中禁用重复提交；校验失败保留输入。取消仍返回现有书源列表。']],states:[['default','编辑书源'],['new','新增书源'],['error','校验失败']]},
    {id:'profile',title:'我的阅读',label:'我的 · 阅读空间',note:'阅读，是自己的节奏。',intro:'一个安静的个人空间，只展示应用已有的信息。',items:[['轻量的情绪表达','用一句简短文案和克制的线条代替复杂装饰，不占用主要操作区域。'],['数字真实可解释','只保留书架藏书与已启用书源两个现有统计，不虚构阅读时长或连续打卡。'],['本地保存说明','明确进度保存在本机。此处不增加登录、云同步、备份或账户入口。']],states:[['default','我的阅读']]},
  ];
  const params = new URLSearchParams(location.search);
  let current = configs.some(c => c.id === params.get('screen')) ? params.get('screen') : 'shelf';
  let variant = 'default';
  let selectedBook = 0, shelfList = false, query = '万相之王', scope = '全部书源', sourceFilter = 'all', sourceQuery = '', shelfRemoved = false;
  let importMode = 'network', preview = false, imported = false, importingError = false, replace = false;
  let selectedSources = new Set([0]), batch = false, readerPanel = '', page = 1, chapter = 0, fontSize = 18, spacing = '适中', animation = '滑动';
  let onShelf = true, sourceEnabled = true, toastTimer, activeModal = '', sourceSelectionFilter = '', editingSourceIndex = 0, modalTrigger;
  let lastRendered = '';
  const fieldMemory = new Map();
  const retainedFields = '#source-url,#paste-json,#edit-name,#edit-url,#edit-group,#edit-description,#edit-json';
  const app = document.querySelector('#app');
  if (params.get('embed') === '1') document.body.classList.add('embedded');
  function cover(index = 0) {
    const book = books[index];
    return `<div class="book-cover ${book.cover}" aria-label="${book.title}示意封面"><span class="cover-top">NOVAL / STORIES</span><span class="cover-title">${book.title}</span><div class="cover-art"></div><span class="cover-author">${book.author} 著</span></div>`;
  }
  const iconButton = (name, action, label, surface = false) => `<button class="icon-button ${surface ? 'surface' : ''}" data-action="${action}" aria-label="${label}">${icon(name)}</button>`;
  function tabs(active) {
    return `<nav class="tabbar" aria-label="底部导航">${[['discover','search','搜索'],['shelf','shelf','书架'],['sources','sources','书源'],['profile','profile','我的']].map(([id, ico, label]) => `<button data-go="${id}" class="${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span></button>`).join('')}</nav>`;
  }
  const heading = (title, subtitle, extra = '') => `<header class="page-heading"><div><p class="kicker">${subtitle}</p><h1>${title}</h1></div>${extra}</header>`;
  const back = (label, target) => `<div class="top-nav">${iconButton('back',`go-${target}`,'返回')}<span>${label}</span></div>`;
  function bookRow(index, list = false) {
    const book = books[index];
    return `<div class="list-item"><button class="book-row ${list ? 'list-row' : ''}" data-book="${index}">${cover(index)}<div class="book-row-copy"><h3>${book.title}</h3><p>${book.author} · ${book.category}</p><p>${book.status}</p><span class="pill neutral">${book.source}</span></div>${list ? '' : icon('chevron')}</button>${list ? `<button class="list-remove" data-action="remove" aria-label="移除${book.title}">移除</button>` : ''}</div>`;
  }
  function empty(title, copy, ico = 'shelf', action = '') { return `<div class="empty-state"><div class="empty-mark">${icon(ico)}</div><h2>${title}</h2><p>${copy}</p>${action}</div>`; }
  function shelf() {
    let content;
    const book = books[selectedBook];
    if (variant === 'error') content = empty('书架暂时未能加载','请稍后重试，你的书籍会在加载后显示。','warning','<button class="secondary" data-action="retry">重新加载</button>');
    else if (variant === 'empty' || shelfRemoved) content = empty('下一段故事，等你发现','搜索喜欢的书名或作者，<br>在详情页将它加入书架。','shelf',`<button class="primary" data-go="discover">${icon('search')}搜索好书</button>`);
    else if (shelfList) content = `<div style="margin-top:12px">${books.map((_, i) => bookRow(i, true)).join('')}</div>`;
    else content = `<div class="shelf-scene"><button class="shelf-book left" data-action="previous-book" aria-label="上一本">${cover((selectedBook + 2) % 3)}</button><button class="shelf-book middle" data-book="${selectedBook}" aria-label="查看${book.title}">${cover(selectedBook)}</button><button class="shelf-book right" data-action="next-book" aria-label="下一本">${cover((selectedBook + 1) % 3)}</button></div><div class="carousel-pagination"><button data-action="previous-book" aria-label="上一本">‹</button><span class="dots">${books.map((_,i) => `<i class="${i === selectedBook ? 'active' : ''}"></i>`).join('')}</span><button data-action="next-book" aria-label="下一本">›</button></div><section class="featured"><span class="pill">${book.category} · ${book.status}</span><h3>${book.title}</h3><p class="caption">${book.author} 著</p><button class="primary full" data-book="${selectedBook}">查看书籍 ${icon('arrow')}</button><button class="remove-link" data-action="remove">移出书架</button></section>`;
    return `<section class="screen">${heading('我的书架','NOVAL / 把故事带在身边',`<button class="icon-button surface" data-go="discover" aria-label="搜索书籍">${icon('search')}</button>`)}<div class="shelf-intro"><div><h2>一书一世界</h2><p>全部书籍 · ${variant === 'empty' || shelfRemoved ? 0 : 3} 本</p></div><div class="view-toggle" aria-label="书架视图"><button data-action="carousel" class="${!shelfList ? 'active' : ''}" aria-label="立体视图" aria-pressed="${!shelfList}">${icon('carousel')}</button><button data-action="list" class="${shelfList ? 'active' : ''}" aria-label="列表视图" aria-pressed="${shelfList}">${icon('list')}</button></div></div>${content}</section>${tabs('shelf')}`;
  }
  function discover() {
    let content;
    if (variant === 'idle') content = empty('好故事，从这里开始','输入书名或作者，<br>从已启用的书源中寻找喜欢的书。','search');
    else if (variant === 'empty') content = empty('暂时没有找到这本书','试试缩短关键词，或选择其他书源。','search','<button class="secondary" data-action="pick-source">切换书源</button>');
    else if (variant === 'error') content = `<div class="alert">所选书源未能完成搜索。你可以查看书源返回的原因，再试一次。</div><details class="status-detail" open><summary>各书源搜索情况</summary><p>甲骨文小说：连接超时<br>笔趣阁349：未能获取搜索结果</p></details><button class="secondary full" data-action="search-retry">重新搜索</button>`;
    else content = `<div class="result-summary">${variant === 'loading' ? '已找到 1 本 · 正在搜索 1 / 2 个书源' : '找到 3 本 · 2 个书源有结果'}</div>${variant === 'loading' ? '<div class="search-progress" aria-label="正在搜索"></div>' : ''}<details class="status-detail"><summary>查看各书源搜索情况</summary><p>甲骨文小说：找到 2 本<br>笔趣阁349：${variant === 'loading' ? '正在搜索…' : '找到 1 本'}<br>${variant === 'loading' ? '' : '0 个未匹配 · 0 个失败 · 0 个规则未支持'}</p>${variant !== 'loading' ? '<button data-action="search-retry">重新搜索</button>' : ''}</details>${bookRow(0)}${variant !== 'loading' ? `${bookRow(1)}${bookRow(2)}` : ''}`;
    return `<section class="screen">${heading('寻找下一本好书','搜索 / 书名与作者')}<form id="search-form"><label class="search-field">${icon('search')}<input id="book-query" type="search" value="${variant === 'idle' ? '' : esc(query)}" placeholder="搜索书名或作者" aria-label="搜索书名或作者" autocomplete="off"></label></form><button class="search-scope" data-action="pick-source"><span>${icon('sources')}${esc(scope)}</span><span>${scope === '全部书源' ? '2 个已启用' : ''}${icon('down')}</span></button>${content}</section>${tabs('discover')}`;
  }
  function chapterRows(count = 8, modal = false) {
    return chapters.slice(0,count).map((name,i) => `<button class="chapter-row ${chapter === i ? 'current' : ''} ${i === 7 ? 'locked' : ''}" data-chapter="${i}" ${i === 7 ? 'disabled' : ''} aria-label="第${i+1}章 ${name}${i === 7 ? '，未解锁' : ''}"><span class="number">${String(i + 1).padStart(2,'0')}</span><span class="chapter-name">第${i+1}章　${name}</span>${i === 7 ? `<span class="chapter-state">未解锁</span>` : chapter === i ? '<span class="chapter-state">在读</span>' : icon('chevron')}</button>`).join('');
  }
  function detail() {
    const book = books[selectedBook];
    if (variant === 'loading') return `<section class="screen">${back('书籍详情','shelf')}${empty('正在加载书籍','书籍信息与目录正在获取中…','file')}</section>`;
    return `<section class="screen" style="padding-bottom:45px">${back('书籍详情','shelf')}<div class="detail-head">${cover(selectedBook)}<div><h1>${book.title}</h1><p>${book.author} 著</p><span class="pill">${book.category} · ${book.status}</span><p style="font-size:11px;margin-top:8px">来源：${book.source}</p></div></div><h2 style="font-size:17px">内容简介</h2><p class="summary-copy">${book.summary}</p><div class="detail-actions"><button class="primary" data-go="reader">${variant === 'new' ? '开始阅读' : '继续阅读'} ${icon('arrow')}</button><button class="secondary" data-action="toggle-collect">${icon(onShelf ? 'check' : 'plus')}${onShelf ? '移出书架' : '加入书架'}</button></div>${variant !== 'new' ? '<p class="resume-label">上次读到 · 第一章 南风学府</p>' : ''}<div class="section-heading"><div><h2>章节目录</h2><p class="caption" style="font-size:11px;margin-top:5px">共 12 章</p></div><button data-action="refresh-catalog">${icon('refresh')}刷新</button></div>${variant === 'error' ? '<div class="alert">目录暂时未能加载，已显示的书籍信息仍可查看。</div><button class="secondary full" data-action="retry">重试目录</button>' : chapterRows()}</section>`;
  }
  function reader() {
    if (variant === 'error') return `<section class="screen">${back('返回书籍','detail')}${empty('这一章暂时未能加载','请检查网络后重试。','warning','<button class="secondary" data-action="retry">重试</button>')}</section>`;
    const text = page % 2 ? ['清晨的光落在窗沿，南风学府的钟声从远处传来。少年合上手中的书，抬头望向庭院里那棵老树。','风吹过树梢，细碎的光影在石阶上轻轻晃动。院子外已经有了脚步声，新的一天，正带着未知缓缓走来。','李洛推开门，空气里是草木与晨露的气息。他知道，有些路只有亲自走过，才能看见远处的风景。','于是他迎着光，向前走去。'] : ['走过长廊的时候，远处的山色才渐渐清晰起来。风带着一点凉意，也带来了熟悉的声音。','少年停下脚步，回望身后安静的庭院。昨日的疑问仍在心间，而今天的答案，或许就在下一次相遇之中。','他将书放好，整理衣襟，像每一个平常的清晨那样，走进了人群。'];
    return `<section class="reader"><p class="reader-running">${books[selectedBook].title} · 第${chapter+1}章</p><h1>第${chapter+1}章　${chapters[chapter]}</h1><div class="reader-copy" style="font-size:${fontSize}px;line-height:${{'紧凑':1.5,'适中':1.9,'宽松':2.3}[spacing]}">${text.map(t => `<p>${t}</p>`).join('')}</div><div class="reader-zones"><button data-action="previous-page" aria-label="上一页"></button><button data-action="reader-menu" aria-label="显示阅读菜单"></button><button data-action="next-page" aria-label="下一页"></button></div><p class="reader-tip">轻点中间呼出菜单 · 两侧翻页</p><div class="reader-footer"><span>第${chapter+1}章 · ${chapters[chapter]}</span><span>本章 ${page} / 8 页</span></div>${readerPanel ? readerControls() : ''}</section>`;
  }
  function readerControls() {
    let panel = `<div class="reader-navigation"><button data-action="previous-chapter" ${chapter === 0 ? 'disabled' : ''}>上一章</button><div class="reader-position">第${chapter+1}章 ${chapters[chapter]}<br>本章 ${page} / 8 页</div><button data-action="next-chapter" ${chapter === chapters.length - 1 ? 'disabled' : ''}>下一章</button></div>`;
    if (readerPanel === 'settings') panel = `<div class="sheet-heading" style="padding-top:20px"><div><h2>阅读设置</h2><p>找到舒服的阅读节奏</p></div>${iconButton('close','reader-menu','收起阅读设置')}</div><div class="settings-row"><span>字号</span><div class="stepper"><button data-action="font-smaller" aria-label="减小字号" ${fontSize <= 14 ? 'disabled' : ''}>A−</button><output>${fontSize}</output><button data-action="font-larger" aria-label="增大字号" ${fontSize >= 30 ? 'disabled' : ''}>A＋</button></div></div><div class="settings-row"><span>行间距</span><div class="segments">${['紧凑','适中','宽松'].map(s => `<button data-spacing="${s}" aria-pressed="${s === spacing}" class="${s === spacing ? 'active' : ''}">${s}</button>`).join('')}</div></div><div class="settings-row"><span>翻页动画</span><div class="segments">${['滑动','淡入淡出','无动画'].map(s => `<button data-animation="${s}" aria-pressed="${s === animation}" class="${s === animation ? 'active' : ''}">${s}</button>`).join('')}</div></div><p class="settings-note">设置即时生效，并自动保存</p>`;
    if (readerPanel === 'chapters') panel = `<div class="sheet-heading" style="padding-top:20px"><div><h2>章节目录</h2><p>共 12 章 · 当前第 ${chapter+1} 章</p></div>${iconButton('close','reader-menu','收起章节目录')}</div><div style="height:298px;overflow:auto">${chapterRows(12,true)}</div>`;
    return `<div class="reader-shade" data-action="reader-close"></div><div class="reader-top">${iconButton('back','go-detail','返回书籍')}<span>${books[selectedBook].title}</span><button class="text-link" data-action="collect">${icon(onShelf ? 'check' : 'bookmark')}${onShelf ? '已在书架' : '加入书架'}</button></div><div class="reader-menu">${panel}<div class="reader-tools"><button data-action="reader-chapters" class="${readerPanel === 'chapters' ? 'active' : ''}">${icon('list')}目录</button><button data-action="reader-settings" class="${readerPanel === 'settings' ? 'active' : ''}">${icon('settings')}设置</button></div></div>`;
  }
  function sourceCard(source, i) {
    return `<article class="source-card"><div class="source-card-top">${batch ? `<button class="selection-checkbox ${selectedSources.has(i) ? 'checked' : ''}" role="checkbox" aria-checked="${selectedSources.has(i)}" aria-label="选择${source.name}" data-select-source="${i}">${selectedSources.has(i) ? '✓' : ''}</button>` : `<div class="source-icon">${source.name.slice(0,1)}</div>`}<div class="source-copy"><h3>${source.name}</h3><p>${source.url}</p></div>${batch ? '' : `<button class="switch" role="switch" aria-checked="${source.on}" aria-label="启用${source.name}" data-toggle-source="${i}"><span class="switch-track"></span></button>`}</div><div class="source-meta"><span class="pill neutral">文本书源</span><span>${source.group}</span><span>无发现入口</span><span class="source-status">${source.on ? '已启用' : '已停用'}</span></div>${batch ? '' : `<div class="source-card-actions"><button data-edit-source="${i}">编辑</button><button data-action="export">导出</button><button class="delete" data-delete-source="${i}">删除</button></div>`}</article>`;
  }
  function sourceScreen() {
    const filtered = sources.map((s,i) => ({s,i})).filter(({s}) => (sourceFilter === 'all' || (sourceFilter === 'on' ? s.on : !s.on)) && `${s.name} ${s.url} ${s.group}`.toLowerCase().includes(sourceQuery.toLowerCase()));
    const isEmpty = variant === 'empty';
    const allVisibleSelected = filtered.length > 0 && filtered.every(({i}) => selectedSources.has(i));
    return `<section class="screen">${heading('书源管理','让好故事，有处可寻',iconButton('more','source-more','更多书源操作',true))}<div class="source-summary"><div><strong>${isEmpty ? 0 : sources.filter(s=>s.on).length}</strong><span>个书源已启用</span><p>启用的书源会参与搜索</p></div>${icon('sources')}</div><div class="source-toolbar"><button class="primary" data-go="import">${icon('upload')}导入书源</button><button class="secondary" data-action="new-source">${icon('plus')}新增</button></div><label class="search-field">${icon('search')}<input id="source-query" placeholder="搜索名称、网址或分组" aria-label="搜索书源" value="${esc(sourceQuery)}"></label><div class="filter-row"><div class="filter-tabs">${[['all','全部'],['on','已启用'],['off','已停用']].map(([id,label]) => `<button data-filter="${id}" aria-pressed="${sourceFilter === id}" class="${sourceFilter === id ? 'active' : ''}">${label}</button>`).join('')}</div><span class="source-count">${isEmpty ? 0 : filtered.length} 个</span></div>${batch ? `<div class="selection-banner"><span>选择要删除的书源</span><button data-action="select-visible">${allVisibleSelected ? '取消选中当前' : '选中当前可见'}</button><button data-action="cancel-batch">取消</button></div>` : ''}${isEmpty ? empty('添加第一个书源','从 JSON 地址、文件或粘贴内容导入。','sources','<button class="secondary" data-go="import">导入书源</button>') : filtered.length ? filtered.map(({s,i}) => sourceCard(s,i)).join('') : '<p class="caption" style="padding:30px 0;text-align:center">没有匹配的书源，试试其他关键词。</p>'}</section>${batch ? `<div class="bulk-footer"><span>已选择 ${selectedSources.size} 个</span><button class="danger-button" data-action="bulk-delete" ${!selectedSources.size ? 'disabled' : ''}>删除所选</button></div>` : tabs('sources')}`;
  }
  function importPreview() {
    return `<section class="import-preview"><div class="section-heading" style="margin:0"><h2>待导入 · 2 个书源</h2><span class="pill neutral">1 个重复</span></div><article class="preview-source"><strong>甲骨文小说</strong><p>https://www.jgwxs.com</p><p class="conflict">书源地址已存在，将${replace ? '覆盖现有规则与启用状态' : '跳过此书源'}</p></article><article class="preview-source"><strong>示例书源</strong><p>https://example.com · 文本 · 启用</p></article><div class="switch-row"><div class="switch-copy"><strong>覆盖 1 个重复书源</strong><p>默认跳过；覆盖会替换规则与启用状态。</p></div><button class="switch" role="switch" aria-checked="${replace}" aria-label="覆盖重复书源" data-action="replace"><span class="switch-track"></span></button></div><p class="field-hint" style="margin-bottom:17px">导入成功仅表示配置已保存，能否搜索或阅读取决于书源规则支持情况。</p><button class="primary full" data-action="confirm-import">确认导入</button></section>`;
  }
  function importScreen() {
    if (imported) return `<section class="screen">${back('导入书源','sources')}${empty('书源已导入',`新增 1 个 · 更新 ${replace ? 1 : 0} 个 · 跳过 ${replace ? 0 : 1} 个`,'check','<button class="primary" data-go="sources">返回书源列表</button>')}</section>`;
    return `<section class="screen" style="padding-bottom:40px">${back('书源管理','sources')}${heading('导入书源','把新的故事，放进口袋')}<div class="form-tabs"><button data-import-mode="network" class="${importMode === 'network' ? 'active' : ''}" aria-pressed="${importMode === 'network'}">网络导入</button><button data-import-mode="local" class="${importMode === 'local' ? 'active' : ''}" aria-pressed="${importMode === 'local'}">本地 JSON 导入</button></div>${importMode === 'network' ? '<label class="field-label" for="source-url">书源 JSON 地址</label><input class="field" id="source-url" type="url" placeholder="https://…/shuyuan.json" autocomplete="off"><p class="field-hint">填写直接返回书源 JSON 的链接。</p><button class="text-link" data-action="fill-url">填入 XIU2 地址 '+icon('arrow')+'</button><button class="primary full" data-action="download-preview" style="margin-top:6px">下载并预览 '+icon('down')+'</button>' : `<button class="upload-box" data-action="pick-file">${icon('upload')}<strong>选择 JSON 文件</strong><span>支持单个书源对象或书源数组</span></button><label class="field-label" for="paste-json">也可粘贴书源 JSON</label><textarea class="field code-editor" id="paste-json" spellcheck="false" placeholder='[{"bookSourceName":"…",\n  "bookSourceUrl":"…"}]'></textarea><button class="primary full" data-action="validate-json" style="margin-top:17px">校验并预览</button>`}${importingError ? '<div class="alert" role="alert">下载失败，请检查地址是否可访问，并确认链接直接返回书源 JSON。</div>' : ''}${preview ? importPreview() : '<div class="hint-card">支持「阅读 / Legado」格式。导入前会显示预览，已有书源默认保留。</div>'}</section>`;
  }
  function editScreen() {
    const isNew = variant === 'new';
    return `<section class="screen" style="padding-bottom:40px">${back('书源管理','sources')}${heading(isNew ? '新增书源' : '编辑书源','书源配置 / 阅读与 Legado 格式')}<label class="field-label" for="edit-name">书源名称</label><input class="field" id="edit-name" value="${isNew ? '' : '甲骨文小说'}" placeholder="为书源起个名字"><label class="field-label" for="edit-url">书源地址</label><input class="field" id="edit-url" value="${isNew ? '' : 'https://www.jgwxs.com'}" placeholder="https://www.example.com" type="url"><p class="field-hint">通常填写网站首页，用于识别重复书源。</p><label class="field-label" for="edit-group">分组 <span class="caption">（可选）</span></label><input class="field" id="edit-group" placeholder="例如：玄幻、仙侠" value="${isNew ? '' : '自定义'}"><label class="field-label" for="edit-description">说明 <span class="caption">（可选）</span></label><textarea class="field" id="edit-description" style="height:80px;padding-top:12px;resize:vertical" placeholder="书源使用说明">${isNew ? '' : '公开搜索、目录与章节。'}</textarea><div class="switch-row"><div class="switch-copy"><strong>启用书源</strong><p>启用后参与搜索。</p></div><button class="switch" data-action="edit-enable" role="switch" aria-checked="${sourceEnabled}" aria-label="启用书源"><span class="switch-track"></span></button></div><div class="section-heading"><h2>规则与其他配置</h2>${isNew ? '<button data-action="fill-example">填入示例</button>' : ''}</div><p class="field-hint" style="margin-bottom:10px">在 JSON 中保留搜索、详情、目录和正文规则及其他原始字段。名称、地址、分组、说明及启用状态由上方表单保存。</p><textarea class="field code-editor" id="edit-json" spellcheck="false">{\n  "searchUrl": "/search?q={{key}}",\n  "ruleSearch": {},\n  "ruleBookInfo": {},\n  "ruleToc": {},\n  "ruleContent": {}\n}</textarea>${variant === 'error' ? '<div class="alert" role="alert">规则配置不是有效的 JSON 对象，请检查引号与逗号。已填写的内容会保留。</div>' : ''}<div class="stack" style="margin-top:23px"><button class="secondary" data-go="sources">取消</button><button class="primary" data-action="save-source">保存书源</button></div></section>`;
  }
  function profile() {
    return `<section class="screen">${heading('我的阅读','给自己，留一点阅读的时间')}<div class="profile-card"><span class="quote-mark">“</span><h2>让故事，<br>慢慢发生。</h2><p>你的阅读空间已经准备好了。</p></div><div class="profile-stats"><div class="profile-stat"><strong>3</strong><span>书架藏书</span></div><div class="profile-stat"><strong>${sources.filter(s=>s.on).length}</strong><span>已启用书源</span></div></div><div class="local-note">${icon('bookmark')}<div><h3>下次打开，接着读</h3><p>阅读进度自动保存在本机，<br>打开书籍即可继续阅读。</p></div></div><div class="profile-signature">noval.<span>ONE MORE PAGE, ONE MORE WORLD.</span></div></section>${tabs('profile')}`;
  }
  function showToast(message) {
    document.querySelector('.toast')?.remove();
    clearTimeout(toastTimer);
    app.insertAdjacentHTML('beforeend',`<div class="toast" role="status">${esc(message)}</div>`);
    toastTimer = setTimeout(() => document.querySelector('.toast')?.remove(),2600);
  }
  function closeModal() { document.querySelectorAll('.backdrop,.sheet,.dialog-backdrop').forEach(el => el.remove()); activeModal = '';if (modalTrigger?.isConnected) modalTrigger.focus();modalTrigger = null; }
  function sheet(title, body, subtitle = '') {
    const trigger = document.activeElement;closeModal();modalTrigger = trigger;activeModal = title;
    app.insertAdjacentHTML('beforeend',`<div class="backdrop" data-action="close-modal"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${title}" tabindex="-1"><div class="sheet-handle"></div><div class="sheet-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${iconButton('close','close-modal','关闭')}</div>${body}</section>`);
    document.querySelector('.sheet').focus();
  }
  function pickSource() {
    sheet('选择搜索书源',`<label class="search-field">${icon('search')}<input id="picker-query" placeholder="查找书源" aria-label="查找已启用书源" value="${esc(sourceSelectionFilter)}"></label><div id="source-options">${sourceOptions()}</div>`,'仅显示已启用的书源');
  }
  function sourceOptions() {
    return ['全部书源',...sources.filter(s=>s.on).map(s=>s.name)].filter(s=>s.includes(sourceSelectionFilter)).map(s=>`<button class="sheet-option ${scope === s ? 'selected' : ''}" data-scope="${s}"><span>${s}</span>${s === '全部书源' ? `<small>${sources.filter(s=>s.on).length} 个已启用</small>` : ''}${scope === s ? icon('check') : ''}</button>`).join('') || '<p class="caption" style="padding:22px 0">没有匹配的已启用书源</p>';
  }
  function deleteDialog(index = 0, bulk = false) {
    const trigger = document.activeElement;closeModal();modalTrigger = trigger;activeModal = '删除确认';
    const count = bulk ? selectedSources.size : 1;
    app.insertAdjacentHTML('beforeend',`<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="delete-copy" tabindex="-1"><h2 id="dialog-title">${bulk ? `删除所选 ${count} 个书源？` : '删除书源？'}</h2><p id="delete-copy">${bulk ? `删除所选 ${count} 个书源后，这些书源的书籍将不再可用` : `删除「${sources[index]?.name || '甲骨文小说'}」后，该书源的书籍将不再可用`}，并从书架移除 2 本收藏。如需保留，请先导出备份。</p><div class="stack"><button class="secondary" data-action="close-modal">取消</button><button class="danger-button" data-action="confirm-delete">确认删除</button></div></section></div>`);
    document.querySelector('.dialog .secondary').focus();
  }
  function moreSources() {
    sheet('更多书源操作',`<button class="sheet-option" data-action="export"><span>全部导出</span>${icon('upload')}</button><button class="sheet-option" data-action="enable-all"><span>全部启用</span></button><button class="sheet-option" data-action="disable-all"><span>全部禁用</span></button><button class="sheet-option" data-action="start-batch" style="color:var(--danger)"><span>批量删除</span></button>`);
  }
  function applyVariant(next) {
    variant = next;
    shelfList = next === 'list'; shelfRemoved = false;
    batch = current === 'sources' && next === 'batch';
    readerPanel = ['menu','settings','chapters'].includes(next) && current === 'reader' ? next : '';
    importMode = next === 'local' ? 'local' : 'network'; preview = next === 'preview'; imported = next === 'success'; importingError = current === 'import' && next === 'error';
    if (current === 'detail') onShelf = next !== 'new';
  }
  function go(id, next = 'default') {
    if (id === 'edit') { fieldMemory.delete('edit');lastRendered = ''; }
    current = id; closeModal(); applyVariant(next); render();
    const url = new URL(location.href);url.searchParams.set('screen',id);url.searchParams.set('state',next);history.replaceState(null,'',url);
  }
  function render(preserveScroll = false) {
    const scrollTop = document.querySelector('.screen')?.scrollTop || 0;
    if (lastRendered) {
      const saved = fieldMemory.get(lastRendered) || {};
      document.querySelectorAll(retainedFields).forEach(field => { saved[field.id] = field.value; });
      fieldMemory.set(lastRendered,saved);
    }
    activeModal = '';
    const config = configs.find(c=>c.id === current);
    const index = configs.indexOf(config);
    document.querySelector('#page-nav').innerHTML = configs.map((c,i) => `<button class="page-nav-button ${current === c.id ? 'active' : ''}" data-go="${c.id}" ${current === c.id ? 'aria-current="page"' : ''}><span>${String(i+1).padStart(2,'0')}</span>${c.title}</button>`).join('');
    document.querySelector('#screen-number').textContent = String(index+1).padStart(2,'0');document.querySelector('#screen-label').textContent = config.label;
    document.querySelector('#note-title').textContent = config.note;document.querySelector('#note-intro').textContent = config.intro;
    document.querySelector('#note-items').innerHTML = config.items.map(([title,copy],i)=>`<div class="note-item"><h3><span>${i+1}.</span>${title}</h3><p>${copy}</p></div>`).join('');
    document.querySelector('#state-options').innerHTML = config.states.map(([id,title])=>`<button data-variant="${id}" class="${variant === id ? 'active' : ''}" aria-pressed="${variant === id}">${title}</button>`).join('');
    document.querySelector('#phone').classList.toggle('reading',current === 'reader' && variant !== 'error');
    app.innerHTML = ({shelf,discover,detail,reader,sources:sourceScreen,import:importScreen,edit:editScreen,profile}[current])();
    const saved = fieldMemory.get(current) || {};
    document.querySelectorAll(retainedFields).forEach(field => { if (saved[field.id] !== undefined) field.value = saved[field.id]; });
    if (current === 'edit' && variant !== 'new' && !fieldMemory.has('edit')) {
      const source = sources[editingSourceIndex];
      document.querySelector('#edit-name').value = source.name;
      document.querySelector('#edit-url').value = `https://${source.url}`;
      document.querySelector('#edit-group').value = source.group;
    }
    lastRendered = current;
    if (preserveScroll && document.querySelector('.screen')) document.querySelector('.screen').scrollTop = scrollTop;
    if (current === 'sources' && variant === 'delete') deleteDialog();
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('button,[data-action]'); if (!target || target.disabled) return;
    if (target.dataset.go) return go(target.dataset.go);
    if (target.dataset.variant) { if (current === 'edit') { fieldMemory.delete('edit');lastRendered = ''; } applyVariant(target.dataset.variant); render(); return; }
    if (target.dataset.book != null) { selectedBook = Number(target.dataset.book);go('detail');return; }
    if (target.dataset.chapter != null) { chapter = Number(target.dataset.chapter);page = 1;go('reader');return; }
    if (target.dataset.filter) { sourceFilter = target.dataset.filter;render();return; }
    if (target.dataset.toggleSource != null) { const source = sources[Number(target.dataset.toggleSource)];source.on = !source.on;render(true);showToast(`已${source.on ? '启用' : '停用'}「${source.name}」`);return; }
    if (target.dataset.selectSource != null) { const i = Number(target.dataset.selectSource);selectedSources.has(i) ? selectedSources.delete(i) : selectedSources.add(i);render(true);return; }
    if (target.dataset.deleteSource != null) return deleteDialog(Number(target.dataset.deleteSource));
    if (target.dataset.editSource != null) { editingSourceIndex = Number(target.dataset.editSource);return go('edit'); }
    if (target.dataset.scope) { scope = target.dataset.scope;closeModal();render();return; }
    if (target.dataset.importMode) { importMode = target.dataset.importMode;preview = false;importingError = false;render();return; }
    if (target.dataset.spacing) { spacing = target.dataset.spacing;render();return; }
    if (target.dataset.animation) { animation = target.dataset.animation;render();showToast('原型仅演示选中状态；实际翻页动画沿用现有实现');return; }
    const action = target.dataset.action;
    if (action?.startsWith('go-')) return go(action.slice(3));
    switch(action) {
      case 'list': shelfList = true;variant = 'list';render();break;
      case 'carousel': shelfList = false;variant = 'default';render();break;
      case 'previous-book': selectedBook = (selectedBook + 2) % 3;render();break;
      case 'next-book': selectedBook = (selectedBook + 1) % 3;render();break;
      case 'remove': showToast('演示：已移出书架；实际应用沿用现有移除逻辑');break;
      case 'retry': applyVariant('default');render();showToast('已重新加载（演示）');break;
      case 'search-retry': variant = 'loading';render();break;
      case 'pick-source': sourceSelectionFilter = '';pickSource();break;
      case 'close-modal': closeModal();break;
      case 'toggle-collect': onShelf = !onShelf;render(true);showToast(onShelf ? '已加入书架（演示）' : '已移出书架（演示）');break;
      case 'collect': if (!onShelf) { onShelf = true;render(true);showToast('已加入书架（演示）'); } else showToast('此书已在书架中');break;
      case 'refresh-catalog': variant = 'default';render(true);showToast('目录已刷新（演示）');break;
      case 'reader-menu': readerPanel = 'menu';render();break;
      case 'reader-close': readerPanel = '';render();break;
      case 'reader-settings': readerPanel = 'settings';render();break;
      case 'reader-chapters': readerPanel = 'chapters';render();break;
      case 'previous-page': page = Math.max(1,page-1);render();break;
      case 'next-page': page = Math.min(8,page+1);render();break;
      case 'previous-chapter': chapter = Math.max(0,chapter-1);page = 1;readerPanel = '';render();break;
      case 'next-chapter': chapter = Math.min(chapters.length-1,chapter+1);page = 1;readerPanel = '';render();break;
      case 'font-smaller': fontSize = Math.max(14,fontSize-2);render();break;
      case 'font-larger': fontSize = Math.min(30,fontSize+2);render();break;
      case 'source-more': moreSources();break;
      case 'new-source': go('edit','new');break;
      case 'export': closeModal();showToast('演示：此处沿用现有 JSON 导出流程');break;
      case 'enable-all': sources.forEach(s=>s.on = true);closeModal();render();showToast('已启用全部书源（演示）');break;
      case 'disable-all': sources.forEach(s=>s.on = false);closeModal();render();showToast('已停用全部书源（演示）');break;
      case 'start-batch': closeModal();batch = true;render();break;
      case 'cancel-batch': batch = false;selectedSources.clear();render();break;
      case 'select-visible': { const visibleIds = sources.flatMap((s,i) => (sourceFilter === 'all' || (sourceFilter === 'on' ? s.on : !s.on)) && `${s.name} ${s.url} ${s.group}`.toLowerCase().includes(sourceQuery.toLowerCase()) ? [i] : []); const allSelected = visibleIds.every(i => selectedSources.has(i));visibleIds.forEach(i => allSelected ? selectedSources.delete(i) : selectedSources.add(i));render(true);break; }
      case 'bulk-delete': deleteDialog(0,true);break;
      case 'confirm-delete': closeModal();variant = 'default';batch = false;render();showToast('演示：确认后沿用现有删除逻辑');break;
      case 'fill-url': document.querySelector('#source-url').value = 'https://yuedu.xiu2.xyz/shuyuan';break;
      case 'download-preview': case 'validate-json': preview = true;importingError = false;render(true);showToast('已显示导入预览示例');break;
      case 'pick-file': showToast('演示：实际应用打开现有系统文件选择器');preview = true;render(true);showToast('已显示文件导入预览示例');break;
      case 'replace': replace = !replace;render(true);break;
      case 'confirm-import': imported = true;render();break;
      case 'edit-enable': sourceEnabled = !sourceEnabled;target.setAttribute('aria-checked',String(sourceEnabled));break;
      case 'fill-example': document.querySelector('#edit-name').value = '示例书源';document.querySelector('#edit-url').value = 'https://example.com';showToast('已填入示例配置（演示）');break;
      case 'save-source': if (!document.querySelector('#edit-name').value.trim() || !document.querySelector('#edit-url').value.trim()) { showToast('请填写书源名称和地址');break; } try { const parsed = JSON.parse(document.querySelector('#edit-json').value);if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();go('sources');showToast('书源已保存（演示）'); } catch { showToast('规则配置需要是有效的 JSON 对象'); }break;
    }
  });
  document.addEventListener('submit',event => { if (event.target.id === 'search-form') { event.preventDefault();query = document.querySelector('#book-query').value.trim();variant = query ? 'default' : 'idle';render();if (query) showToast('演示结果用于展示布局，不执行真实搜索'); } });
  let searchTimer;
  document.addEventListener('input',event => {
    if (event.target.id === 'book-query') { const value = event.target.value;clearTimeout(searchTimer);searchTimer = setTimeout(()=>{if (current !== 'discover') return;query = value.trim();variant = query ? 'default' : 'idle';render();const field = document.querySelector('#book-query');field.focus();},350); }
    if (event.target.id === 'picker-query') { sourceSelectionFilter = event.target.value;document.querySelector('#source-options').innerHTML = sourceOptions(); }
    if (event.target.id === 'source-query') { sourceQuery = event.target.value;const caret = event.target.selectionStart;render();const input = document.querySelector('#source-query');input.focus();input.setSelectionRange(caret,caret); }
  });
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape') { closeModal();if (readerPanel) { readerPanel = '';render(); } }
    if (event.key === 'Tab' && activeModal) {
      const modal = document.querySelector('.sheet,.dialog');
      const focusable = [...modal.querySelectorAll('button:not(:disabled),input,textarea,[tabindex="0"]')];
      if (!focusable.length) return;
      if (event.shiftKey && (document.activeElement === focusable[0] || document.activeElement === modal)) { event.preventDefault();focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault();focusable[0].focus(); }
    }
  });
  applyVariant(params.get('state') || 'default');render();
})();
