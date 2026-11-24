# 书源格式与导入

书源采用「阅读 / Legado」的网站规则格式。一个书源描述网站地址、搜索请求、书籍详情、目录和正文的提取规则。

参考地址：

- 分享页：https://yuedu.xiu2.xyz/
- 直接返回书源数组的地址：https://yuedu.xiu2.xyz/shuyuan
- 原项目：https://github.com/XIU2/Yuedu

## 导入方式

在「书源 → 导入」中选择：

1. **网络导入**：输入直接返回 JSON 的 HTTP(S) 地址，下载并预览后确认导入。提供「填入 XIU2 地址」按钮；不会自动导入。链接不需要以 `.json` 结尾。下载有 25 秒超时，可取消。返回网页时会提示改用 JSON 地址；网页版遇到 CORS 限制时可改为下载文件后本地导入。
2. **本地 JSON 导入**：选择设备上的 JSON 文件，也可以粘贴 JSON 内容，校验并预览后确认导入。

支持单个书源对象和书源对象数组，支持 UTF-8 BOM。批量内容全部校验通过后才会保存。相同 `bookSourceUrl`（去除首尾空白）视为重复书源；默认跳过，也可以明确选择覆盖。不会将 `http`、`https` 或不同路径合并为一个地址。文件内部有重复地址时提示错误，避免隐式丢弃条目。

## 结构示例

这是用于说明格式的占位网站，不能搜索真实书籍：

```json
[
  {
    "bookSourceName": "示例书源",
    "bookSourceUrl": "https://example.com",
    "bookSourceType": 0,
    "bookSourceGroup": "自定义",
    "bookSourceComment": "请替换为实际网站与解析规则",
    "enabled": true,
    "enabledCookieJar": true,
    "enabledExplore": false,
    "searchUrl": "/search?keyword={{key}}&page={{page}}",
    "ruleSearch": {
      "bookList": ".book-list li",
      "name": "a@text",
      "author": ".author@text",
      "bookUrl": "a@href",
      "coverUrl": "img@src"
    },
    "ruleBookInfo": {
      "name": "h1@text",
      "author": ".author@text",
      "intro": ".intro@text",
      "tocUrl": ".catalog@href"
    },
    "ruleToc": {
      "chapterList": ".chapter-list a",
      "chapterName": "text",
      "chapterUrl": "href"
    },
    "ruleContent": {
      "content": "#content@html"
    }
  }
]
```

`bookSourceName`、`bookSourceUrl` 必填且不能为空；其他字段允许缺省，以兼容不含搜索或发现入口的源。`enabled` 缺省时，管理界面按启用处理。导入校验对象结构与已知字段类型，不将其视为规则可执行性、网络可用性或网站健康检查。

`ruleSearch`、`ruleBookInfo`、`ruleToc`、`ruleContent`、`ruleExplore` 为规则对象。`exploreUrl`、`header`、`loginUi` 等字段可能本身是 JSON 字符串；`searchUrl`、`loginUrl`、各规则也可能包含 JavaScript。导入时保留这些字符串，不把它们当普通 URL 解析或发送请求。

未知字段、规则字段和脚本都保留在原对象中。导出单个书源为对象，全部导出为数组；不添加 Noval 的内部 ID、存储版本或其他包装。JSON 的空白与缩进会重新格式化，字段值保持不变，启停操作会更新 `enabled`。导出的文件可以再次导入。

## 管理与保存

书源页显示名称、网站地址、分组、内容类型、发现入口及启用状态，支持查找、筛选、新增、编辑、启停、删除和导出。编辑页上方填写名称、网址、分组、说明和启用状态，下方编辑其他完整规则 JSON，保留未修改的原始字段。修改地址后会检查冲突。

默认内置番茄小说书源，使用 `novel.snssdk.com` 的公开搜索接口。它可以单独禁用，也参与「全部启用」和「全部禁用」，但不能编辑、删除或由导入规则覆盖。「批量删除」不会选中内置源。其余书源可逐项删除或批量删除；确认弹窗显示删除数量及将移除的书架收藏数。

SQLite 数据库 `noval-library.db` 保存书源配置与书架，首次启动从 AsyncStorage 的 `noval.library.v1` 一次性迁移。写入串行并使用事务，保存成功后更新界面；存储失败时保留原有状态并显示错误。升级时会移除旧 `sample-library` 演示书库及其书架项，补入番茄默认源；其他已导入书源和禁用状态保持不变。可信 JavaScript 离线示例仍可阅读。

## 当前执行能力

搜索页会调用已启用书源，空关键词仅展示离线示例，不请求网站。输入有 350 ms 防抖，最多同时请求三个源，更换关键词或离开页面时取消旧请求；按源逐步展示结果、来源和错误。列表使用 FlatList。每次仅请求搜索第一页（`page = 1`），最多保留每源前 100 条结果。

支持的搜索规则：

- `searchUrl` 中的 `{{key}}`（UTF-8 URL 编码）、`{{page}}`、`{{baseUrl}}`，以及第一页等效的 `{{(page-1)*10}}`。
- 普通 GET，以及 `URL,{'method':'POST','body':'keyword={{key}}'}` 形式的 UTF-8 POST 文字请求体。请求选项使用 JSON5 数据解析，不执行代码。
- CSS 选择器，以及 `class.item`、`tag.h3.0@tag.a.0`、`.odd.1`、`tr!0` 等 Legado 遍历／索引规则；`@text`、`@href`、`@src` 和其他属性提取；`##正则##替换`。
- JSON 响应的基础 JSONPath：属性、方括号属性、数组索引及 `[*]` 通配符，例如 `$.data`、`$.data[0]`、`$['title']`。列表支持末尾的字符串等值过滤，如 `$.data.ret_data[?(@.genre == '0')]`。字段支持 `$.title` 以及 `/novels/api/book/{{$.book_id}}` 形式的 JSONPath 模板。不支持递归、复杂筛选或脚本表达式。
- 静态 JSON 请求头（移除 Cookie、Host、Connection 和 Content-Length）。不维护登录或 Cookie 会话。

缺少搜索入口、脚本、XPath、复杂 JSONPath、非 UTF-8 请求编码及不支持的必填规则会在请求前报告原因。暂不支持的可选作者／分类／简介规则回退为空或默认值，避免影响可提取的书名和链接。每源 20 秒超时，响应有 5 MB 大小检查。识别到的网站防护页会显示验证提示；网站返回的 HTTP 403／503、DNS 失效与网络中断仍会显示为失败。

Web 搜索通过同源 `/api/source-fetch` 转发，不再由浏览器直接跨域请求网站。Expo 的 `web.output` 使用 `server`，修改配置后须重启开发服务；生产环境须部署导出的服务端，纯静态托管无法运行搜索转发。转发服务仅接受配置域名并检查公网地址和每次重定向，默认包含当前 XIU2 列表的域名。其他书源或重定向域名需由服务维护者通过 `NOVAL_SOURCE_HOSTS` 添加（英文逗号分隔准确域名，修改后重启服务），导入书源不会自动扩大服务端允许范围。转发服务有 18 秒超时和 5 MB 响应上限，不维护登录会话，也不绕过网站防护。

原生端仍直接访问网站，HTTP 明文站点可能被系统网络策略阻止。已单独确认 `appi.kuwo.cn` 的 HTTPS 接口可用，酷我搜索请求自动使用 HTTPS，保存的原始书源定义不变。搜索统计将有结果、未匹配、请求失败及规则未支持分别计数，离线示例单列。

旧版速读谷（`www.sudugu.co`、`bookList: class.bookbox`）已加入兼容处理：直接向已验证的新域名 `www.sudugu.cc` 提交搜索，避免旧域名的 301 跳转丢失 POST 关键词；解析当前列表，以及唯一命中后跳转的详情页。只对识别出的旧版规则替换执行规则，自定义规则及存储／导出原文保持不变。详情页在这里只用于提取搜索命中信息，目录与正文仍未接入。艾途旧域名当前跳到其他域名，未经验证的目标仍会被阻止，并在错误中显示域名。

搜索提取可选 `ruleSearch.coverUrl` 并解析相对／协议相对链接；也可指定 `coverFallbackUrl` 供图片失败时重试。内置番茄源使用 `thumb_url`，失败时尝试 `audio_thumb_uri`，仍失败则回退文字封面。旧速读谷列表缺少图片时，按其原规则中的固定路径计算封面地址，不执行原 JavaScript。

页面分别统计有结果、未匹配、请求失败及规则未支持，可展开每个源的结果数。未匹配只表示本次响应未提取到书，不保证该网站未收录；HTML 规则失效也可能导致未匹配。JSON 缺失列表及接口错误码会单独报错，不当作正常空列表。实时检查中，酷我对“我有”返回 30 本，对“皮嫁骨”返回空列表；速读谷则对“皮嫁骨”返回《皮嫁骨，雨中戏，诡异入侵我杀疯了》，因此不能直接用两个不同关键词判断设备差异。

结果详情展示搜索得到的信息，可加入书架或从书架移除。收藏仅持久化书籍基本信息和封面链接，简介限制 4000 字符；重启后可从 SQLite 恢复书架和详情，禁用书源仍保留收藏，删除书源会清理关联收藏。未收藏搜索结果仅保留当前适配器内存缓存（每源最多 100 本），重启后需重新搜索。不抓取在线详情、目录或正文；完整离线阅读仍可使用。脚本宿主、复杂规则、其他编码、分页和在线阅读是后续工作。

Web 的 SQLite 使用 WebAssembly，需要重启开发服务以加载 `metro.config.js` 的 wasm 支持及 COOP／COEP 响应头。生产部署同样需要这些响应头，Expo Hosting 的配置已在 `expo-router` 插件中声明。书架回归测试使用 `npm run test:shelf`。

可运行 `npm run test:search` 验证选择器、JSONPath、编码、链接去重、请求配置、错误、取消、并发上限及转发限制。2026-11-24 使用公开酷我书源搜索“斗罗”，Web 适配器经本地 Expo 转发服务访问真实接口得到 30 本书；原生默认传输代码在 Node 中直接访问真实 HTTPS 接口也得到 30 本。iOS／Android／Web 资源导出通过，手机实机仍需复测。自动回归使用合成数据，不代表全部第三方书源在线可用。
