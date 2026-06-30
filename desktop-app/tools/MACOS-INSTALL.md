# 马克档 · macOS 安装指南

> 把 Web 版马克档装到 Mac 上的完整指南

---

## 📦 下载文件

```
macos/
├── 马克档.app/          ← 应用本体 (~240 MB)
└── install.command      ← 一键安装脚本
```

---

## 🍎 安装方法

### 方法 A:双击 install.command(推荐)

1. 把 `macos/` 文件夹整个复制到 Mac 上(USB AirDrop / 网盘 / 微信文件传输都行)
2. **右键点击 `install.command`** → 在终端中打开
3. 按提示操作:复制到 /Applications + 自动启动

### 方法 B:手动安装

1. 把 `马克档.app` 拖到 Mac 的 **应用程序(Applications)** 文件夹
2. **右键点击 `马克档.app`** → 打开
3. 第一次会提示"无法打开,因为它来自身份不明的开发者"
4. **系统设置 → 隐私与安全性 → 仍要打开** → 输入密码

---

## ⚠️ 关于"未签名应用"的提示

因为我们没有 Apple Developer 账号($99/年),这个 .app 是**未签名 + 未公证**的。

**首次打开会出现:**
- "无法打开,因为它来自身份不明的开发者"

**解决方法(任选其一):**

### 1. 系统设置法(简单)
- 打开 系统设置 → 隐私与安全性
- 向下滚动,找到"仍要打开"的按钮
- 点击 → 输入密码

### 2. 命令行法(快速)
```bash
# 解除 macOS Gatekeeper 限制
xattr -cr /Applications/马克档.app
```

### 3. 一次性全部允许(最快)
```bash
sudo spctl --master-disable
```
> 这会禁用整个 Gatekeeper(不推荐长期使用)

`install.command` 已经自动处理了这个问题。

---

## 🚀 启动后

| 快捷键 | 功能 |
|---|---|
| `Cmd + N` | 新建文档 |
| `Cmd + O` | 打开 .md |
| `Cmd + S` | 保存 .md |
| `Cmd + 1` | 仅源码 |
| `Cmd + 2` | 分屏 |
| `Cmd + 3` | 仅预览 |
| `Cmd + 4` | 阅读模式 |
| `Cmd + T` | 切换主题 |
| `Cmd + F` | 查找替换 |
| `Cmd + R` | 重载页面 |
| `Cmd + Shift + I` | 打开 DevTools |
| `F11` | 全屏 |

**触摸板手势(macOS 标准):**
- 双指轻扫(左右):返回 / 前进
- 双指捏合:放大缩小
- 三指轻扫上:调度中心

---

## 📂 数据存储位置

所有文档存在 macOS 标准的 WebView storage 路径:
```
~/Library/Application Support/马克档/
├── Local Storage/
│   └── leveldb/         # localStorage 数据
├── Session Storage/
└── IndexedDB/
```

清理数据:`~/Library/Application Support/马克档/` 整个删除即可。

---

## 🔄 卸载

```bash
# 拖到废纸篓 OR
rm -rf /Applications/马克档.app
rm -rf ~/Library/Application\ Support/马克档
```

---

## ❓ 常见问题

**Q: 启动后是英文界面?**
A: 应用是中文的。如果系统语言不是中文,部分菜单可能是英文。

**Q: 怎么改文档字体 / 字号 / 主题?**
A: 阅读模式 (Cmd+4) 里可以调,或顶部 🌗 按钮切换主题。

**Q: 数据能同步到其他设备吗?**
A: 抽屉菜单 → 云同步 (WebDAV),支持坚果云/Nextcloud。

**Q: 为什么不直接放 App Store?**
A: 上架需要:
- Apple Developer 账号($99/年)
- Mac 机器(用于签名 + 公证)
- 通过 Apple 审核

这套组合对个人开发者不友好,所以我们用 PWA + 桌面 App + Android 三个渠道覆盖。

**Q: 怎么升级?**
A: 目前是 v1.0.6,后续版本替换 .app 文件即可。数据存储路径不变,无数据迁移。

---

## 🆚 与其他版本对比

| 版本 | 安装 | 大小 | 离线 | 同步 |
|---|---|---|---|---|
| **macOS .app**(本文) | 双击 | 240 MB | ✅ | ✅ WebDAV |
| **PWA (Safari)** | 添加到主屏幕 | <1 MB | ✅ | ✅ WebDAV |
| **iOS** | 需要 Mac 编译 | - | - | - |

推荐:日常用 macOS .app,出差带 iOS Safari PWA。

---

## 📜 许可

MIT - 与其他平台一致。