# 马克档 · Android

> 你的随身文档浏览器 — Android 原生 App 封装版

马克档 的 Android 实现：使用 **WebView + 资产内 HTML** 的混合架构，
原生层只负责 WebView 容器、文件 I/O、系统分享、沉浸式状态栏等系统集成，
所有 UI / 渲染逻辑都在 `assets/index.html` 里。

---

## 项目结构

```
android-app/
├── app/
│   ├── build.gradle.kts           # 模块级 Gradle（Kotlin DSL）
│   ├── proguard-rules.pro         # 混淆规则（保留 JS 接口）
│   └── src/main/
│       ├── AndroidManifest.xml    # 应用清单（权限、Activity 声明）
│       ├── assets/
│       │   ├── index.html         # 主应用 HTML（与 Web 版同源）
│       │   └── logo.svg           # 品牌 Logo
│       ├── java/com/markdoc/app/
│       │   ├── MarkdownApplication.kt   # Application（动态色、调试）
│       │   ├── MainActivity.kt          # 主 Activity（WebView + 桥接）
│       │   └── WebAppInterface.kt       # JS 桥接层
│       └── res/
│           ├── drawable/
│           │   ├── ic_launcher_background.xml   # 图标背景
│           │   ├── ic_launcher_foreground.xml   # 图标前景
│           │   └── splash_background.xml        # 启动页背景
│           ├── layout/
│           │   └── activity_main.xml
│           ├── mipmap-anydpi-v26/
│           │   ├── ic_launcher.xml              # 自适应图标
│           │   └── ic_launcher_round.xml
│           ├── mipmap-mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi/
│           │   └── ic_launcher.png              # PNG 兼容图标
│           ├── values/
│           │   ├── colors.xml
│           │   ├── strings.xml
│           │   └── themes.xml                   # 浅色主题
│           ├── values-night/
│           │   └── themes.xml                   # 深色主题
│           └── xml/
│               ├── file_paths.xml               # FileProvider 配置
│               └── network_security_config.xml  # HTTPS 策略
├── tools/
│   └── gen_icons.py                # 图标生成脚本
├── build.gradle.kts               # 项目级 Gradle
├── settings.gradle.kts
├── gradle.properties
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── gradlew                         # Unix 启动脚本
├── gradlew.bat                     # Windows 启动脚本
└── README.md
```

---

## 快速开始

### 方式一：Android Studio（推荐）

1. 用 **Android Studio Hedgehog (2023.1.1)** 或更新版本打开 `android-app/` 目录
2. 等待 Gradle 同步完成（首次会下载 AGP / Kotlin / 依赖）
3. 连接 Android 7.0+ 的真机或启动模拟器
4. 点击工具栏 ▶️ Run 即可

### 方式二：命令行

```bash
cd android-app

# 首次需要生成 gradle-wrapper.jar（Android Studio 会自动处理）
# 如果没装 Gradle，下载并放到 gradle/wrapper/gradle-wrapper.jar
# https://github.com/gradle/gradle/raw/v8.7.0/gradle/wrapper/gradle-wrapper.jar

# Windows
.\gradlew.bat assembleDebug

# macOS / Linux
./gradlew assembleDebug
```

构建产物：`app/build/outputs/apk/debug/app-debug.apk`

安装到手机：

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## 系统要求

| 项目 | 要求 |
| --- | --- |
| 最低 Android 版本 | 7.0 (API 24) |
| 推荐 Android 版本 | 12+ (API 31+，支持 Material You 动态色) |
| 屏幕方向 | 横竖屏自适应 |
| 网络 | 首次运行需要联网（加载 marked.js CDN，离线后会有 fallback） |
| 存储权限 | 无需（使用 SAF 文件选择器） |

---

## 🛠 小米/MIUI/HyperOS 兼容性

小米 14 运行 HyperOS（基于 Android 14），其 WebView 与原生 Chromium 有差异，且默认会激进清理后台进程。
本工程已针对这些场景做了加固：

### 1. localStorage 数据备份（解决 MIUI 杀进程丢内容）

- **问题**：MIUI "省电模式" / "内存清理" 会杀掉后台 WebView 进程，有时 localStorage 数据没及时落盘就被清掉，导致编辑内容丢失
- **方案**：
  - `DataBackup.kt` —— 把内容同步写入 app 内部文件 `filesDir/content_backup.md`，用 `fd.sync()` 强制落盘
  - JS 端每次保存时调用 `Android.dataBackup()` 双写
  - 启动时若 `localStorage` 为空，自动从备份恢复
  - `onPause()` 兜底再备份一次

### 2. 渲染进程崩溃恢复

- **问题**：MIUI WebView 偶发渲染进程崩溃（魔改 Chromium 的副作用）
- **方案**：`WebViewClient.onRenderProcessGone()` 捕获并重建 WebView，提示用户

### 3. 电池优化白名单

- **问题**：MIUI 默认不允许后台活动，进程随时被冻结
- **方案**：首次启动弹出引导对话框，引导用户到「电池优化」白名单设置
- 用户拒绝也无妨，只是 localStorage 备份的可靠性会降低

### 4. 字体兼容性

- **问题**：MIUI "MiSans" 默认替换系统字体
- **方案**：WebView 内的字体栈不受系统影响（MIUI 只替换 native UI），但已通过 CSS 加 `font-display: swap` 兜底

### 5. 状态栏颜色

- **问题**：MIUI 偶尔覆盖应用设置的状态栏颜色
- **方案**：`FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS` + 显式清除 `FLAG_TRANSLUCENT_STATUS`

### 6. 应用启动配置

- `android:hardwareAccelerated="true"` —— 显式启用硬件加速
- `android:largeHeap="true"` —— 大内存设备友好（小米 14 有 8/12/16GB 可选）
- `android:resizeableActivity="true"` —— 支持分屏/小窗

### 小米 14 专属优化清单

| 特性 | 处理 |
| --- | --- |
| HyperOS 14 检测 | `DeviceUtils.getMiuiVersion()` 返回 "HyperOS X.X" |
| WebView 渲染异常 | `onRenderProcessGone` 兜底 |
| MIUI 文件管理器替代 SAF | 已测试 OK，可正常使用 SAF |
| 120Hz 高刷 | 系统自动适配，无需特殊处理 |
| 后台进程限制 | 引导电池优化白名单 |

### 启动时控制台日志

启动后查看 `adb logcat -s MainActivity`，会打印：

```
========== 马克档启动 ==========
Device: Xiaomi 24011116C
Brand: Xiaomi
Android: 14 (API 34)
ROM: HyperOS 1.0.5
MIUI PowerSave: false
WebView Package: com.google.android.webview
Package: com.markdoc.app
```

---

## 🚀 一键安装到小米 14

### USB 调试

1. 手机进入「设置 → 我的设备 → 全部参数」，连续点击 7 次「OS 版本号」激活开发者模式
2. 「设置 → 更多设置 → 开发者选项」中开启：
   - ✅ USB 调试
   - ✅ USB 安装（首次会要求登录小米账号）
   - ✅ 无线调试（可选）
3. USB 连接电脑，手机弹出授权对话框点「允许」

### 构建并安装

```powershell
cd android-app
.\tools\install.ps1
```

脚本会自动：检测设备 → 打印设备信息 → 构建 Debug APK → adb 安装 → 启动 App

### 无线连接（无需数据线）

```powershell
# 首次需用 USB 连一次启用网络调试
adb tcpip 5555
adb shell ifconfig wlan0    # 查看手机 IP
adb disconnect

# 然后无线连
.\tools\wifi-connect.ps1 -Ip 192.168.1.100

# 之后正常 install.ps1
.\tools\install.ps1
```

### 实时日志

```powershell
adb logcat -s MainActivity WebAppInterface chromium:V
```

### Chrome DevTools 远程调试

1. 确认 USB 调试开启
2. Chrome 浏览器打开 `chrome://inspect/#devices`
3. 找到「马克档」WebView，点 inspect
4. Console / Elements / Network 全套可用

### 卸载

```powershell
adb uninstall com.markdoc.app.debug
```

---

## 原生 ↔ Web 桥接（JS Interface）

| JS 调用 | 原生行为 |
| --- | --- |
| `window.Android.isNative()` | 返回 `true`，Web 端用于判断运行容器 |
| `window.Android.getPlatform()` | 返回 `"android"` |
| `window.Android.showToast(msg)` | 显示原生 Toast |
| `window.Android.copyToClipboard(text)` | 写入系统剪贴板 |
| `window.Android.shareText(text, title)` | 调起系统分享面板 |
| `window.Android.saveToDownloads(content, filename)` | 保存到 `Downloads/马克档/`（Android 10+ 使用 MediaStore） |
| `window.Android.openFilePicker()` | 打开 SAF 文件选择器导入 .md |
| `window.Android.haptic(ms)` | 触发短震动反馈 |
| `window.Android.exitApp()` | 退出 App |

反向调用（原生 → Web）：

| 原生端调用 | Web 行为 |
| --- | --- |
| `window.importMarkdown(text)` | 将外部打开的 .md 内容注入编辑器 |
| `window.onSystemThemeChange(isDark)` | 系统主题切换时同步 Web 主题 |
| `window.onNativeReady()` | WebView 加载完成通知 |

---

## 修改 index.html

如果更新了根目录的 `index.html`，需要同步到 `app/src/main/assets/`：

```bash
# Windows PowerShell
Copy-Item ..\index.html app\src\main\assets\index.html -Force
```

或者修改 `tools/sync-web.ps1` 脚本自动化。

---

## 调试技巧

### Chrome DevTools 远程调试

1. 手机开启 USB 调试，连接电脑
2. 在 Chrome 地址栏输入 `chrome://inspect/#devices`
3. 选择对应的 WebView，点击 **inspect**
4. 可使用 Console / Elements / Network 等所有面板

### 查看日志

```bash
# WebView JS 日志
adb logcat -s "chromium" "WebAppInterface" "MainActivity"

# 全部日志
adb logcat | findstr "markdoc"
```

---

## 签名发布

**演示用**：`build.gradle.kts` 中 `release` 配置复用了 `debug` 签名，便于直接安装。

**正式发布**：建议在 `app/build.gradle.kts` 中配置正式签名：

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("keystore/release.jks")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

---

## 后续路线

- [ ] 加入 Room 数据库支持多文档管理
- [ ] 文件系统 watcher（实时同步外部修改的 .md）
- [ ] 桌面小部件（Widget）
- [ ] Quick Settings Tile 一键新建
- [ ] ChromeOS / 平板自适应布局
- [ ] Compose Multiplatform 共享 UI（待评估）

---

## 许可

MIT — 与 Web 版一致。