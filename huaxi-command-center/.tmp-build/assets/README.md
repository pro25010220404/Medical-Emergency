# 静态资源布局

| 目录 | 内容 |
|------|------|
| **`vendor/`** | 线上下载的 React 演示包 `index-BA_IO3dC.js`、`index-BRuArrdm.css` |
| **`theme/`** | 浅色主题与侧栏布局 CSS |
| **`backend/`** | JWT、API bridge、catalog、scenario 合并、启动与 `hxEnhance` |
| **`enhance/`** | 挂在 `app.html` 上的 DOM/路由补丁（侧栏、会诊、地图、转诊等） |
| **`static/`** | 备用 JSON / 图标（演示主数据用根目录 `/scenario.json`） |

**不要**在根目录 `public/assets/` 再堆新文件；按上表归类。

`app.html` 脚本列表由 `config/app-shell.manifest.mjs` 生成：`npm run sync:app-html`。
