# Noval 技术架构与实施计划

## 产品边界

Noval 是多书源小说阅读器。Android、iOS 使用 Expo 构建原生应用；macOS 第一阶段通过同一套 React Native Web 界面运行在浏览器中，正式桌面交付采用 Tauri 外壳打包 Expo 的单页 Web 构建。macOS 的网络与文件访问在桌面外壳中实现适配，不把 Expo/EAS 的 iOS 构建当作 macOS 构建。界面按窄屏优先设计，宽屏限制正文宽度。

第一阶段交付离线可运行的垂直切片：可切换的立体书架、跨源搜索、书籍详情、目录、正文阅读、JSON 静态书源导入、内置源及可信 JavaScript 源示例。示例小说是原创占位内容，不依赖第三方小说站点。

书架采用 `Animated` 透视变换与横向手势切换，也可切换为普通列表。底部导航在支持的 iOS 26 设备上使用系统 Liquid Glass；其他 iOS 版本与 Web 使用 `expo-blur`，Android 使用半透明玻璃外观作为回退。新增的两个 Expo 模块均在 Expo Go 中可用。

## 分层

```text
src/app                 Expo Router 页面与导航
src/components          通用界面与视觉常量
src/state               当前会话的书源和书架状态
src/domain/books.ts     书、章节及 SourceAdapter 契约
src/sources             内置、JSON 和可信 JS 适配器
```

所有书源实现相同的 `SourceAdapter`：`search`、`getBook`、`getChapters`、`getChapter`。书籍身份是 `(sourceId, bookId)`，避免不同书源的本地 ID 冲突。发现页对各源并发搜索，并保留成功源的结果；单一源报错不会让整个搜索失败。

目录接口仅返回 `ChapterMeta`，正文通过 `getChapter` 按需获取，避免打开长篇目录时把全书正文载入内存。适配器负责把不同站点的字段归一；页面不解析 HTML，也不直接发起站点请求。

### 三种书源

| 类型 | 第一阶段 | 后续目标 |
| --- | --- | --- |
| 内置 | 随应用打包的离线示例，可直接阅读 | 官方维护的源包，带版本与迁移策略 |
| JSON | 导入 `version: 1` 的书籍与章节数据，执行字段与引用校验 | 声明式请求、解析规则、分页、分页限额、规则版本迁移 |
| JavaScript | 随应用打包的可信适配器示例 | 用户脚本在独立执行环境中运行，经受控请求接口访问网络 |

**安全边界：** 不在应用主 JavaScript 环境中对用户提供的代码使用 `eval`、`Function` 或动态导入。第二阶段先确定 Android、iOS 与 macOS Web 都能工作的隔离执行宿主，并限制域名、超时、响应大小、执行时间、存储和可用 API；通过平台验证后再开放用户 JS 导入。JS 源的来源、权限与更新需要可见且可撤销。JSON 静态源目前只是本地内容格式，不是可抓取网页的规则格式。

### 网络源契约（第二阶段）

JSON 网络源采用版本化声明式规则，至少定义源 ID、站点域名、搜索、详情、目录、正文四组请求与提取规则。每组规则显式规定 URL 模板、方法、编码、选择器、分页、正文清理和相对链接基址。导入时先校验 schema，再对用户指定的样例 URL 进行预览测试，成功后才启用。规则版本与当前静态内容格式分开，避免把 `version: 1` 静态 JSON 误当作在线抓取规则。

JavaScript 源对外暴露同样四个操作，但只能调用宿主提供的 `request`、`parseHtml` 和少量纯函数工具。宿主负责域名白名单、私有网络地址拦截、请求速率、响应体上限、执行截止时间和错误归一；脚本不能访问应用状态、文件系统或其他源的凭据。搜索结果必须经过统一 schema 校验才进入 UI。

## 数据与阅读链路

后续持久化建议以 `expo-sqlite` 为移动端主存储，Web 使用同构仓储接口实现；存书源配置、书架、阅读进度、章节元数据和缓存索引。正文按章节缓存，设置容量上限与过期策略，图片缓存独立清理。收藏、进度与导入应使用版本化迁移。搜索请求需去抖、取消过期结果、按源限流；列表虚拟化并给封面固定尺寸。阅读器需增加字号、行距、主题、翻页方式和进度同步。

建议的持久化表以 `source_id` 加本地 ID 作复合键：`sources` 保存类型、配置版本和启用状态；`books` 保存规范化元数据；`shelf` 保存收藏顺序；`chapters` 保存目录；`chapter_cache` 保存正文、大小和访问时间；`reading_progress` 保存章节 ID、段落位置和更新时间。迁移必须可回滚或可从书源重新构建缓存。UI 只依赖仓储接口，避免 SQLite、Web IndexedDB 和桌面外壳实现渗入页面。

在线书源经适配器进行请求。第二阶段的网络层应统一处理超时、重试、编码、重定向、站点访问策略及错误展示。部分站点存在反爬、版权或服务条款限制，只有明确允许的源才纳入分发。不要把账号密码交给书源脚本。

### 平台与交付

| 平台 | UI 与路由 | 数据 | 网络与发布 |
| --- | --- | --- | --- |
| Android | Expo Router + React Native | `expo-sqlite` | Expo 开发构建、EAS Build/Submit/Update |
| iOS | Expo Router + React Native | `expo-sqlite` | Expo 开发构建、EAS Build/Submit/Update |
| macOS | React Native Web + Tauri 桌面外壳 | IndexedDB 或桌面 SQLite 适配器 | Tauri 受控请求代理、macOS 签名与公证 |

Web 直接访问第三方站点可能受到 CORS 限制，桌面版通过外壳的受控请求代理保持与移动端相同的书源契约。Expo Web 的 `single` 输出可作为桌面外壳的前端资源；桌面打包、签名与公证在交付阶段完成。

## 阶段计划

1. **可运行骨架（当前）：** Expo Router、三类适配器契约、离线示例、书架／搜索／目录／阅读和 JSON 导入。状态仅在当前运行会话有效；重新启动后恢复默认书架，导入源需重新导入。
2. **可用阅读器：** 数据仓储和迁移、持久化书架与进度、章节缓存、阅读设置、网络请求层、JSON 声明式网络源格式与校验。
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

打开应用后，书架中的《星河邮差》可进入目录和阅读页；发现页可搜索所有已启用源；书源页可“加载示例”并导入 JSON 后搜索《第一本书》。移动端在 Expo Go 中运行当前阶段内容，无新增原生依赖。

## 参考资料

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [Expo Router](https://docs.expo.dev/router/introduction.md)
- [Expo 文档索引及 API 更正](https://docs.expo.dev/llms.txt)

当前环境对官方文档站点的请求多次超时，已读取上述页面返回的部分内容并用本地 SDK 58 类型、Expo CLI 及运行结果核对具体代码；开始下一阶段前应重新获取相关 API 的完整版本文档。
