# Noval 技术架构与实施计划

## 产品边界

Noval 是多书源小说阅读器。Android、iOS 使用 Expo 构建原生应用；macOS 第一阶段通过同一套 React Native Web 界面运行在浏览器中，正式桌面交付采用 Tauri 外壳打包 Expo 的单页 Web 构建。macOS 的网络与文件访问在桌面外壳中实现适配，不把 Expo/EAS 的 iOS 构建当作 macOS 构建。界面按窄屏优先设计，宽屏限制正文宽度。

当前提供可切换的立体书架、跨源搜索、书籍详情、目录、正文阅读及阅读 / Legado 规则书源管理。番茄小说支持公开目录及公开章节阅读；可信 JavaScript 示例提供离线阅读内容。

书架采用 `Animated` 透视变换与横向手势切换，也可切换为普通列表。底部导航在支持的 iOS 26 设备上使用系统 Liquid Glass；其他 iOS 版本与 Web 使用 `expo-blur`，Android 使用半透明玻璃外观作为回退。新增的两个 Expo 模块均在 Expo Go 中可用。

## 分层

```text
src/app                 Expo Router 页面与导航
src/components          通用界面与视觉常量
src/state               书源及书架状态与本地持久化
src/domain/books.ts     书、章节及 SourceAdapter 契约
src/sources             内置、JSON、可信 JS 和 Legado 搜索适配器
src/server              Web 书源转发服务实现
src/storage             SQLite 书架、阅读进度与版本迁移
src/reader              分页、翻页边界与站点字体加载
```

可执行书源遵循相同的 `SourceAdapter`：`search`、`getBook`、`getChapters`、`getChapter`。书籍身份是 `(sourceId, bookId)`，避免不同书源的本地 ID 冲突。发现页对各源并发搜索，并保留成功源的结果；单一源报错不会让整个搜索失败。

目录接口仅返回 `ChapterMeta`，正文通过 `getChapter` 按需获取，避免打开长篇目录时把全书正文载入内存。适配器负责把不同站点的字段归一；页面不解析 HTML，也不直接发起站点请求。

### 书源配置与执行能力

网站书源使用阅读 / Legado 格式，以 `bookSourceName`、`bookSourceUrl`、`searchUrl`、`ruleSearch`、`ruleBookInfo`、`ruleToc`、`ruleContent` 等字段描述请求和提取规则。保留未知字段、脚本、请求头、登录及发现配置。新增及编辑、网络地址导入、本地 JSON 文件／粘贴导入、单个／批量导出均使用这个交换格式。重复项按 `bookSourceUrl` 识别，内部 ID 由地址编码生成，导出时不添加内部包装。

可信 JS 示例随应用打包，用于体验现有书架和阅读链路，不出现在网站规则书源管理中，也不混入规则书源导出。当前默认四源为哔哩轻小说、起点男频、笔趣庭和笔趣阁94；静态／可信 JS 适配器保留执行能力，不自动加入示例书。

**当前边界：** 已实现规则配置管理、在线搜索适配器和在线收藏。已启用书源参与搜索；支持简单 GET／POST、CSS／Legado 选择器、基础 JSONPath、末尾字符串等值过滤和正则替换。脚本、XPath、复杂 JSONPath、非 UTF-8 编码等必填规则在请求前报告未支持原因。内置番茄另有专用公开详情／目录／正文适配器；其他导入规则源仍只接入搜索。导入成功不代表网站一定可访问或能通过防护验证。

**脚本边界：** 不在应用主 JavaScript 环境中对用户提供的代码使用 `eval`、`Function` 或动态导入。规则中的 JavaScript 作为字符串保存及导出。后续按需要实现隔离执行宿主和 `java` 兼容接口、其他编码、XPath、复杂 JSONPath、复杂模板与分页。

搜索实现分为 `legado-rules.ts`（HTML／JSON 和声明式规则）、`legado-search.ts`（请求配置、超时、取消和结果缓存）以及 `search.ts`（最多三源并发、增量发布及错误隔离）。HTML 使用 htmlparser2 和 css-select 解析；POST 配置使用 JSON5 数据解析。`search-transport.ts` 在原生端直接请求，`.web.ts` 调用同源 API；`src/app/api/source-fetch+api.ts` 导出 `src/server/source-fetch.ts` 的 Node 转发处理器。转发限制域名、端口、公网地址及响应大小，逐次验证重定向，并将 DNS 地址固定到连接。搜索页负责防抖和 FlatList 渲染，不直接解析或请求网站；离线示例不计入在线书源响应数。

## 数据与阅读链路

当前使用 `expo-sqlite` 的 `noval-library.db` 保存书源定义、启用状态和书架。`src/storage/library-database.ts` 管理 SQL 和事务，`library.ts` 管理连接及旧 AsyncStorage 数据的一次性迁移。`library_settings` 保存书源配置，`shelf_books` 以 `(source_id, book_id)` 为主键保存顺序和有长度限制的收藏信息，仅保存封面链接，不下载图片或正文。所有读写串行执行，书源与收藏修改同一事务提交，成功落盘后更新界面；首次加载失败时禁止修改并支持重试，不覆盖已有数据。移除收藏删除对应行，数据库空闲页可重用；删除源清理关联收藏，修改源地址迁移引用及元数据，禁用或覆盖源保留收藏。导入重复项默认跳过，可显式覆盖。格式与导入说明见 [book-sources.md](./book-sources.md)。

数据库 schema 2 新增 `reading_progress`，以 `(source_id, book_id)` 保存章节 ID、标题、页首字符偏移及更新时间。翻页防抖保存，离开阅读页和应用进入后台时刷新待写进度；旧时间戳不覆盖新进度。保留所有收藏书籍的进度及最近 200 本未收藏书籍的进度，移除收藏或删除源时清理对应进度。schema 1 自动升级并保留书架，拒绝打开更高版本数据库。Web 同样使用 SQLite WebAssembly，通过 Metro 和托管服务器的 COOP／COEP 响应头支持 SharedArrayBuffer。

当前 schema 4 增加 `library_backups`，按用户要求先备份旧书源、书架和阅读进度，再在同一事务清空活动数据。`SOURCE_RESET_ID` 标记这次一次性重置，生产仓储通过 `resetSources: true` 启用；后续加载不再次清空。已取消所有默认源安装和旧番茄保护，Yiove JSON 快照已移除。已按用户最新选择以新标记补入四源默认集合，并关闭生产环境的再次清空。

`sources/reading.ts` 只解析番茄公开页面的 JSON 数据，不执行站点脚本；校验书籍／章节身份，保留锁定状态，正文按需请求。目录使用 FlatList，仅在内存保留两本目录（五分钟有效）和最近三章正文，不新增正文落盘。站点特殊字形使用页面声明的可信字体，最多同时加载三份。阅读器原生端依据 Text 的行布局分页，Web 使用保守估算；字符偏移用于屏幕变化后重新定位。正文区域左滑下一页、右滑上一页，跨章时下一章进入首页、上一章进入末页；保留可访问的翻页按钮。字号、主题及跨设备进度同步仍待实现。

建议的持久化表以 `source_id` 加本地 ID 作复合键：`sources` 保存类型、配置版本和启用状态；`books` 保存规范化元数据；`shelf` 保存收藏顺序；`chapters` 保存目录；`chapter_cache` 保存正文、大小和访问时间；`reading_progress` 保存章节 ID、段落位置和更新时间。迁移必须可回滚或可从书源重新构建缓存。UI 只依赖仓储接口，避免 SQLite、Web IndexedDB 和桌面外壳实现渗入页面。

在线书源经适配器进行请求。第二阶段的网络层应统一处理超时、重试、编码、重定向、站点访问策略及错误展示。部分站点存在反爬、版权或服务条款限制，只有明确允许的源才纳入分发。不要把账号密码交给书源脚本。

### 平台与交付

| 平台 | UI 与路由 | 数据 | 网络与发布 |
| --- | --- | --- | --- |
| Android | Expo Router + React Native | `expo-sqlite` | Expo 开发构建、EAS Build/Submit/Update |
| iOS | Expo Router + React Native | `expo-sqlite` | Expo 开发构建、EAS Build/Submit/Update |
| macOS | React Native Web + Tauri 桌面外壳 | IndexedDB 或桌面 SQLite 适配器 | Tauri 受控请求代理、macOS 签名与公证 |

当前 Web 使用 Expo 的 `server` 输出，通过同源 API 转发搜索请求，生产环境需要部署服务端。新增允许域名使用服务端环境变量 `NOVAL_SOURCE_HOSTS`；网站自身的 403／503 或失效域名仍会导致失败。桌面版计划通过外壳的受控请求代理保持相同的书源契约；未来打包 Tauri 时需单独配置静态前端输出与外壳网络适配，不能直接沿用当前服务端部署方式。桌面打包、签名与公证在交付阶段完成。

## 阶段计划

1. **可运行骨架（当前）：** Expo Router、适配器契约、番茄默认搜索源、可信 JavaScript 离线示例、书架／搜索／目录／阅读；书源管理支持新增、编辑、删除、启停及阅读 / Legado 网络／本地 JSON 文件／文本导入、单个／全部导出，书源和书架已持久化。
2. **可用阅读器：** 数据仓储和迁移、持久化书架与进度、章节缓存、阅读设置、网络请求层、Legado 声明式规则解析引擎。
3. **可扩展书源：** 隔离 JS 执行宿主、权限模型、源安装更新与迁移、源健康检查、跨平台兼容性测试。
4. **交付：** Android/iOS 开发构建和发布流水线；macOS 使用 Tauri 包装 Expo Web 单页构建，补齐窗口、文件导入和网络代理，并在 macOS 上完成签名、公证与自动更新验证。

## 运行与验收

```bash
npm install
npx expo start
npx expo start --web
npx expo lint
npx tsc --noEmit
```

打开应用后，可在发现页通过番茄默认源搜索；书源页可通过 XIU2 JSON 地址或本地文件导入规则。输入关键词后，搜索页会使用已启用书源，逐源显示结果和失败原因。搜索规则回归测试运行 `npm run test:search`；合成 HTML 测试与三平台资源打包不替代真实网站和原生设备验证。文件导入、导出和持久化使用 SDK 58 支持的模块；此次搜索依赖均为纯 JavaScript，不增加原生模块。

## 参考资料

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [Expo Router](https://docs.expo.dev/router/introduction.md)
- [Expo 文档索引及 API 更正](https://docs.expo.dev/llms.txt)

- [XIU2 阅读书源](https://yuedu.xiu2.xyz/)

已读取 Expo SDK 58 及相应模块的版本文档，并结合本地类型和 CLI 核对 API。

## 四源适配与浏览器宿主

`qidian-reader.ts` 解析当前站点 SSR JSON，提供分卷目录／锁定状态／正文，正文仅保留三章内存。`browser-reader.ts` 为另外三个确认站点解析浏览器 DOM，限制章节归属和分页。`browser-session.ts` 是客户端等待队列，根布局挂载平台 `SourceBrowser`：原生使用 Expo Go 内置的 WebView，Web 连接 `source-browser+api.ts` 的 Playwright Node 服务。验证码在可见窗口由用户完成，成功匹配目标 DOM 后才继续。

服务端浏览器不进入客户端打包，使用 Node `createRequire` 加载驱动。浏览器会话按随机 capability ID 隔离、六份上限、三十分钟闲置清理；请求限定同源 JSON、已确认的 HTTPS 导航域名和公网资源地址。部署 Web 需另提供 Chromium 或 Chrome；原生不依赖此 Node 浏览器服务。默认四源以 `default_source_bundles` 事务标记一次性补入，用户同地址修改优先，删除后不重建。
