# 部署指南

> 把 Web 版 `马克档` 部署到各种静态托管服务。

---

## 🎯 一句话总结

整个 Web 版 **纯静态**,可以丢到任何能托管 HTML 的地方。

---

## 📋 准备工作

Web 版需要的文件(根目录下的):

```
必需:
  index.html           # 主应用
  manifest.json        # PWA manifest
  sw.js                # Service Worker
  logo.svg             # 站点图标
  icons/icon-192.png   # PWA 小图标
  icons/icon-512.png   # PWA 大图标
  vendor/              # 第三方库(JS)
    ├── marked.min.js
    ├── highlight.min.js
    ├── katex.min.js
    ├── mermaid.min.js
    └── ...
```

部署前先把它们打包成 zip:

```bash
# Windows PowerShell
Compress-Archive -Path index.html, manifest.json, sw.js, logo.svg, icons, vendor `
  -DestinationPath markdoc-pwa.zip

# macOS / Linux
zip -r markdoc-pwa.zip index.html manifest.json sw.js logo.svg icons vendor
```

---

## 🌐 部署方式

### 1. GitHub Pages(免费,推荐)

**自动化(本仓库已配):**

`.github/workflows/pages.yml` 已经在 build-web job 完成后自动部署。

**手动配置(首次):**

1. 仓库 → **Settings** → **Pages**
2. **Source** 选 `GitHub Actions`
3. push 到 main → 5 分钟内生效
4. 访问 `https://<user>.github.io/<repo>/`

**自定义域名:**

1. 在 `public/` 下建 `CNAME` 文件,内容为 `md.yourdomain.com`
2. DNS 配置 CNAME 指向 `<user>.github.io`
3. Settings → Pages → Custom domain 填 `md.yourdomain.com`
4. 勾 **Enforce HTTPS**

### 2. Vercel(免费,最简单)

**一键部署:**

```bash
npm i -g vercel
vercel --prod
```

或用 GitHub 集成:
1. https://vercel.com → **New Project**
2. 选这个 repo → 部署
3. 每次 push 自动部署

**配置文件**(已包含在仓库根):

`vercel.json`:
```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [{"key": "Cache-Control", "value": "no-cache"}]
    },
    {
      "source": "/vendor/(.*)",
      "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]
    }
  ]
}
```

### 3. Netlify(免费,带表单)

**拖拽部署:**

1. https://app.netlify.com/drop
2. 把整个项目根目录拖进去
3. 30 秒得到一个 `xxx.netlify.app` 链接

**配置文件**(已包含):

`netlify.toml`:
```toml
[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[headers]]
  for = "/vendor/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 4. Cloudflare Pages(免费,CDN 最强)

1. https://pages.cloudflare.com → **Create a project**
2. 连 GitHub → 选这个 repo
3. Build command:留空(纯静态)
4. Build output:`/`
5. 部署

### 5. 自建服务器(Nginx)

```nginx
server {
    listen 80;
    server_name md.yourdomain.com;
    root /var/www/markdown;
    index index.html;

    # PWA 必须
    location = /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }

    # vendor 永久缓存
    location /vendor/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # SPA fallback(虽然目前不是 SPA)
    location / {
        try_files $uri $uri/ =404;
    }

    # HTTPS(Certbot)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/md.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/md.yourdomain.com/privkey.pem;
}
```

部署:
```bash
sudo cp -r . /var/www/markdown/
sudo certbot --nginx -d md.yourdomain.com
```

### 6. Docker(自托管)

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```bash
docker build -t markdown-pwa .
docker run -d -p 8080:80 markdown-pwa
```

---

## 🏗️ 部署清单

每个平台都支持,但**关键点**:

| 平台 | PWA | Service Worker | 自动 HTTPS | 速度(国内) |
|---|---|---|---|---|
| GitHub Pages | ✅ | ✅ | ✅ | ⭐⭐ 慢 |
| Vercel | ✅ | ✅ | ✅ | ⭐⭐⭐ 中 |
| Netlify | ✅ | ✅ | ✅ | ⭐⭐ 慢 |
| Cloudflare | ✅ | ✅ | ✅ | ⭐⭐⭐⭐ 快 |
| 阿里云 OSS + CDN | ⚠️ | ✅ | ✅ | ⭐⭐⭐⭐⭐ 最快 |
| 自建 Nginx | ✅ | ✅ | ✅(Certbot) | ⭐⭐⭐⭐⭐ 看带宽 |

**国内推荐**:
- **阿里云 / 腾讯云 OSS** + CDN + 自定义域名
- **Cloudflare** 套 CDN 也能上,但偶尔被墙

---

## 🇨🇳 国内部署详细(阿里云 OSS)

### 步骤 1:开 OSS + CDN

1. 阿里云控制台 → 对象存储 OSS → 创建 Bucket
   - 名称:`macdown-web`
   - 地域:看你用户主要分布
   - 读写权限:**公共读**
2. CDN → 添加域名 `md.yourdomain.com`
   - 源站信息:OSS 域名
   - HTTPS 证书:上传 / 申请免费证书
3. DNS 解析:CNAME 指向 CDN 域名

### 步骤 2:上传文件

```bash
# 用 ossutil
ossutil cp -r . oss://macdown-web/ --exclude ".git/*" --update
```

或阿里云控制台 → OSS → 文件管理 → 上传文件夹。

### 步骤 3:配置 CDN 缓存

| 路径 | 缓存时间 |
|---|---|
| `/sw.js` | **不缓存**(`max-age=0`) |
| `/manifest.json` | 1 小时 |
| `/vendor/*` | 30 天 |
| `/icons/*` | 30 天 |
| `/index.html` | 1 小时(但加版本号强制更新) |
| 其他 | 1 天 |

### 步骤 4:配置 CORS(如果需要)

OSS → Bucket 设置 → 跨域设置 → 创建规则:
- 来源:`*`(或具体域名)
- 允许 Methods:GET, HEAD
- 允许 Headers:`*`

---

## 🧪 部署后验证

### 1. PWA 验证

打开 Chrome DevTools → **Application** 标签:
- **Manifest**:应该看到应用名称 + 图标
- **Service Workers**:应该显示 "activated and running"
- **Storage**:应该看到缓存条目

### 2. 离线验证

1. 打开应用,等加载完成
2. DevTools → Network → 勾 **Offline**
3. 刷新页面
4. 应该正常显示(没有网络也能用)

### 3. Lighthouse 评分

DevTools → **Lighthouse** → 跑 PWA / Performance / Accessibility 评分

目标:
- PWA: 100
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 90+

### 4. 移动端验证

- **iPhone Safari**:分享 → 添加到主屏幕,看全屏效果
- **Android Chrome**:菜单 → 安装应用 / 添加到主屏幕

---

## 🔒 安全

### CSP(Content Security Policy)

建议加在响应头(防 XSS):

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.openai.com https://*;
  worker-src 'self';
```

⚠️ `'unsafe-inline'` 和 `'unsafe-eval'` 是必须的,因为 CodeMirror + marked 用了 inline 脚本。

### HTTPS

**所有平台都默认 HTTPS**。如要 HTTP,加:

```
Permissions-Policy: 
  clipboard-read=*, 
  clipboard-write=*
```

---

## 📊 监控(可选)

### 简单统计(不收集用户数据)

Cloudflare Web Analytics(免费,无 cookie,GDPR 友好):

```html
<!-- index.html <head> 末尾加 -->
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" 
        data-cf-beacon='{"token": "your-token"}'></script>
```

### 详细统计(Google Analytics)

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXX');
</script>
```

⚠️ 国内访问 GA 慢,建议改用百度统计。

---

## 📚 参考资料

- [PWA 文档](https://web.dev/progressive-web-apps/)
- [Service Worker 生命周期](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Vercel 部署](https://vercel.com/docs)
- [Cloudflare Pages 部署](https://developers.cloudflare.com/pages/)
- [阿里云 OSS 静态网站托管](https://help.aliyun.com/product/31815.html)