# Noval 阅读

基于 Expo SDK 58 的多书源小说阅读器原型。书架支持立体书册切换与列表视图，底部采用悬浮玻璃导航。书源管理采用「阅读 / Legado」规则格式，支持网络地址、本地 JSON 文件和粘贴导入，以及编辑、启停、删除和导出。

当前默认提供用户选定的哔哩轻小说、起点男频、笔趣庭和笔趣阁94四个源，可在「书源」中编辑、停用或删除，也可导入其他规则。现有搜索引擎支持简单 GET／POST、CSS／Legado 选择器、基础 JSONPath、有限等值过滤和正则替换；Web 使用同源服务转发请求，原生端直接请求网站。起点支持分卷目录、公开正文及阅读进度；三个浏览器源通过验证窗口加载网页，遇到验证码需用户手动完成。保留番茄公开目录及正文适配能力。具体支持边界见 [书源说明](docs/book-sources.md)。

搜索结果和详情支持真实图片封面，番茄缩略图加载失败时尝试接口提供的备用图片，仍失败时回退文字封面。旧版速读谷规则已兼容当前域名及搜索直接跳到单本详情的情况；搜索“皮嫁骨”已取得匹配书籍。搜索页可展开查看每个源的结果数与错误，响应成功但列表为空单独标为未匹配。

此前清空操作的备份保存在 SQLite 的 `library_backups`。新四源默认集合以 `selected-four-2026-11-24-v1` 为标记只补入一次，保留已有同地址修改，删除后不恢复；不会恢复旧番茄／Yiove 集合或再次清空当前书架。

**换机或继续开发时，先阅读 [开发节点与接续指南](docs/development-checkpoint.md) 和 [AGENTS.md](AGENTS.md)。**

```bash
npm ci
npx expo start
```

在终端按 `a` / `i` 打开 Android / iOS，或运行 `npx expo start --web` 在浏览器使用。macOS 第一阶段使用 Web 版。书源格式见 [书源说明](docs/book-sources.md)，阶段范围和平台策略见 [技术架构](docs/architecture.md)。

本次 Web 输出改为 `server`，更新后请重启 Expo。部署 Web 时需要同时部署 API 服务，不能只上传静态文件。新增书源域名可通过服务端环境变量 `NOVAL_SOURCE_HOSTS` 配置（英文逗号分隔准确域名，修改后重启服务）。

书架与阅读进度保存在本地 SQLite；正文只按需保留最近三章的内存缓存，不持久化整本书。未收藏书籍最多保留最近 200 本阅读进度，已收藏书籍保留各自进度。

Web 浏览器源需要 Node 服务和 Playwright 浏览器。开发机优先使用已安装的 Chrome；也可运行 `npx playwright install chromium`。部署时同样需提供浏览器，不能只上传静态文件。Android／iOS 使用 SDK 58 的 `react-native-webview`，Expo Go 已包含该模块。

检查：`npx expo lint`、`npx tsc --noEmit`、`npm run test:search`、`npm run test:sources`、`npm run test:shelf`、`npm run test:reading`。
