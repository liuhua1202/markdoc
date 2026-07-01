# 发版流程(用户版)

> 5 分钟把代码变成全平台产物,推送到 GitHub Release。

---

## 🚀 快速流程(3 步)

```bash
# 1. 改版本号(三选一,保持一致)
#    - desktop-app/package.json → "version": "1.0.7"
#    - android-app/app/build.gradle.kts → versionCode 7, versionName "1.0.7"
#    - index.html 顶部的 SAMPLE_DOC 里那个版本注释

# 2. 提交 + 打 tag
git add -A
git commit -m "v1.0.7: 你的改动简述"
git tag -a v1.0.7 -m "v1.0.7 发布说明"

# 3. 推送
git push origin main
git push origin v1.0.7
```

打完 tag 一推,**GitHub Actions 自动**:
- ✅ 准备资源(同步 Web 到各平台)
- ✅ 编译 macOS DMG(x64 + arm64,带签名+公证)
- ✅ 编译 Windows 安装包 + portable
- ✅ 编译 Linux AppImage + deb
- ✅ 编译 Android Debug + Release APK
- ✅ 打包 Web 静态资源 zip
- ✅ 创建 GitHub Release,挂上所有产物
- ✅ 部署 Web 到 GitHub Pages

全程约 **15-25 分钟**(macOS 公证通常占大头)。

---

## 🔍 怎么看进度

1. 进入 GitHub 仓库 → **Actions** 标签
2. 找到最新的 "Release" workflow
3. 看哪个 job 跑完了,哪个在跑

| Job | 含义 | 预计时间 |
|---|---|---|
| `prepare` | 资源同步 | 1 分钟 |
| `build-macos` | macOS 构建+签名+公证 | 10-15 分钟 |
| `build-windows` | Windows 构建 | 3-5 分钟 |
| `build-linux` | Linux 构建 | 3-5 分钟 |
| `build-android` | Android 构建 | 5-8 分钟 |
| `build-web` | Web 打包 | 30 秒 |
| `release` | 创建 GitHub Release | 30 秒 |
| `deploy-pages` | 部署 Web | 1 分钟 |

---

## ❌ 构建失败怎么办

### macOS 公证失败
1. 点开 `build-macos` job 看日志
2. 找 `notarytool submit` 那段
3. 常见错:Developer ID 证书过期、App-Specific Password 错、Team ID 错
4. 修复:到 Apple Developer 后台重置/更新,然后更新 GitHub Secret

### Windows 缺少代码签名
正常现象,`build-windows` 跑的是无签名的 NSIS 包。
要给 Windows 签名需要 **EV 代码签名证书**(~$300/年),小型项目可省。

### Android Gradle 下载慢
首次跑要下载 ~500 MB 的 Gradle + AndroidX 依赖,正常。
如果 fail 在 `Could not download` 之类 → 重跑一次就好。

### "fatal: not a git repository"
检查 `.github/workflows/release.yml` 里 `actions/checkout@v4` 的配置。
当前用的是默认 `ref: ${{ github.ref }}`,应该没问题。

---

## 🏷️ 怎么发"预发布"版本(alpha/beta)

```bash
# 预发布:tag 名带 - 前缀
git tag -a v1.1.0-beta.1 -m "新功能预览"
git push origin v1.1.0-beta.1
```

GitHub Release 会自动识别为 **Pre-release**,适合小范围测试。

---

## 🔄 怎么热修复(紧急 patch)

```bash
# 从发布过的 tag 拉修复分支
git checkout -b hotfix/1.0.7 v1.0.7

# 修完
git commit -am "fix: 修了什么"
git tag -a v1.0.7.1 -m "紧急修复"
git push origin hotfix/1.0.7
git push origin v1.0.7.1
```

---

## 🧹 怎么清掉老 release 产物

1. GitHub repo → **Releases** 页面
2. 找到要删的版本 → 编辑 → 勾上 **"Delete this release"**
3. 再去 **Actions** 跑一次 release 即可重新生成

或者直接用 `gh` CLI:

```bash
gh release delete v1.0.6 --yes
git push origin :refs/tags/v1.0.6
```

---

## 📦 构建产物清单

发版完成后,GitHub Release 页面会附上这些文件:

| 平台 | 文件 | 大小 | 用户体验 |
|---|---|---|---|
| macOS (Intel) | `马克档-1.0.7-mac-x64.dmg` | ~120 MB | 双击拖入 Applications,**零警告** |
| macOS (M1/M2/M3) | `马克档-1.0.7-mac-arm64.dmg` | ~120 MB | 同上,Apple Silicon 专用 |
| Windows | `马克档-1.0.7-x64.exe` | ~130 MB | NSIS 安装向导,自动开机启动(可关) |
| Windows 便携版 | `马克档-1.0.7-portable.exe` | ~130 MB | 绿色版,无安装 |
| Linux | `马克档-1.0.7-x64.AppImage` | ~140 MB | 双击运行 |
| Linux | `马克档-1.0.7-amd64.deb` | ~80 MB | Debian/Ubuntu 系统包 |
| Android Debug | `app-debug.apk` | ~7 MB | 可装可调试,带 dev tools |
| Android Release | `app-release-unsigned.apk` | ~3 MB | 未签名(需用户自行签名) |
| Web | `markdoc-pwa.zip` | ~150 KB | 解压部署到任何静态服务器 |

---

## 🧪 怎么本地试跑

装 [act](https://github.com/nektos/act) 之后:

```bash
# 试跑 macOS job
act -j build-macos -W .github/workflows/release.yml --secret-file .secrets

# .secrets 文件格式:
# MACOS_CERT_P12=base64
# MACOS_CERT_P12_PWD=...
# KEYCHAIN_PASSWORD=...
# APPLE_ID=...
# APPLE_APP_SPECIFIC_PWD=...
# APPLE_TEAM_ID=...
```

注意:`act` 在 Linux 上跑 macOS job 不会真做签名,只是验证 workflow 语法。

---

## 🤖 自动版本号

如果想省去手动改 version:

```bash
# 用 npm version 自动 bump
cd desktop-app
npm version patch    # 1.0.7 → 1.0.8
cd ..

# 同步到 Android
sed -i 's/versionCode = [0-9]*/versionCode = NEW_NUMBER/' android-app/app/build.gradle.kts
```

未来可以加个 prebuild script 统一管。

---

## 📚 相关文档

- [SIGNING-SETUP.md](./SIGNING-SETUP.md) — Apple 签名证书配置
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 单仓多端架构
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Web 部署(Vercel/Netlify/Pages)