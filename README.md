# TabNest

> **一个更智能的新标签页。** Organize Tab 将 Chrome 默认的新标签页替换为一个清爽的控制台——按域名分组展示所有已打开的标签，一键批量关闭，稍后阅读，归零开始。

---

# 目录

- [功能介绍](#功能介绍)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [配置说明](#配置说明)
- [架构设计](#架构设计)
- [更新日志](#更新日志)

---

## 功能介绍

### 核心功能

| 功能 | 说明 |
|---|---|
| **按域名分组** | 所有已打开的标签按域名自动归组，以卡片形式展示 |
| **首页分组** | Gmail、X、LinkedIn、YouTube、GitHub 等被聚合到顶部"首页"卡片 |
| **批量关闭** | 一键关闭某个域名的所有标签 |
| **单个关闭** | 关闭单个标签，伴随嗖嗖音效 + 彩纸动画 |
| **重复检测** | 相同 URL 的标签被标记为 `(Nx)` 徽章 |
| **跳转标签** | 点击任意标签标题即可跳转到该标签（跨窗口有效） |
| **稍后阅读** | 关闭前将标签保存 → 进入"稍后阅读"清单 |
| **自身去重** | 若打开多个 Organize Tab 新标签页，顶区横幅允许保留其中一个 |

### 进阶功能

| 功能 | 说明 |
|---|---|
| **面板自动刷新** | 其他窗口标签变化时，面板通过 `chrome.runtime` 消息自动刷新 |
| **标题清洗** | GitHub issues/PR、X 帖子、Reddit 帖子、Substack 文章都有专项处理 |
| **自定义首页规则** | 在 `config.local.js` 中定义自己的"首页"匹配规则 |
| **自定义域名分组** | 将任意域名聚合到一个带标签的卡片 |
| **归档 + 搜索** | 完成的"保存"标签进入归档，支持按标题或 URL 搜索 |
| **零外部请求** | 完全离线——无 Google Fonts CDN，无分析服务，无服务器 |

### 设计特性

| 功能 | 说明 |
|---|---|
| **浅色 / 深色 / 跟随系统** | 三档主题切换（右上角按钮），本地存储持久化 |
| **暖色清新风格** | 薄荷绿 + 柔珊瑚色系，如清晨花园般清爽 |
| **流畅微动效** | 卡片加载淡入、悬停上浮、标签关闭过渡、弹簧动画 Toast |
| **彩纸爆发动画** | 关闭标签时触发彩色粒子彩纸（纯 CSS + JS，无第三方库） |
| **嗖嗖音效** | 通过 Web Audio API 程序合成，无需音频文件 |
| **系统字体** | 使用操作系统字体栈，无需加载外部字体 |

---

## 快速开始

### 前置要求

- **Chrome**（或任意基于 Chromium 的浏览器：Edge、Brave、Arc 等）
- **Node.js** 18+（仅开发 / 重新构建时需要）

### 安装步骤

**第一步 — 构建（或直接使用预构建版本）**

```bash
# 若使用预构建的 dist/（推荐普通用户）：
# 无需构建步骤，dist/ 已包含最新版本。

# 若修改了代码：
npm install
npm run build      # 输出到 dist/
```

**第二步 — 加载到 Chrome**

1. 打开 `chrome://extensions`
2. 右上角：开启 **开发者模式**
3. 左上角：点击 **加载已解压的扩展程序**
4. 选择项目根目录下的 `dist/` 文件夹并确认

> 扩展现已生效。打开一个**新标签页**，即可看到 Organize Tab。

### 更新扩展

```bash
npm install
npm run build
```

然后打开 `chrome://extensions`，点击 Organize Tab 卡片的 **🔄 重新加载**按钮。

---

## 项目结构

```
organize-tab/
├── index.html              # 新标签页 HTML 骨架
├── main.js                 # 入口（启动、主题、事件、渲染）
├── manifest.json           # 扩展清单（MV3）
├── background.js           # Service Worker（角标计数）
├── modules/
│   ├── i18n.js            # 中英双语翻译系统
│   ├── tabs.js            # Chrome Tab API — 查询、关闭、跳转、去重
│   ├── storage.js         # chrome.storage.local — 保存/读取"稍后阅读"
│   ├── grouping.js        # 首页检测、域名分组、标题清洗
│   ├── render.js          # 所有 DOM 渲染函数
│   ├── events.js          # 全局点击事件委托 + 所有处理器
│   └── ui.js              # 音效、彩纸、Toast、主题切换
├── styles/
│   └── base.css            # 完整设计系统（CSS 变量、全部组件）
├── icons/                  # 扩展图标（16/48/128px）
├── dist/                   # 构建产物（加载到 Chrome）
├── vite.config.js          # Vite 构建配置
└── package.json
```

---

## 开发指南

### 技术栈

- **Vite 5** — 打包工具 / 开发服务器
- **原生 JavaScript** — 无框架、无运行时依赖
- **ES Modules** — 所有代码使用 `import`/`export`
- **Chrome Extension Manifest V3** — Service Worker 后台

### 开发流程

```bash
# 启动热重载开发服务器（直接服务 src/ 文件）
npm run dev

# 完成开发后构建生产版本
npm run build

# 清理构建产物
npm run clean
```

> **注意：** `npm run dev` 不会自动安装扩展。如需实时测试，使用 `npm run build` 后在 Chrome 中重新加载。

### 构建流程

```
项目根目录/
  ├── index.html        ← Vite 入口
  ├── main.js          ← ES 模块入口
  ├── modules/*.js     ← ES 模块（自动解析 import）
  └── styles/base.css  ← CSS 入口

        ↓  vite build

dist/
  ├── index.html        （经 Vite 处理）
  ├── index.js         （打包后）
  ├── assets/style.css  （提取的 CSS）
  ├── manifest.json     （从根目录复制）
  ├── background.js     （从根目录复制）
  ├── config.local.js   （若存在则复制）
  └── icons/            （从根目录复制）
```

构建后的 `index.html` 使用相对路径（`./index.js`、`./assets/style.css`），可直接通过 `file://` URL 打开，或在 `chrome-extension://` 中正常运行。

### 添加新模块

1. 在 `modules/` 下创建文件，例如 `modules/yourModule.js`：
   ```js
   export function doSomething() { /* ... */ }
   ```

2. 在 `main.js`（或其他模块）中导入：
   ```js
   import { doSomething } from './modules/yourModule.js'
   ```

3. 运行 `npm run build` — Vite 自动处理打包。

### 中英双语

UI 文本默认中文，通过右上角 **EN/中** 按钮切换为英文。

翻译系统位于 `modules/i18n.js`，工作方式：

- **HTML 静态文本**：`<span data-i18n="key.subkey">` → 框架自动填充
- **JS 动态文本**：`import { t } from './i18n.js'` → `t('toast.savedTab')`
- **翻译键格式**：点号分隔，例如 `toast.closedGroup`、`section.openTabs`

---

## 配置说明

### 个人设置（`config.local.js`）

在 **`dist/config.local.js`**（gitignore 掉，不会推送到仓库）创建此文件：

```js
// ── 自定义首页规则 ────────────────────────────────────────────
// 添加或覆盖哪些 URL 算作"首页"（显示在顶部卡片中）

LOCAL_LANDING_PAGE_PATTERNS = [
  // 示例：你的 Notion 工作空间首页
  {
    hostname: 'www.notion.so',
    pathExact: ['/your-workspace-id'],
  },
  // 示例：任意子域名的根路径
  {
    hostnameEndsWith: '.linear.app',
    pathExact: ['/'],
  },
]

// ── 自定义域名分组 ─────────────────────────────────────────────
// 将多个域名聚合到一个带标签的卡片

LOCAL_CUSTOM_GROUPS = [
  {
    groupKey:  'work-tools',
    groupLabel: '工作工具',
    hostname:  'github.com',
  },
  {
    groupKey:  'work-tools',
    hostname:  'linear.app',
  },
  {
    groupKey:  'work-tools',
    hostname:  'figma.com',
  },
]
```

> 修改 `config.local.js` 后，运行 `npm run build` 将其复制到 `dist/`。

### 主题偏好

点击右上角的太阳/月亮图标，可选：

- **浅色** — 薄荷白配色
- **深色** — 深森林绿配色
- **跟随系统** — 与操作系统 `prefers-color-scheme` 同步

存储在 `localStorage`（`organizetab-theme`），跨会话持久化。

---

## 架构设计

### 数据流

```
打开新标签
      │
      ▼
index.html 加载
  │
  ├─▶ main.js: DOMContentLoaded
  │     ├─ initI18n()          — 初始化语言翻译
  │     ├─ initTheme()         — 读取 localStorage，应用 CSS 变量
  │     ├─ initEvents()        — 设置全局点击委托
  │     ├─ renderDashboard()   — 获取标签 + 渲染页面
  │     └─ chrome.runtime.onMessage — 监听 'tabs-changed'
  │
  ▼
renderDashboard()
  ├─ fetchOpenTabs()            → chrome.tabs.query({})
  ├─ groupTabs()               → grouping.js（域名 + 首页 + 自定义）
  ├─ renderDomainCard() × N     → render.js（DOM 字符串构建）
  └─ renderDeferredColumn()     → storage.js（chrome.storage.local）
```

### 事件委托

所有交互均通过 `events.js` 中的单一 `document.addEventListener('click', ...)` 处理，路由由 `data-action` 属性分发：

```
点击 → [data-action="focus-tab"]         → focusTab()
点击 → [data-action="close-single-tab"]  → closeTabsExact() + 彩纸
点击 → [data-action="close-domain-tabs"] → closeTabsByExactUrl() + 卡片淡出
点击 → [data-action="defer-single-tab"]  → saveTabForLater() + 关闭
点击 → [data-action="check-deferred"]    → checkOffSavedTab()
点击 → [data-action="dedup-keep-one"]    → closeDuplicateTabs()
...
```

### 自身重复标签横幅

`background.js` 作为 Chrome Service Worker 运行，追踪有多少个 Organize Tab 新标签页处于打开状态。当用户打开新标签时，`main.js` 检测重复并显示横幅。

### 自动刷新

`background.js` 监听 `chrome.tabs.onCreated` / `chrome.tabs.onRemoved`，向 `index.html` 发送 `tabs-changed` 消息。`main.js` 收到后重新渲染仪表板，保持与当前标签状态的同步。

### 配色系统

所有颜色均为 CSS 自定义属性。切换主题时设置 `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`，覆盖 `base.css` 中定义的变量值。

---

## 更新日志

### v2.0.0 — 2026-04-15

**破坏性变更：**

- 从单文件架构完全重写为模块化 ES Modules 架构
- 引入 Vite 构建工具替代原始文件部署

**新增功能：**

- 浅色 / 深色 / 跟随系统三档主题切换
- 通过 background 消息实现面板自动刷新
- 自定义首页匹配规则（`LOCAL_LANDING_PAGE_PATTERNS`）
- 自定义域名分组（`LOCAL_CUSTOM_GROUPS`）
- 针对 GitHub、X、Reddit、Substack 的智能标题清洗
- 归档 + 搜索已保存标签
- Organize Tab 自身重复标签检测横幅
- 中英双语支持

**问题修复：**

- 移除 Google Fonts CDN — 改用系统字体栈
- `close-all` 从 hostname 匹配改为精确 URL 匹配（避免误关同域名下其他标签）

---

## License

MIT — 详见 [LICENSE](LICENSE)。

---

---

# README (English)

---

## Features

### Core

| Feature | Description |
|---|---|
| **Domain grouping** | All open tabs are automatically grouped by domain, displayed as cards |
| **Homepages group** | Gmail, X, LinkedIn, YouTube, GitHub, etc. are pulled into a special "Homepages" card at the top |
| **Bulk close** | Close all tabs from one domain with a single click |
| **Single tab close** | Close individual tabs with a satisfying swoosh sound + confetti burst |
| **Duplicate detection** | Tabs with the same URL are flagged with a `(Nx)` badge |
| **Jump to tab** | Click any tab title to instantly switch to that tab (works across windows) |
| **Save for later** | Bookmark a tab before closing it → appears in the "Saved for later" checklist |
| **Self deduplication** | If multiple Organize Tab new-tab pages are open, a banner lets you keep just one |

### Advanced

| Feature | Description |
|---|---|
| **Panel auto-refresh** | When tabs change in other windows, the panel refreshes automatically via `chrome.runtime` messaging |
| **Title cleaning** | GitHub issues/PRs, X posts, Reddit threads, Substack articles get readable smart titles |
| **Custom landing patterns** | Define your own "homepage" rules in `config.local.js` |
| **Custom domain groups** | Group arbitrary domains together with custom labels |
| **Archive + search** | Completed "saved" tabs go to archive; search them by title or URL |
| **Zero external requests** | Fully offline — no Google Fonts CDN, no analytics, no servers |

### Design

| Feature | Description |
|---|---|
| **Light / Dark / System** | Three-tier theme toggle (top-right button), persisted in `localStorage` |
| **Warm & Fresh aesthetic** | Mint green + soft coral palette, inspired by a "morning garden" |
| **Smooth micro-animations** | Card fade-in on load, hover lift, chip close transitions, spring-eased toasts |
| **Confetti burst** | Closing tabs triggers colorful particle confetti (CSS + JS, no library) |
| **Swoosh sound** | Synthesized via Web Audio API — no audio files needed |
| **System fonts** | Uses the OS font stack, no external font requests |

---

## Quick Start

### Prerequisites

- **Chrome** (or any Chromium-based browser: Edge, Brave, Arc)
- **Node.js** 18+ (only needed for development / rebuilding)

### Installation

**Step 1 — Build or use the pre-built version**

```bash
# Using the pre-built dist/ (recommended for users):
# No build step needed. dist/ is already built and ready.

# If making code changes:
npm install
npm run build      # Output → dist/
```

**Step 2 — Load into Chrome**

1. Open `chrome://extensions`
2. Top-right: toggle **Developer mode** ON
3. Top-left: click **Load unpacked**
4. Navigate to the `dist/` folder and confirm

> The extension is now active. Open a **new tab** and you should see Organize Tab.

### Updating

```bash
npm install
npm run build
```

Then go to `chrome://extensions` and click the **🔄 Reload** button on the Organize Tab card.

---

## Development Guide

### Tech Stack

- **Vite 5** — bundler / dev server
- **Vanilla JS** — no framework, no runtime dependencies
- **ES Modules** — all code uses `import`/`export`
- **Chrome Extension Manifest V3** — service worker background

### Dev Workflow

```bash
# Start a live-reload dev server (serves src/ files directly)
npm run dev

# When done, build for production
npm run build

# Clean build output
npm run clean
```

> **Note:** `npm run dev` does not auto-install the extension. For live testing, use `npm run build` and reload in Chrome.

### i18n

UI defaults to Chinese. Click the **EN/中** button in the top-right corner to switch to English.

The translation system is in `modules/i18n.js`:

- **HTML static text**: `<span data-i18n="key.subkey">` → auto-filled
- **JS dynamic text**: `import { t } from './i18n.js'` → `t('toast.savedTab')`
- **Key format**: dot-separated, e.g. `toast.closedGroup`, `section.openTabs`

---

## License

MIT — see [LICENSE](LICENSE).
