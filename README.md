# Noval 阅读

基于 Expo SDK 58 的多书源小说阅读器原型。书架支持立体书册切换与列表视图，底部采用悬浮玻璃导航。当前提供内置源、静态 JSON 源和随应用打包的 JavaScript 示例源。

```bash
npm install
npx expo start
```

在终端按 `a` / `i` 打开 Android / iOS，或运行 `npx expo start --web` 在浏览器使用。macOS 第一阶段使用 Web 版。书源格式、阶段范围和平台策略见 [技术架构](docs/architecture.md)。

检查：`npx expo lint`、`npx tsc --noEmit`。
