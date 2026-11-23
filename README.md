# Noval 阅读

基于 Expo SDK 58 的多书源小说阅读器原型。书架支持立体书册切换与列表视图，底部采用悬浮玻璃导航。书源管理采用「阅读 / Legado」规则格式，支持网络地址、本地 JSON 文件和粘贴导入，以及编辑、启停、删除和导出。

当前阅读与搜索使用离线示例内容；网站规则的在线解析和脚本运行尚未接入。

**换机或继续开发时，先阅读 [开发节点与接续指南](docs/development-checkpoint.md) 和 [AGENTS.md](AGENTS.md)。**

```bash
npm ci
npx expo start
```

在终端按 `a` / `i` 打开 Android / iOS，或运行 `npx expo start --web` 在浏览器使用。macOS 第一阶段使用 Web 版。书源格式见 [书源说明](docs/book-sources.md)，阶段范围和平台策略见 [技术架构](docs/architecture.md)。

检查：`npx expo lint`、`npx tsc --noEmit`。
