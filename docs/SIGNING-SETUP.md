# macOS 签名 + 公证 设置指南

> 把 `马克档` 打包成 Apple 官方签名 + 公证过的 `.dmg`,用户安装时**零警告、零拦截**。

---

## 🎯 整个流程长什么样

```
Apple Developer 账号 ($99/年)
        ↓
创建 Developer ID Application 证书
        ↓
导出 .p12 文件 → base64 编码 → GitHub Secret
        ↓
App-Specific Password → GitHub Secret
        ↓
Team ID → GitHub Secret
        ↓
打 tag → GitHub Actions 自动构建 + 签名 + 公证 + 发 Release
```

---

## 📋 前置条件

- ✅ Apple Developer 账号(**$99/年**,个人或组织都行)
- ✅ 已加入 Apple Developer Program
- ⚠️ 一台 **Mac**(CSR 必须在 Mac 上生成,或用在线 CSR 生成器)
- 域名(可选,App Store Connect 需要)

---

## 步骤 1:创建 Developer ID 证书

### 1.1 在 Apple Developer 后台创建证书

1. 访问 https://developer.apple.com/account/resources/certificates/list
2. 点 `+` 创建新证书
3. 选择 **Developer ID Application** ⚠️(**关键!不是 iOS App Development**)
4. 选择 **Upload a Certificate Signing Request**
5. 上传 CSR(下一步生成)
6. 下载生成的 `developer_id_application.cer`

### 1.2 生成 CSR

**方式 A:在 Mac 上(推荐)**

```bash
# 打开 Keychain Access → 证书助理 → 从证书颁发机构请求证书
# 邮箱填 Apple ID 邮箱,常用名称填 "MacDown Signing",保存到磁盘
# 会得到一个 .certSigningRequest 文件
```

**方式 B:命令行(Mac/Linux)**

```bash
openssl req -new -newkey rsa:2048 -nodes -keyout developer_id.key \
  -out developer_id.csr \
  -subj "/emailAddress=your@email.com, CN=MacDown Signing, C=US"
```

**方式 C:Windows + WSL**

```bash
# 在 WSL 里
openssl req -new -newkey rsa:2048 -nodes -keyout developer_id.key \
  -out developer_id.csr \
  -subj "/emailAddress=your@email.com, CN=MacDown Signing, C=US"
```

### 1.3 导入并导出 .p12

**Mac:**

1. **双击 .cer** → 安装到 Keychain
2. Keychain Access → 登录 → 我的证书
3. 找到 "Developer ID Application: ..." → 右键 → **Export**
4. 文件格式:**Personal Information Exchange (.p12)**
5. 设置一个**强密码**(下面要用到,建议 16+ 字符)
6. 保存为 `developer_id.p12`

**Linux/WSL(无 Keychain):**

```bash
# 把 .cer 转为 PEM
openssl x509 -in developer_id_application.cer -inform DER -out developer_id.pem

# 合并 key + pem → p12
openssl pkcs12 -export -inkey developer_id.key -in developer_id.pem \
  -out developer_id.p12

# 会要求设密码,记住它
```

---

## 步骤 2:获取 App-Specific Password

1. 访问 https://appleid.apple.com/account/manage
2. 登录 → **App-Specific Passwords** → 点 `+` 生成
3. Label 填 `GitHub Actions - MacDown`
4. **复制生成的密码**(形如 `abcd-efgh-ijkl-mnop`)
5. ⚠️ 关掉页面就再也看不到了,务必先复制

---

## 步骤 3:获取 Team ID

1. 访问 https://developer.apple.com/account
2. 点右上角头像 → **Membership**
3. 复制 **Team ID**(**10 位字符**,形如 `A1B2C3D4E5`)

---

## 步骤 4:把 .p12 编码成 base64

```bash
# macOS
base64 -i developer_id.p12 -o developer_id_p12_b64.txt

# Linux
base64 -w 0 developer_id.p12 > developer_id_p12_b64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("developer_id.p12")) | Out-File -Encoding ASCII developer_id_p12_b64.txt
```

打开 `developer_id_p12_b64.txt`,复制里面**全部内容**(很长,几千字符)。

---

## 步骤 5:添加 GitHub Secrets

进入 GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

依次添加 **5 个 Secret**:

| Secret 名 | 值 | 说明 |
|---|---|---|
| `MACOS_CERT_P12` | `.p12` 的 base64 内容 | 整段 base64 字符串(几千字符) |
| `MACOS_CERT_P12_PWD` | 步骤 1.3 设置的密码 | .p12 文件密码 |
| `KEYCHAIN_PASSWORD` | 任意强密码(用于临时 keychain) | 建议 16+ 字符,如 `temp-keychain-2026-xyz` |
| `APPLE_ID` | 你的 Apple ID 邮箱 | 如 `your@email.com` |
| `APPLE_APP_SPECIFIC_PWD` | 步骤 2 生成的密码 | 形如 `abcd-efgh-ijkl-mnop` |
| `APPLE_TEAM_ID` | 步骤 3 的 Team ID | 10 位字符 |

**注意 2 处**:
1. `MACOS_CERT_P12_PWD`(不是 `MACOS_CERT_PWD`)— release.yml 用的是这个名字
2. `APPLE_APP_SPECIFIC_PWD`(不是 `APPLE_APP_SPECIFIC_PASSWORD`)— 同样

---

## 步骤 6:触发构建

### 方式 A:打 tag 自动构建(推荐)

```bash
git tag -a v1.0.7 -m "v1.0.7 发布说明"
git push origin v1.0.7
```

GitHub Actions 自动开始:
1. 准备资源 → 5 个并行 build
2. macOS 构建会自动签名 + 上传 Apple 公证
3. 公证完成(2-5 分钟)→ 自动创建 GitHub Release
4. Release 页面附带所有 5 个平台的二进制

### 方式 B:手动触发

GitHub repo → **Actions** → "Release" workflow → **Run workflow**

---

## 🔍 怎么验证签名和公证成功

### 本地(macOS)验证

```bash
# 验证签名
codesign --verify --deep --strict --verbose=2 /Applications/马克档.app
# 期望: "valid on disk" + "satisfies its Designated Requirement"

# 显示签名信息
codesign --display --verbose=4 /Applications/马克档.app
# 应该看到 Developer ID Application: Your Name (TEAMID)

# 验证公证
spctl --assess --verbose=4 /Applications/马克档.app
# 期望: "source = Notarized Developer ID"

# 检查 Gatekeeper 评估 DMG
spctl --assess --type open --context context:primary-signature -vv 马克档.dmg
```

### 在线验证

```bash
# Apple 公证日志查询
xcrun notarytool history \
  --apple-id your@email.com \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id A1B2C3D4E5

# 查具体一次的详情
xcrun notarytool info <submission-id> \
  --apple-id your@email.com \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id A1B2C3D4E5
```

### GitHub Actions 日志里看

`build-macos` job 末尾应该有:
```
✓ "马克档-1.0.7-mac-x64.dmg" was successfully notarized
```

---

## ❓ 常见问题

### Q: 公证失败 "The binary is not signed"

**原因:** 没正确导入证书,或 `entitlements.mac.plist` 配置错。

**修复:**
1. 检查 `desktop-app/build/entitlements.mac.plist` 是否存在
2. 确认 `MACOS_CERT_P12` 是有效的 base64
3. 确认密码正确
4. 重新生成 .p12

### Q: "Developer cannot be verified"

**原因:** 用了错误的证书类型(应该是 **Developer ID Application**,不是 Apple Development)

**修复:** 重新创建正确类型的证书。

### Q: 公证超时(10 分钟)

正常,Apple 公证平均 2-5 分钟,偶尔会到 10 分钟。如果超过 30 分钟:
1. 查 notarytool history 看提交状态
2. 可能是 Apple 后端问题,等几分钟重试

### Q: 在 GitHub Actions 里访问 keychain 失败

检查 `security create-keychain` 步骤。当前 release.yml 已经处理了:
- 创建临时 keychain
- 解锁
- 设置不超时
- 导入证书并允许 codesign 访问

### Q: 不想花钱买 Apple Developer 账号?

**备选方案:**

| 方案 | 体验 | 成本 |
|---|---|---|
| 不签名 + 不公证 | 用户首次打开有警告(右键打开) | 免费 |
| **PWA** | 用 Safari 添加到主屏幕,体验 90% 接近原生 | 免费 |
| 自签证书(adhoc) | 无警告但每次安装都被 Gatekeeper 拦截 | 免费 |
| Apple Developer + 公证 | **零警告,用户感知不到** | $99/年 |

**推荐:先发 PWA 让用户用起来,等有付费意愿再上签名。**

### Q: 能否只签名不公证?

可以,但用户首次打开还是要点"仍要打开"按钮。建议都做。

### Q: 怎么撤销 + 重新申请证书

如果证书泄露 / 团队成员离职:

1. Apple Developer 后台 → Certificates → 找到 → **Revoke**
2. 重新走步骤 1
3. 更新 GitHub Secret

### Q: 一台 Mac 能否管理多个 Apple ID 的证书?

可以,Keychain Access 可以同时导入多个证书。导出 .p12 时选对那个就行。

### Q: 团队多人协作怎么管证书?

建议:
1. .p12 文件存在 **1Password / Bitwarden** 团队保险库
2. CI 用专门的 Apple ID(不是个人 Apple ID)
3. 证书每年到期前 30 天提醒续期

---

## 💰 成本估算

| 项目 | 一次性 | 每年 |
|---|---|---|
| Apple Developer 账号 | - | $99 |
| 域名(可选) | $10 | - |
| GitHub(公开 repo) | - | 免费 |
| GitHub(私有 repo) | - | 免费 2000 分钟/月 |
| **总计** | **$10** | **$99/年** |

公开仓库 Actions **完全免费**。

---

## 🚀 后续:Sparkle 自动更新

等用户量上来,可以加自动更新:

1. 集成 `electron-updater`
2. 在 app 里放一个"检查更新"按钮
3. 配 `appcast.xml`(类似 RSS feed)
4. 公钥嵌入 app,私钥在发布端

这部分等需要再做。先把签名+发版跑通。

---

## 📚 参考资料

- [Apple: Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-builder: Code Signing](https://www.electron.build/code-signing.html)
- [notarytool 官方文档](https://developer.apple.com/documentation/security/notarytool)
- [GitHub Actions: macOS runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#supported-runners-and-hardware-resources)

---

## ✅ 快速检查清单

配置完成后,逐项打勾:

- [ ] Apple Developer 账号已激活
- [ ] Developer ID Application 证书已创建(在 Apple 后台能看到)
- [ ] .p12 文件已导出
- [ ] 5 个 GitHub Secret 已添加
- [ ] 打了 `v*` tag 并 push
- [ ] GitHub Actions 跑通,`build-macos` 显示 "notarized"
- [ ] 下载 DMG,本机 `spctl --assess` 通过
- [ ] 拷贝到同事 Mac 安装,零警告

全部打勾?恭喜,**正式发布流程跑通了** 🎉