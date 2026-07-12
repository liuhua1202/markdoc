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
- **📤 多格式导出** — `.md` / `.html` / `.pdf`(打印)/ `.docx`(真实 OOXML,Word/WPS 直接打开)/ `JSON 打包备份`
- **📥 批量导入** — Android 原生走 SAF 多选,可一次挑多份 `.md` / `.json` 直入文档库
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
| Web | `markdoc-pwa.zip` |

### 📋 更新日志

#### v1.0.14 (2026-07-13)
- 🐛 **大纲点击跳转** — 之前阅读模式下点大纲项不动(滚到被覆盖的 edit 预览);现在按当前模式选真正的滚动容器(edit → `.preview` / reader → `#reader`),`scrollTo` 替代 `scrollIntoView` 更准
- 🐛 **阅读模式横向溢出** — 长文件名/URL 撑爆 `#reader` 导致整页可横移;容器加 `overflow-x: hidden`,标题/正文加 `overflow-wrap: anywhere`
- 🎨 **图标文档元素居中** — 之前文档卡片偏左下(中心 462,580),现在所有 variant(logo.svg / Android 前景/单色 / PWA / Windows ICO)卡片 + M 一起对齐到 viewport 中心 512,512
- 🛠 **新工具** — `tools/regen-logo-ico.py` 从 logo.svg 一键生成 ICO / 多尺寸 PNG,无外部依赖

#### v1.0.13 (2026-07-12)
- 🐛 **修复 WebDAV 备份恢复轮询** — 三次重试 + 状态轮询,导出/恢复不再卡死
- 🐛 **修复 DataBackup IO 阻塞** — 切到后台线程,UI 不再卡顿
- 🐛 **修复 `<queries>` 缺失** — Android 11+ 包可见性,启动器/拨号器等可被识别
- 🔒 **mixedContent 收紧** — 资产页默认拒绝明文 HTTP,提升安全
- 🎨 **新图标系统** — monochrome 自适应层(Android 12+ 主题图标)+ 浅色 splash 加 logo
- 🧹 **Web/Desktop 瘦身** — `index.html` 减少 ~1100 行重复代码,启动更快
- 📦 **构建优化** — 重新生成所有 mipmap,体积更小更干净

#### v1.0.11 / v1.0.12 (2026-07-10 / 2026-07-11)
- 🐛 修复导出 picker 支持多选
- 🐛 修复导入支持 `.md` 文件
- ✨ 新增 DOCX 真实 OOXML 导出(Word/WPS 直接打开)
- ✨ Android SAF 多选导入(`.md` / `.json`)

#### v1.0.10 (2026-07-09)
- 🗑️ **移除模版功能** — 实用性差,精简 UI
- 🗑️ **移除 AI 助手** — 使用率低,免去 API 维护负担
- 🐛 **修复"更多"按钮失效 bug** — 抽屉与大纲互斥关闭时未同步内部状态,导致点击无响应;Drawer 重构为实例状态,Outline 调用 `Drawer.close()` 同步
- 🎨 **新图标** — 黑底白纸 + M 字母 + 放大镜(替换原浅底红 M 风格)

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
- [x] ~~AI 助手(5 个预设)~~ — v1.0.10 移除(使用率低)
- [x] ~~模板库~~ — v1.0.10 移除(实用性差)
- [x] 多标签页
- [x] 阅读模式
- [x] GitHub Actions 全平台构建
- [x] 文档导出 `.docx` (OOXML) / `.pdf` (打印)
- [x] Android SAF 多选导入(`.md` / `.json`)
- [x] 修复"更多"按钮多开抽屉后失效 bug
- [x] 修复 WebDAV 备份恢复 + DataBackup IO 阻塞
- [x] 新增 DOCX 导出 + SAF 多选导入
- [x] 新图标系统(monochrome + splash)
- [ ] 📝 思维导图(Mindmap)
- [ ] 🔌 插件系统
- [ ] 🌐 协同编辑(WebRTC / CRDT)
- [ ] 📱 iPad 适配(分屏编辑)
- [ ] 🤖 本地 AI(Ollama 集成)
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