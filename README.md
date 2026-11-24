# Noval 阅读

基于 Expo SDK 58 的多书源小说阅读器原型。书架支持立体书册切换与列表视图，底部采用悬浮玻璃导航。书源管理采用「阅读 / Legado」规则格式，支持网络地址、本地 JSON 文件和粘贴导入，以及编辑、启停、删除和导出。

默认内置番茄小说书源，使用其公开搜索接口，支持搜索信息和封面；可禁用，不可编辑或删除。原演示书库已移除，已有用户导入的书源会保留。已启用的规则书源支持简单 GET／POST、CSS／Legado 选择器、基础 JSONPath、有限等值过滤和正则替换；Web 使用同源服务转发搜索请求，原生端直接请求网站。在线详情抓取、目录、正文和脚本运行尚未接入；可信 JavaScript 离线示例仍可用于阅读。具体支持边界见 [书源说明](docs/book-sources.md)。

搜索结果和详情支持真实图片封面，番茄缩略图加载失败时尝试接口提供的备用图片，仍失败时回退文字封面。旧版速读谷规则已兼容当前域名及搜索直接跳到单本详情的情况；搜索“皮嫁骨”已取得匹配书籍。搜索页可展开查看每个源的结果数与错误，响应成功但列表为空单独标为未匹配。

**换机或继续开发时，先阅读 [开发节点与接续指南](docs/development-checkpoint.md) 和 [AGENTS.md](AGENTS.md)。**

```bash
npm ci
npx expo start
```

在终端按 `a` / `i` 打开 Android / iOS，或运行 `npx expo start --web` 在浏览器使用。macOS 第一阶段使用 Web 版。书源格式见 [书源说明](docs/book-sources.md)，阶段范围和平台策略见 [技术架构](docs/architecture.md)。

本次 Web 输出改为 `server`，更新后请重启 Expo。部署 Web 时需要同时部署 API 服务，不能只上传静态文件。新增书源域名可通过服务端环境变量 `NOVAL_SOURCE_HOSTS` 配置（英文逗号分隔准确域名，修改后重启服务）。

检查：`npx expo lint`、`npx tsc --noEmit`、`npm run test:search`。
