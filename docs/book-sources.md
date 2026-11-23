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

AsyncStorage 保存书源配置与书架。写入串行进行，保存成功后更新界面；存储失败时保留原有状态并显示错误。已有离线演示内容仍可阅读，但不会作为网站规则书源显示或导出。旧原型的本地静态内容可继续恢复，不再作为对外导入格式。

## 当前执行能力

本次完成规则书源的管理、网络／本地导入及原格式导出。**在线搜索、网页解析、目录／正文抓取及 Legado JavaScript 宿主尚未实现。** 导入成功仅表示配置已保存。搜索页当前仍提供离线演示内容。

后续解析引擎需要支持 CSS／Legado 选择器、XPath、JSONPath、模板、正则替换、请求参数与编码、分页，以及隔离的脚本宿主。涉及 `java.ajax`、Cookie、登录、验证码和浏览器交互的源还需要相应平台能力；保存这些规则不等于已经实现其功能。不会在应用主 JavaScript 环境中执行导入的脚本，也不会把书源中的请求头或 Cookie 用于下载源列表。
