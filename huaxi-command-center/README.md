# 华西 · 县域急危重症救治一体化指挥中心

架构说明见 **[docs/FRONTEND-ARCHITECTURE.md](docs/FRONTEND-ARCHITECTURE.md)**。

## 双入口（当前默认）

| 入口 | 说明 |
|------|------|
| **`app.html`** | **演示 / 验收 / 部署主 SPA**（`vendor/index-BA_IO3dC.js` + `enhance/` + 侧栏） |
| **`index.html`** | 登录页，成功后进入 `app.html` |
| **`src-shell.html`** | React **源码壳**（`src/main.tsx`，迁移中；表格/debug UI，非 1:1 演示） |
| **`index.devtools.html`** | 早期调试入口（可选） |

- 演示：`npm run dev` → **http://localhost:5173/app.html#/**
- 源码联调：**http://localhost:5173/src-shell.html#/**
- API：开发走 `/backend-api` 代理（见 `vite.config.ts`）
- 环境：复制 `.env.example` 为 `.env`

**勿在 `app.html` 挂载 `/src/main.tsx`**，否则多数路由会显示 API 字段表格。

### 静态资源目录

| 路径 | 作用 |
|------|------|
| `public/assets/vendor/` | 线上下载的 React bundle + 基础 CSS |
| `public/assets/enhance/` | 侧栏、会诊、地图等产品补丁 |
| `public/assets/backend/` | JWT、bridge、catalog、scenario |
| `public/assets/theme/` | theme-light、sidebar 布局 CSS |
| `config/app-shell.manifest.mjs` | `app.html` 脚本清单（`npm run sync:app-html`） |

### 源码目录（逐步替换 bundle）

| 路径 | 作用 |
|------|------|
| `src/lib/apiClient.ts` | TypeScript JWT 客户端 |
| `src/routes/meta.ts` | 路由元数据 |
| `src/routes/apiBindings.ts` | 每页 GET 绑定 |
| `src/context/AuthContext.tsx` | 登录 / `/auth/me` |

交付标准：**bundle + enhance**；`src/pages/*` 为迁移中的 API 壳。

## 快速开始

```bash
cd huaxi-command-center
npm install
npm run dev
```

### 维护 app.html 脚本列表

增删 enhance 后编辑 `config/app-shell.manifest.mjs`，然后：

```bash
npm run sync:app-html
npm run verify:app-shell
```

### 开发：点击跳转源码（code-inspector）

仅在 `npm run dev` 下生效。bundle 内组件无法精确跳转；可跳转 `src-shell.html`、`dispatch.html` 等。

### 子应用入口

| URL | 说明 |
|-----|------|
| http://localhost:5173/dispatch.html | 120 急救调度（Vue） |
| http://localhost:5173/gis-command.html | GIS 指挥大屏 |
| http://localhost:5173/meeting-portal.html | 会议 MVP 门户 |
| http://localhost:5173/smart-city.html | 智慧城市 3D 演示 |

## 本地资源

| 路径 | 说明 |
|------|------|
| `public/assets/vendor/index-*.js` / `*.css` | 演示前端包 |
| `public/scenario.json` | 演示数据（全后端模式下由 bridge 覆盖） |
| `reference/original-index.js` | 未压缩对照 |

```bash
npm run restore:original   # 重新拉取远程 bundle 到 vendor/
npm run patch:map
npm run verify:backend-api
npm run verify:app-shell
```

## 构建 / 预览

```bash
npm run build
npm run preview
```

构建产物含多个 HTML 入口；**生产演示请部署 `app.html` + `public/assets/**`**。
