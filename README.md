# 马克档 · Markdown Mobile Browser

> 你的随身文档浏览器 · Single-File Markdown,Works Everywhere

[![Release](https://img.shields.io/github/v/release/liuhua1202/markdoc)](https://github.com/liuhua1202/markdoc/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Web%20%7C%20Android%20%7C%20macOS%20%7C%20Windows%20%7C%20Linux-green)]()

**马克档** 是一个轻量的 Markdown 阅读 + 编辑 + 同步应用,所有平台的 UI 全部由 **一个 `index.html` 渲染**(200KB 不到),通过渐进增强在不同设备上提供最佳体验。

```
┌──────────────────────────────────────────────────────────┐
│  index.html (200 KB)                                     │
│  ├─ 解析:marked.js  +  highlight.js  +  KaTeX  +  Mermaid│
│  ├─ 编辑:CodeMirror 6                                    │
│  ├─ 状态:Zustand-like reactive store                     │
│  └─ 主题:亮/暗/4 种阅读模式/3 种字体/4 种字号            │
└──────────────────┬───────────────────────────────────────┘
                   │  同一份代码,四种形态
       ┌───────────┼───────────┬──────────────┐
       ▼           ▼           ▼              ▼
   🌐 Web      📱 Android   🖥️ macOS/      📱 iOS
   (PWA)      (WebView)    Win/Linux       (WebView)
                            (Electron)
```

---

## ✨ 功能

- **📝 完整 Markdown** — GFM 表格 / 任务列表 / 删除线 / 脚注
- **🎨 4 种阅读主题** — 浅色 / 深色 / 羊皮纸 / 护眼
- **🔍 即时搜索** — 标题 + 全文,正则,高亮
- **🔎 查找替换** — 整文档,正则,大小写选项
- **📑 多标签** — 同一会话打开多个文档,左右滑动切换
- **☁️ WebDAV 同步** — 坚果云 / 阿里云盘 / Nextcloud / 自建
- **🤖 AI 助手** — 5 种预设(总结/翻译/解释/纠错/扩写)+ 自定义
- **📋 模板库** — 内置 8 种常用文档模板
- **💾 离线优先** — 全部存 LocalStorage / 文件系统,无网照用
- **🖼️ 数学公式** — KaTeX,块级 + 行内
- **📊 图表** — Mermaid,流程图/时序图/类图/甘特图
- **💻 代码高亮** — highlight.js,180+ 语言
- **📲 PWA** — 添加到主屏幕,全屏,无浏览器 UI

---

## 🚀 快速开始

### Web(0 配置)

```bash
# 任意 HTTP server
python3 -m http.server 8000
# 打开 http://localhost:8000

# 或一键
npx serve .
```

### Android(本地构建)

```bash
cd android-app
./gradlew assembleDebug
# APK 在 app/build/outputs/apk/debug/
```

### 桌面(macOS / Windows / Linux)

```bash
cd desktop-app
npm install
npm start                    # 开发
npm run build:mac            # 打包 macOS
npm run build:win            # 打包 Windows
npm run build:linux          # 打包 Linux
```

### iOS

```bash
cd ios-app
pod install
open MarkdownPad.xcworkspace
# 用 Xcode 跑
```

---

## 📦 下载

**[GitHub Releases](https://github.com/liuhua1202/markdoc/releases)** — 所有平台最新版

| 平台 | 文件 |
|---|---|
| macOS (Intel) | `马克档-*.dmg` |
| macOS (M1/M2/M3) | `马克档-*-arm64.dmg` |
| Windows | `马克档-*-x64.exe` |
| Linux | `马克档-*.AppImage` |
| Android | `*.apk` |
| Web | `makemdown-pwa.zip` |

---

## 🏗️ 架构

**单仓多端(Single-Repo Multi-Platform)**:一个 `index.html` 驱动全部 4 个平台,通过 `platform` 变量和模块化条件加载。

```
markdown/
├── index.html              # ⭐ 核心文件,所有平台共享
├── vendor/                 # 第三方库(marked/highlight/KaTeX/Mermaid)
│   ├── marked.min.js
│   ├── highlight.min.js
│   ├── katex.min.js
│   ├── mermaid.min.js
│   └── ...
├── icons/                  # PWA 图标
│   ├── icon-192.png
│   └── icon-512.png
├── logo.svg
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker(离线)
│
├── public/                 # Web 部署目录(从根复制)
│
├── android-app/            # Android WebView 包装
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── assets/     # 同步 index.html + vendor
│   │   │   ├── kotlin/     # MainActivity + Theme
│   │   │   └── res/        # 启动图、icon
│   │   └── build.gradle.kts
│   └── gradle/
│
├── desktop-app/            # Electron 桌面
│   ├── src/
│   │   ├── main.js         # 主进程
│   │   ├── preload.js
│   │   └── index.html      # 软链接或同步自根
│   ├── build/
│   │   ├── entitlements.mac.plist
│   │   └── icon.icns
│   ├── tools/
│   │   └── build-mac.py    # Windows→macOS 跨平台打包
│   └── package.json
│
├── ios-app/                # iOS WKWebView
│   ├── www/                # 同步 index.html
│   ├── MarkdownPad/
│   │   ├── ViewController.swift
│   │   └── Info.plist
│   └── Podfile
│
├── docs/                   # 文档
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── RELEASE-WORKFLOW.md
│   └── SIGNING-SETUP.md
│
└── .github/
    └── workflows/
        ├── release.yml     # tag 触发,构建全平台
        ├── ci.yml          # PR 检查
        ├── build.yml       # 手动单平台构建
        └── pages.yml       # Web 部署
```

详细架构见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 🤝 怎么贡献

欢迎 PR!但请注意:

1. **核心改动请改 `index.html`** — 不要直接改 `android-app/app/src/main/assets/index.html`
2. **CI 会自动同步** — 提交后,GitHub Actions 会把 `index.html` 复制到各平台
3. **跑测试** — `python3 tests/headless-boot.py` 启动无头浏览器验证
4. **新功能先在 Web 测试** — Web 调试最快,确认后再同步到 native

详细开发指南见 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)。

---

## 📊 性能

| 指标 | 值 |
|---|---|
| 首屏渲染 | < 200ms (缓存命中) / < 1s (冷启) |
| 内存占用(Web) | 30-50 MB |
| 内存占用(Electron) | 180-250 MB |
| 启动时间(Android) | 1.2s (Xiaomi 14) |
| 启动时间(macOS) | 0.8s |
| 文档体积 | 200KB(全部 UI) + vendor 库 |

---

## 🛣️ 路线图

- [x] 基础 Markdown 渲染 + 编辑
- [x] 多主题 + 字体切换
- [x] 搜索 + 查找替换
- [x] WebDAV 同步
- [x] AI 助手(5 个预设)
- [x] 模板库
- [x] 多标签页
- [x] 阅读模式
- [x] GitHub Actions 全平台构建
- [ ] 📝 思维导图(Mindmap)
- [ ] 🔌 插件系统
- [ ] 🌐 协同编辑(WebRTC / CRDT)
- [ ] 📱 iPad 适配(分屏编辑)
- [ ] 🤖 本地 AI(Ollama 集成)
- [ ] 📦 文档导入(PDF/EPUB)
- [ ] 🎙️ 语音输入(Whisper 集成)

---

## 📜 License

MIT © 2026 liuhua

---

## 🙏 致谢

- [marked.js](https://marked.js.org/) — Markdown 解析
- [highlight.js](https://highlightjs.org/) — 代码高亮
- [KaTeX](https://katex.org/) — 数学公式
- [Mermaid](https://mermaid.js.org/) — 图表
- [CodeMirror](https://codemirror.net/) — 编辑器
- [Iconoir](https://iconoir.com/) — 图标
- [Inter](https://rsms.me/inter/) — 字体

---

**Made with ❤️ for markdown lovers**