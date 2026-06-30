# 马克档 · iOS 版

> 你的随身文档浏览器 —— iOS 原生 App（Capacitor 包装）

⚠️ **必须在 macOS 上构建**（Xcode 工具链限制）

---

## 为什么用 Capacitor

- **代码复用 100%**:iOS 版直接打包 Web 版 HTML,零业务代码重复
- **JS ↔ Native 桥接**:跟 Android 版同样的概念（`window.Capacitor.Plugins.*`）
- **应用商店可上架**:不需要走 Safari Web Push 那套

---

## 一次性环境配置（在 Mac 上）

```bash
# 1. 安装 Node.js（已装的可以跳过）
brew install node

# 2. 安装 Xcode（从 App Store）
# 启动 Xcode 后同意 license：
sudo xcodebuild -license accept

# 3. 安装 CocoaPods（iOS 依赖管理）
sudo gem install cocoapods

# 4. 安装 Capacitor CLI
cd ios-app
npm install
```

## 同步 Web 资源到 iOS

```bash
# 把 ../index.html 等 web 资源复制到 www/，并同步到 Xcode 项目
npm run sync
```

## 在 Xcode 中打开

```bash
npm run open
# 等价于：npx cap open ios
```

第一次打开会提示同意各种 iOS 开发者协议。

## Xcode 配置

### 1. 设置 Team（开发者账号）

- Xcode → 项目 → Signing & Capabilities
- Team: 选择你的 Apple Developer 账号（免费个人账号也行）
- Bundle Identifier: 改成你自己的（默认 `com.makemdown.app` 可能冲突）
- 勾选 "Sign to Run Locally"

### 2. 真机调试

- USB 连接 iPhone
- iPhone 设置 → 通用 → 设备管理 → 信任你的证书
- Xcode 顶部选择你的设备 → 点 ▶️ Run

### 3. 模拟器调试

- Xcode 顶部选择任意 iPhone 模拟器
- Cmd+R 运行

## 发布到 App Store

需要付费 Apple Developer 账号（$99/年）：

```bash
# 在 Xcode 中：
# Product → Archive → Distribute App → App Store Connect → Upload
```

App Store Connect 后台：https://appstoreconnect.apple.com

---

## 项目结构

```
ios-app/
├── package.json               # Capacitor 依赖
├── capacitor.config.json      # Capacitor 配置
├── www/                       # Web 资源（直接打包进 App）
│   ├── index.html
│   ├── logo.svg
│   ├── manifest.json
│   ├── sw.js
│   ├── vendor/
│   │   └── marked.min.js
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── README.md
```

`npx cap add ios` 后会生成 `ios/` 子目录，包含完整的 Xcode 工程。

## 与 Android 版的差异

| 特性 | Android | iOS |
|---|---|---|
| WebView | ✓ | ✓ WKWebView |
| localStorage | ✓ | ✓ |
| 离线缓存 | ✓ Service Worker | iOS 会保留（首次联网后） |
| 文件选择 | ✓ SAF | ✓ UIDocumentPicker |
| 保存到系统 | ✓ Downloads | ✓ Files (iCloud Drive) |
| 分享 | ✓ 系统分享 | ✓ UIActivityViewController |
| 状态栏 | ✓ | ✓ |
| 后台备份 | ✓ native DataBackup | iCloud 自动 |
| 安装即用 | ✓ | ✓ |

## 调试

- Xcode → Window → Devices and Simulators → 选中设备 → Open Console
- 或者 Safari → Develop → 你的 iPhone → 选择 WebView

## 已知限制

- iOS 16.4 之前 PWA API 受限，但 Capacitor 包装后不受此限制
- Capacitor App Store 包大小约 5-8MB
- 首次启动比 Android 稍慢（WKWebView 预热）

## 后续优化

- [ ] 加入 iOS Widget（最近文档）
- [ ] iCloud 自动同步（替代 WebDAV）
- [ ] iPad 多任务分屏适配
- [ ] Apple Pencil 手写笔记
- [ ] Shortcuts 集成

## License

MIT — 与 Web/Android 版一致。