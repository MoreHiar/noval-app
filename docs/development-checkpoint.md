# 开发节点与换机接续指南

记录日期：2026-11-23。当前开发分支：`main`，远程跟踪分支：`origin/main`。本记录与当前实现一同提交，具体提交号以 `git log -1 --oneline` 为准。

## 当前节点

已完成「离线阅读原型 + 阅读 / Legado 规则书源管理」。**下一阶段的主要工作是在线解析引擎；目前导入书源不代表可以从网站搜索或阅读。**

用户已经确认网站规则书源格式，以 https://yuedu.xiu2.xyz/ 及其书源 JSON 为参考。后续保持这些决定：

- 对外导入导出采用 `bookSourceName`、`bookSourceUrl`、`searchUrl`、`ruleSearch`、`ruleBookInfo`、`ruleToc`、`ruleContent` 等 Legado 字段。此前包含 `books`、`chapters` 的静态内容格式仅保留用于离线演示和旧本地数据恢复。
- 导入分为网络地址导入与本地 JSON 文件导入，本地页还支持粘贴。支持单个对象与对象数组，下载／校验后先预览，再确认保存。
- 以 `bookSourceUrl` 去除首尾空白后的值识别重复源，默认跳过，可选择覆盖。保留未知字段、脚本、请求头、登录及发现配置；导出不混入应用内部包装。
- 导入的脚本只作为配置保存，不在应用主 JavaScript 环境中执行。后续脚本运行需要隔离宿主。

## 已完成

- Expo Router 导航与书架、搜索、书源、我的四个页面；自定义 SVG 图标，修复 Web SVG 无障碍属性和动画兼容问题。
- 离线演示书籍的详情、目录、正文阅读及书架收藏；立体书架和列表视图。
- 网站规则书源新增、编辑、删除、启停、名称／网址／分组搜索和状态筛选。
- 网络下载 JSON（含取消、超时及错误提示），本地文件选择、粘贴、重复源跳过／覆盖，以及单个／全部导出。
- AsyncStorage 持久化书源和书架，键为 `noval.library.v1`；串行写入，落盘成功后更新界面，失败保留原有状态。
- 网站规则源与可执行的离线示例分开；界面明确提示当前在线解析未接入。

## 核心文件

| 路径 | 职责 |
| --- | --- |
| `src/domain/books.ts` | 书籍、章节、适配器、静态与规则书源类型 |
| `src/sources/legado.ts` | Legado 字段校验、源身份与格式模板 |
| `src/sources/management.ts` | 导入导出、合并覆盖、编辑删除、本地恢复与书架引用 |
| `src/sources/network.ts` | 书源列表下载；不会发送源配置内的 Cookie 或请求头 |
| `src/sources/files.ts`、`files.web.ts` | 原生与 Web 文件选择及导出 |
| `src/state/library.tsx` | 持久化状态、写入队列、演示适配器装配 |
| `src/app/(tabs)/sources.tsx` | 书源管理列表 |
| `src/app/source/import.tsx` | 网络／本地导入与预览 |
| `src/components/SourceEditor.tsx` | 基础字段及其他完整规则 JSON 编辑 |
| `src/sources/builtin.ts`、`javascript.ts`、`static.ts` | 离线示例与静态适配器，非网站抓取引擎 |

## 新电脑启动

本机已验证 Node.js `v22.22.2`，建议新电脑先使用相同版本。项目使用 npm 和 `package-lock.json`。

```bash
git clone YOUR_REPOSITORY_URL noval-app
cd noval-app
git switch main
git pull --ff-only origin main
npm ci
npx expo lint
npx tsc --noEmit
npx expo start
```

Web 开发可使用 `npx expo start --web`。如果已经有仓库，在工作区干净时切换到 `main` 并拉取最新提交即可。`node_modules/`、`.expo/`、原生生成目录和构建产物未纳入 Git，应在新电脑重新安装／生成。

当前版本使用 Expo `~58.0.26`、React `19.3.0`、React Native `0.88.1`。本次新增的依赖包括 AsyncStorage、`expo-document-picker`、`expo-file-system` 和 `expo-sharing`，兼容版本已经记录在锁文件中；已有自定义开发客户端需要重建以包含新增原生模块。当前仓库尚未配置 `eas.json`，也未完成原生安装包或 macOS 桌面交付。

**本地数据迁移：** Git 同步源码和文档。设备或浏览器中的书源、书架仍保存在各自的 AsyncStorage 中。需要保留书源时，在旧设备的「书源 → 全部导出」保存 JSON，再在新设备本地导入；目前没有跨设备书架、进度或账号同步功能。

## 已验证与复验步骤

本节点已经通过：

- `npx expo lint`、`npx tsc --noEmit` 和 `git diff --check`。
- XIU2 当时返回的 22 个真实书源：导入后导出字段值一致，脚本和未知字段保留；重复跳过／覆盖、编辑、删除与本地恢复验证通过。
- Chrome 390 × 844 移动视口：实际网络导入、导出后重新通过文件选择器导入、启停及刷新恢复；无横向溢出、无浏览器控制台报错。
- iOS、Android 的 JavaScript／资源导出打包成功。尚未在真实设备或原生安装包中验证文件选择、分享及运行行为。

上述解析断言、浏览器自动化脚本和截图在旧电脑的临时目录中，未纳入仓库，也未配置长期测试命令。新电脑可按以下流程复验，不依赖旧电脑的临时文件：

1. 打开书源页，进入网络导入，填入 `https://yuedu.xiu2.xyz/shuyuan`，下载预览后确认导入。远端书源数量可能变化。
2. 编辑一个书源名称并保存，切换启用状态，刷新确认保留。
3. 全部导出 JSON，通过本地文件导入，分别验证默认跳过和选择覆盖的结果。
4. 取消一次删除，再确认删除一个源，刷新确认结果；检查离线书架仍能打开示例正文。
5. 需要复验移动端打包时，运行 `npx expo export --platform ios --platform android --output-dir dist/native-check`。该检查不等同于原生设备测试。

## 后续开发顺序

1. 设计统一网络请求层与可执行规则适配器，处理超时、取消、编码、相对链接和分页；保持配置数据与执行结果分层。
2. 实现并测试 CSS／Legado 选择器、XPath、JSONPath、模板与正则替换，将搜索、详情、目录、正文串成可验证链路；不把缺少支持的规则显示为可用。
3. 实现隔离脚本宿主、`java` 兼容接口，以及 Cookie、登录、验证码浏览器交互。用户提供的复杂源依赖这些能力，不能直接用主环境 `eval` 替代。
4. 接入在线适配器后补充搜索去抖／取消／限流、真实结果缓存与书架元数据，完善进度、阅读设置和章节缓存。
5. 完成 iOS／Android 实机测试和 EAS 配置；macOS 目前使用 Web，Tauri 外壳和打包仍是后续计划。

继续工作前先读仓库根目录的 [AGENTS.md](../AGENTS.md)。涉及 Expo／React Native API 时重新按实际 Expo 主版本获取官方文档；依赖通过 `npx expo install` 添加，不手工创建或修改原生生成目录。详细约定见 [书源格式](book-sources.md) 和 [技术架构](architecture.md)。
