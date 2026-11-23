# Noval 技术架构与实施计划

## 产品边界

Noval 是多书源小说阅读器。Android、iOS 使用 Expo 构建原生应用；macOS 第一阶段通过同一套 React Native Web 界面运行在浏览器中，正式桌面交付采用 Tauri 外壳打包 Expo 的单页 Web 构建。macOS 的网络与文件访问在桌面外壳中实现适配，不把 Expo/EAS 的 iOS 构建当作 macOS 构建。界面按窄屏优先设计，宽屏限制正文宽度。

第一阶段交付离线可运行的垂直切片：可切换的立体书架、跨源搜索、书籍详情、目录、正文阅读、阅读 / Legado 规则书源管理、内置源及可信 JavaScript 源示例。示例小说是原创占位内容，不依赖第三方小说站点。

书架采用 `Animated` 透视变换与横向手势切换，也可切换为普通列表。底部导航在支持的 iOS 26 设备上使用系统 Liquid Glass；其他 iOS 版本与 Web 使用 `expo-blur`，Android 使用半透明玻璃外观作为回退。新增的两个 Expo 模块均在 Expo Go 中可用。

## 分层

```text
src/app                 Expo Router 页面与导航
src/components          通用界面与视觉常量
src/state               书源及书架状态与本地持久化
src/domain/books.ts     书、章节及 SourceAdapter 契约
src/sources             内置、JSON 和可信 JS 适配器
```

可执行书源遵循相同的 `SourceAdapter`：`search`、`getBook`、`getChapters`、`getChapter`。书籍身份是 `(sourceId, bookId)`，避免不同书源的本地 ID 冲突。发现页对各源并发搜索，并保留成功源的结果；单一源报错不会让整个搜索失败。

目录接口仅返回 `ChapterMeta`，正文通过 `getChapter` 按需获取，避免打开长篇目录时把全书正文载入内存。适配器负责把不同站点的字段归一；页面不解析 HTML，也不直接发起站点请求。

### 书源配置与执行能力

网站书源使用阅读 / Legado 格式，以 `bookSourceName`、`bookSourceUrl`、`searchUrl`、`ruleSearch`、`ruleBookInfo`、`ruleToc`、`ruleContent` 等字段描述请求和提取规则。保留未知字段、脚本、请求头、登录及发现配置。新增及编辑、网络地址导入、本地 JSON 文件／粘贴导入、单个／批量导出均使用这个交换格式。重复项按 `bookSourceUrl` 识别，内部 ID 由地址编码生成，导出时不添加内部包装。

离线示例使用单独的静态适配器，可信 JS 示例随应用打包。它们只用于体验现有书架和阅读链路，不出现在网站规则书源管理中，也不混入规则书源导出。旧原型的静态数据仍可从本地存储恢复。

**当前边界：** 已实现规则配置管理，尚未实现在线解析引擎。网站规则不会伪装成可用适配器，也不会参与演示搜索。导入成功不代表网站可搜索、可阅读或可通过人机验证。

**脚本边界：** 不在应用主 JavaScript 环境中对用户提供的代码使用 `eval`、`Function` 或动态导入。规则中的 JavaScript 作为字符串保存及导出。后续需实现隔离执行宿主和 `java` 兼容接口、编码、Cookie、登录及浏览器验证；同时实现 CSS／Legado 选择器、XPath、JSONPath、模板、正则与分页。各平台验证完成后再将在线适配器接入搜索和阅读。

## 数据与阅读链路

当前使用 AsyncStorage 的 `noval.library.v1` 保存书源定义、启用状态和书架。所有写入串行执行，成功落盘后更新界面；首次加载失败时禁止修改并支持重试，不覆盖已有数据。删除源会清理相应书架引用，修改源地址迁移引用；覆盖在线规则不会因缺少静态书籍数组而删除收藏。导入重复项默认跳过，可显式覆盖。格式与导入说明见 [book-sources.md](./book-sources.md)。

后续大规模内容存储建议以 `expo-sqlite` 为移动端主存储，Web 使用同构仓储接口实现；存书源配置、书架、阅读进度、章节元数据和缓存索引。正文按章节缓存，设置容量上限与过期策略，图片缓存独立清理。收藏、进度与导入应使用版本化迁移。搜索请求需去抖、取消过期结果、按源限流；列表虚拟化并给封面固定尺寸。阅读器需增加字号、行距、主题、翻页方式和进度同步。

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

1. **可运行骨架（当前）：** Expo Router、适配器契约、离线示例、书架／搜索／目录／阅读；书源管理支持新增、编辑、删除、启停及阅读 / Legado 网络／本地 JSON 文件／文本导入、单个／全部导出，书源和书架已持久化。
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

打开应用后，书架中的《星河邮差》可进入目录和阅读页；搜索页体验离线搜索；书源页可通过 XIU2 JSON 地址或本地文件导入真实规则，验证字段保留、重复跳过／覆盖、编辑、启停、删除、导出及重启恢复。在线抓取不在当前验收范围。文件导入、导出和持久化使用 SDK 58 支持的模块，可在 Expo Go 运行；已有自定义开发构建需要重新构建以包含新增原生模块。

## 参考资料

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [Expo Router](https://docs.expo.dev/router/introduction.md)
- [Expo 文档索引及 API 更正](https://docs.expo.dev/llms.txt)

- [XIU2 阅读书源](https://yuedu.xiu2.xyz/)

已读取 Expo SDK 58 及相应模块的版本文档，并结合本地类型和 CLI 核对 API。
