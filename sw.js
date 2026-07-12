/**
 * 马克档 Service Worker
 *
 * 缓存策略：
 * - 静态资源 (HTML/JS/CSS/SVG) → Cache First，命中直接返回
 * - 同源请求 → Stale While Revalidate
 * - 跨域 (CDN) → Network First，失败回退缓存
 * - 大于 2MB 的请求不缓存（避免占空间）
 *
 * 离线时：
 * - 缓存的资源正常显示
 * - marked.js CDN 失败时回退到本地 vendor/marked.min.js
 */

const VERSION = 'v1.0.12';
const CACHE_STATIC = `markdoc-static-${VERSION}`;
const CACHE_RUNTIME = `markdoc-runtime-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './logo.svg',
  './manifest.json',
  './vendor/marked.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 安装：预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing', VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch 拦截
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只处理 GET
  if (req.method !== 'GET') return;

  // 不缓存大文件 (>2MB)
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) return;

  const url = new URL(req.url);

  // 跨域（CDN）→ Network First
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 同源静态资源 → Cache First
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(req);
  if (cached) {
    // 后台异步更新缓存
    fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    // 完全离线且没缓存 → 返回 index.html (SPA 兜底)
    return cache.match('./index.html') || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_RUNTIME);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // CDN 失败 + 没缓存 → 返回本地 marked.js
    if (req.url.includes('marked')) {
      return cache.match('./vendor/marked.min.js') ||
             await caches.open(CACHE_STATIC).then((c) => c.match('./vendor/marked.min.js'));
    }
    return new Response('Network failed', { status: 503 });
  }
}

// 监听消息：手动更新缓存
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => event.ports[0]?.postMessage({ cleared: true }));
  }
});