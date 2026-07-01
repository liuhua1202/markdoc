# 马克档 · 部署指南

> Web / PWA 版本可以部署到任何静态托管服务。

---

## 方式 1:GitHub Pages（推荐,免费）

### 一次性配置

1. 把项目推到 GitHub repo
2. 仓库 `Settings → Pages → Source: GitHub Actions`
3. 推送代码后自动触发 `.github/workflows/pages.yml`

### 自动部署流程

- 推 `main` 分支 → 自动构建 → 自动部署到 `https://<user>.github.io/<repo>/`
- 几分钟后生效
- HTTPS 自动配置

### 自定义域名

1. `Settings → Pages → Custom domain` 输入你的域名
2. 在域名 DNS 添加 CNAME 记录指向 `<user>.github.io`
3. 启用 `Enforce HTTPS`

---

## 方式 2:Vercel（免费 + 全球 CDN）

### 最简部署

```bash
npm i -g vercel
cd markdown
vercel --prod
```

会要求登录 Vercel 账号（GitHub 登录即可），然后自动识别 `vercel.json` 部署。

### 特性

- 全球边缘网络（CDN）
- 自动 HTTPS
- 预览部署（每个 PR 一个临时 URL）
- `vendor/` 和 `icons/` 设置了 1 年缓存
- `sw.js` 每次强制刷新

---

## 方式 3:Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=public
```

或直接拖 `public/` 到 Netlify Dashboard。

---

## 方式 4:任意 Nginx 服务器

```nginx
server {
    listen 443 ssl http2;
    server_name markdoc.example.com;

    root /var/www/markdown/public;
    index index.html;

    # SPA 路由 fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 缓存 vendor/ 和 icons/ 一年
    location ~* ^/(vendor|icons)/ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker 立即更新
    location = /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }
}
```

---

## 方式 5:Cloudflare Pages

1. 登录 Cloudflare Dashboard → Pages
2. 连接 GitHub repo,选 `public/` 作为构建输出目录
3. 自动部署,自动 HTTPS,全球 CDN

---

## 方式 6:阿里云 OSS / 腾讯云 COS

把 `public/` 整个目录上传到对象存储，开启静态网站托管，绑定自定义域名。

---

## 验证清单

部署后检查：

- [ ] 打开 URL,首屏启动页正常显示
- [ ] 编辑器显示示例文档
- [ ] 输入有 Markdown 实时预览
- [ ] DevTools Console 无 404 错误
- [ ] DevTools Application → Service Workers 显示已注册
- [ ] DevTools Application → Manifest 显示 PWA 信息
- [ ] Lighthouse PWA 评分 90+
- [ ] 关闭网络后刷新页面,仍能访问（Service Worker 缓存）
- [ ] 浏览器地址栏右侧出现「安装」图标

---

## 性能优化建议

- 用 Cloudflare / Vercel / Netlify 都自带 CDN
- vendor/mermaid.min.js 是 2.5 MB,只在文档含 ` ```mermaid ` 时加载
- vendor/highlight.min.js 总是加载（122 KB,可接受）
- vendor/katex 懒加载（~300 KB）

---

## 自定义域名 + HTTPS

所有现代托管服务都自动 HTTPS，无需配置。

如果用自己服务器：
- Let's Encrypt 免费证书
- certbot 自动续期

---

## 内容安全策略（CSP）

如需启用 CSP 严格模式，在 `<head>` 添加：

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*;">
```

注意 marked.js 解析的 HTML 会触发 CSP 警告，如果启用了严格的 `unsafe-inline`，预览可能受限。建议开发阶段不加 CSP，正式发布再考虑。