# 架构说明

> 马克档(Markdown Mobile Browser)的技术架构详解。

---

## 🎯 核心原则

**One HTML, Four Platforms** — 一个 `index.html`(200KB)通过渐进增强,同时跑在 Web / Android / macOS / iOS 上。

为什么这么做?

1. **维护成本最小化** — 改一处,全平台生效
2. **行为完全一致** — 不存在"Android 修了 iOS 漏修"
3. **Web 调试最快** — Chrome DevTools,完爆任何 native 调试器
4. **降级方案天然** — Web 走不通还能跑 Electron WebView

---

## 🧬 单页应用的内部结构

```
index.html
├── <head>
│   ├── 主题 CSS(less → css 编译,内联)
│   ├── marked.js(渲染)
│   ├── highlight.js(代码高亮)
│   ├── KaTeX(数学)
│   ├── Mermaid(图表)
│   └── CodeMirror 6(编辑)
│
├── <body>
│   ├── #splash          ← 启动页
│   ├── #navbar          ← 顶部导航(标题 / 操作)
│   ├── #toolbar         ← 编辑工具栏(B/I/H1-6/.../AI)
│   ├── #main
│   │   ├── #editor      ← CodeMirror 实例
│   │   └── #preview-content  ← 渲染结果
│   ├── #drawer          ← 侧边栏(文档列表)
│   ├── #docs-btn        ← 文档切换 FAB
│   ├── #ai-panel        ← AI 助手面板
│   └── #more-btn        ← 更多(主题/字体/字号/...)
│
├── <script>
│   ├── platform.js      ← 平台探测 + 能力矩阵
│   ├── store.js         ← 状态管理(reactive)
│   ├── theme.js         ← 主题系统
│   ├── editor.js        ← CodeMirror 集成
│   ├── render.js        ← marked + hljs + KaTeX + Mermaid
│   ├── sync.js          ← WebDAV 同步
│   ├── ai.js            ← AI 助手
│   ├── templates.js     ← 文档模板
│   ├── search.js        ← 搜索 + 查找替换
│   ├── tabs.js          ← 多标签管理
│   ├── files.js         ← 文件操作(导入/导出/分享)
│   ├── main.js          ← 启动入口
│   └── boot.js          ← 启动序列
│
└── <script>
    └── SW registration
```

每个 JS 模块在 `window.MD` 命名空间下,按需加载。

---

## 🔌 平台抽象层(Platform Abstraction)

`platform.js` 探测当前环境,提供统一 API:

```js
const platform = {
  // 基础能力
  canCopy: true,
  canShare: typeof navigator.share === 'function',
  canFileSystem: false,
  canOffline: true,

  // 文件操作
  saveFile: async (name, content) => { ... },
  readFile: async (name) => { ... },
  pickFile: async () => { ... },

  // 系统集成
  setWindowTitle: (title) => { ... },
  exitApp: () => { ... },
  getVersion: () => { ... },

  // 平台特定
  openExternal: (url) => { ... },
  showToast: (msg) => { ... },
  vibrate: (ms) => { ... },
};
```

不同平台注入不同实现:

| 平台 | 实现 | 文件 |
|---|---|---|
| Web | `window.MD.platform` (Web API) | `index.html` 内置 |
| Android | `window.AndroidBridge` (JS Interface) | `android-app/.../MainActivity.kt` |
| macOS | `window.electronAPI` (preload contextBridge) | `desktop-app/src/preload.js` |
| iOS | `window.webkit.messageHandlers` | `ios-app/.../ViewController.swift` |

---

## 🎨 主题系统

```js
class ThemeManager {
  modes = ['light', 'dark', 'sepia', 'eye-care'];
  fonts = ['system', 'serif', 'sans'];
  sizes = ['sm', 'md', 'lg', 'xl'];  // 14/16/18/20px
  lineHeights = ['tight', 'normal', 'loose'];  // 1.4/1.6/1.8

  apply() {
    document.documentElement.dataset.theme = this.mode;
    document.documentElement.dataset.font = this.font;
    document.documentElement.dataset.size = this.size;
    document.documentElement.dataset.lh = this.lineHeight;
  }
}
```

CSS 用 `[data-theme=dark]` 选择器切换,无需重渲染。

### 暗色模式适配

**关键**:MIUI WebView(小米 HyperOS)的 `window.matchMedia` 是 undefined。

```js
// ✅ 正确
const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

// ❌ 错误 - 在 MIUI 上会崩
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
```

---

## 📝 渲染流水线

```
Markdown 文本
    ↓
marked.parse()  →  HTML 字符串
    ↓
DOMPurify.sanitize()  →  安全 HTML
    ↓
hljs.highlightAll()  →  代码高亮
    ↓
KaTeX.render()  →  公式
    ↓
Mermaid.render()  →  SVG 图表
    ↓
插入 #preview-content
    ↓
滚动到对应位置
```

**优化点**:
- 大量内容(>5000 字)用 `requestIdleCallback` 分块渲染
- Mermaid 懒加载(只在视口内的图表才渲染)
- KaTeX 预加载字体,首次渲染零阻塞
- 搜索结果用 `<mark>` 高亮,不重新渲染

---

## ☁️ 数据存储

### Web
- **LocalStorage** — 文档内容、设置、模板
- **IndexedDB** (未来)— 大文件、图片缓存

### Android
- **SharedPreferences** — 设置
- **app private dir** — 文档(`files/markdown/`)

### macOS
- **app data dir** — 文档
- **UserDefaults** — 设置

### iOS
- **Documents** — 文档
- **NSUserDefaults** — 设置

所有平台通过 `platform.js` 抽象,业务代码无感。

---

## 🤖 AI 助手架构

```js
class AIAssistant {
  presets = [
    { id: 'summarize', name: '总结', prompt: '请总结以下内容...' },
    { id: 'translate', name: '翻译', prompt: '请翻译为英文...' },
    { id: 'explain',  name: '解释', prompt: '请详细解释...' },
    { id: 'proofread', name: '纠错', prompt: '请检查错别字...' },
    { id: 'expand',   name: '扩写', prompt: '请扩写为更长版本...' },
  ];

  async run(presetId, text) {
    const preset = this.presets.find(p => p.id === presetId);
    const prompt = preset.prompt + '\n\n' + text;

    // 调用户配置的 API
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    return await response.json();
  }
}
```

支持的 provider:
- OpenAI 兼容 API(OpenAI / DeepSeek / 智谱 / 阿里云百炼 / Ollama / LM Studio)
- 用户填 endpoint + API key + model name

---

## 🔄 WebDAV 同步

```js
class WebDAVSync {
  config = {
    endpoint: 'https://dav.jianguoyun.com/dav/',  // 坚果云
    username: '...',
    password: '...',
    remoteDir: '/MarkdownPad',
  };

  async push(docName, content) {
    const url = this.config.endpoint + this.config.remoteDir + '/' + docName;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${this.config.username}:${this.config.password}`),
        'Content-Type': 'text/markdown',
      },
      body: content,
    });
    return response.ok;
  }

  async pull(docName) {
    // 类似,GET 请求
  }

  async list() {
    // PROPFIND 请求
  }
}
```

**冲突处理**:本地时间戳 vs 远程时间戳,后写者胜(Last-Write-Wins)。

---

## 🚀 启动序列

```js
// boot.js
async function boot() {
  // 1. 隐藏 splash(必须有 fallback timer,防止 boot 失败卡死)
  const splashTimer = setTimeout(() => hideSplash(), 1500);
  const errorTimer  = setTimeout(() => showBootError('启动超时'), 3500);

  try {
    // 2. 探测平台
    platform.detect();

    // 3. 加载用户设置
    const settings = await storage.loadSettings();

    // 4. 恢复最后会话
    const docs = await storage.loadAllDocs();

    // 5. 初始化 UI
    initTheme(settings.theme);
    initEditor();
    initDrawer(docs);

    // 6. 初始化平台桥
    await platform.init();

    // 7. 注册 Service Worker(仅 Web)
    if (platform.isWeb) registerSW();

    // 8. 启动完成
    clearTimeout(splashTimer);
    clearTimeout(errorTimer);
    hideSplash();
  } catch (err) {
    clearTimeout(splashTimer);
    showBootError(err.message);
  }
}
```

**关键**:splash **必须**有 fallback timer(1500ms),boot 错误必须有兜底提示(3500ms)。
否则 MIUI 旧 WebView 启动失败时用户看到一个白屏,不知道是死是活。

---

## 📊 性能策略

### 1. 懒加载
- Mermaid(2MB):只在第一个图表出现时加载
- KaTeX 字体:首次公式出现时下载并缓存
- AI 模块:首次点 AI 按钮时加载

### 2. 防抖
- 编辑 → 预览:`requestAnimationFrame` 合并多次输入
- 自动保存:1.5s 防抖
- 搜索:300ms 防抖

### 3. 虚拟滚动(未来)
- 文档 > 10000 字时,只渲染视口内的内容
- 暂未实现,优先保证 95% 场景流畅

### 4. 缓存
- Service Worker(仅 Web):缓存 `vendor/` 库 + 用户文档
- Android WebView:`Cache-Control: max-age=31536000` + manifest 哈希

---

## 🧪 测试

### 单元测试
暂未建立(单文件架构,目前靠手动)。未来可加:
- jsdom 模拟环境
- 测试 marked 渲染快照
- 测试主题切换
- 测试 WebDAV 协议

### 集成测试
- `tests/headless-boot.py` — jsdom 启动并验证关键元素
- 手测:每个平台启动一遍,确保功能一致

### 端到端
- Playwright(未来):全平台 E2E

---

## 📈 未来演进

| 阶段 | 计划 |
|---|---|
| **v1.1** | 提取核心为 `core.js`,可在 Worker 跑(更快渲染) |
| **v1.2** | 引入 Lit(轻量 Web Components),组件化 |
| **v1.3** | 拆分单文件为多文件 + Vite 构建(更易维护) |
| **v2.0** | 加 Service Worker 共享编辑状态(协同) |

暂不打算拆分,单文件反而是最大优势。

---

## 📚 延伸阅读

- [marked.js 文档](https://marked.js.org/)
- [CodeMirror 6 系统指南](https://codemirror.net/docs/system/)
- [KaTeX 性能优化](https://katex.org/docs/font.html)
- [MIUI WebView 兼容性](https://web.dev/articles/webview)