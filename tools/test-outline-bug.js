// 回归测试:验证大纲点击修复
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const INDEX = path.resolve(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');

const vc = new VirtualConsole();
const allLogs = [];
const errors = [];
vc.on('log', (...args) => allLogs.push(args.join(' ')));
vc.on('info', (...args) => allLogs.push('[info] ' + args.join(' ')));
vc.on('warn', (...args) => allLogs.push('[warn] ' + args.join(' ')));
vc.on('error', (...args) => errors.push('[err] ' + args.join(' ')));
vc.on('jsdomError', (e) => {
  const msg = e.detail?.message || e.message || String(e);
  if (msg.includes('Could not load') || msg.includes('Could not parse CSS')) return;
  errors.push('[jsdom] ' + msg);
});

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    const slugCache = new Map();
    const slugify = (s) => {
      if (slugCache.has(s)) return slugCache.get(s);
      const slug = s.trim().toLowerCase()
        .replace(/[\u4e00-\u9fa5]/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || ('h-' + Math.random().toString(36).slice(2, 8));
      slugCache.set(s, slug);
      return slug;
    };
    window.marked = {
      Renderer: function () { this.heading = () => ''; this.code = () => ''; },
      parse(src) {
        const lines = (src || '').split('\n');
        const out = [];
        for (const line of lines) {
          const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
          if (m) {
            const level = m[1].length;
            const text = m[2];
            const id = slugify(text);
            out.push(`<h${level} id="${id}">${text}<a class="header-anchor" href="#${id}">#</a></h${level}>`);
          } else if (line.trim().startsWith('```')) {
            out.push('<pre><code></code></pre>');
          } else if (line.trim()) {
            out.push(`<p>${line}</p>`);
          }
        }
        return out.join('\n');
      },
      setOptions() {}, use() {},
    };
    window.hljs = { highlightElement() {} };
    window.MarkdownExtensions = {
      mermaidLoaded: true, katexLoaded: true,
      postProcess() {}, highlightCode() {}, renderMath() {}, renderMermaid() {},
    };
    window.HTMLElement.prototype.scrollIntoView = function () {
      const el = this;
      let node = el;
      while (node && node !== window.document.documentElement) {
        const sh = node.scrollHeight || 0;
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        // 真实浏览器:只要 overflowY 是 auto/scroll/hidden 且 sh > clientHeight 就滚
        // jsdom:scrollHeight 不计算,直接信任 overflowY:auto 的节点(它就是滚动容器)
        const cs = node.clientHeight || 0;
        const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') &&
                             (sh > cs || (sh === 0 && cs === 0));
        const isHiddenScroll = overflowY === 'hidden' && sh > 0;
        if (isScrollable || isHiddenScroll) {
          const rect = el.getBoundingClientRect();
          const parentRect = node.getBoundingClientRect();
          const offset = rect.top - parentRect.top + (node.scrollTop || 0);
          // jsdom 模拟:scrollTop 直接设为 offset
          node.scrollTop = Math.max(0, offset - 8);
          window.__lastScrollInfo = {
            node: node.tagName + (node.id ? '#' + node.id : ''),
            scrollTop: node.scrollTop,
            targetId: el.id,
          };
          return;
        }
        node = node.parentElement;
      }
      window.__lastScrollInfo = { node: 'NONE', targetId: el.id };
    };
    window.matchMedia = () => ({ addEventListener() {}, removeEventListener() {} });
    window.requestAnimationFrame = (fn) => setTimeout(fn, 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.CSS = window.CSS || { escape: (s) => String(s).replace(/[^\w-]/g, c => '\\' + c) };
  }
});

const { window } = dom;
const { document } = window;

const SAMPLE = `# 根标题

## 第一节
正文一

## 第二节
${Array.from({ length: 80 }, (_, i) => `填充行 ${i + 1}`).join('\n')}

### 子节
内容
`;

(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const editor = document.getElementById('editor');
  editor.value = SAMPLE;
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));

  const preview = document.getElementById('preview-content');
  const h2s = preview.querySelectorAll('h2');
  console.log(`渲染后 preview 内 h2 数: ${h2s.length}`);
  if (h2s.length < 2) {
    console.log('!! 渲染失败');
    allLogs.slice(-20).forEach(l => console.log(' >', l));
    process.exit(1);
  }

  let pass = 0, fail = 0;
  function assert(cond, label) {
    if (cond) { pass++; console.log(`  PASS  ${label}`); }
    else      { fail++; console.log(`  FAIL  ${label}`); }
  }

  // ---- 测试 1:编辑模式点击大纲 ----
  console.log('\n=== 测试 1:编辑模式 ===');
  document.getElementById('view-btn-edit').click();
  await new Promise(r => setTimeout(r, 100));

  document.getElementById('outline-btn').click();
  await new Promise(r => setTimeout(r, 200));
  let items = document.querySelectorAll('#outline-list .outline-item');
  console.log(`  outline items: ${items.length}, 文本: ${Array.from(items).map(i => i.dataset.text).join(' | ')}`);
  assert(items.length >= 2, '编辑模式:大纲有内容');
  // items 顺序:根标题, 第一节, 第二节, 子节
  assert(items[2].dataset.text === '第二节', '编辑模式:大纲 item 存了原始文本');

  // 关键:点击第二节后,光标应该定位到对应行
  window.__lastScrollInfo = 'PRE';
  items[2].click();
  await new Promise(r => setTimeout(r, 200));
  const editor2 = document.getElementById('editor');
  const selStart = editor2.selectionStart;
  const lines = editor2.value.split('\n');
  let lineIdx = 0, charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (selStart >= charCount && selStart <= charCount + lines[i].length) {
      lineIdx = i; break;
    }
    charCount += lines[i].length + 1;
  }
  console.log(`  光标行号: ${lineIdx}, 行内容: "${lines[lineIdx]}"`);
  assert(lines[lineIdx].includes('第二节'), '编辑模式:光标落在"第二节"行');
  assert(window.__lastScrollInfo === 'PRE', '编辑模式:不应触发 scrollIntoView(预览隐藏)');

  // 验证 close() 也移除了 mask
  const outlineMask = document.querySelector('.outline-mask');
  assert(!outlineMask.classList.contains('show'), '编辑模式:点击后 mask 也关闭了');

  // ---- 测试 2:阅读模式点击大纲 ----
  console.log('\n=== 测试 2:阅读模式 ===');
  document.getElementById('view-btn-read').click();
  await new Promise(r => setTimeout(r, 600));
  const reader = document.getElementById('reader');
  assert(reader?.classList.contains('show'), '阅读模式:reader overlay 已显示');

  const readerContent = document.getElementById('reader-content');
  console.log(`  reader-content h2 数: ${readerContent?.querySelectorAll('h2').length}`);

  document.getElementById('outline-btn').click();
  await new Promise(r => setTimeout(r, 200));
  items = document.querySelectorAll('#outline-list .outline-item');
  console.log(`  outline items: ${items.length}, 文本: ${Array.from(items).map(i => i.dataset.text).join(' | ')}`);
  assert(items.length >= 2, '阅读模式:大纲有内容(从 reader-content 取)');
  // 阅读模式:items[0]=reader-title, items[1]=# 根标题, items[2]=第一节, items[3]=第二节
  assert(items[3]?.dataset.text === '第二节', '阅读模式:大纲 item 存了原始文本');

  window.__lastScrollInfo = null;
  console.log(`  click 前 reader.show=${reader.classList.contains('show')}, reader scrollTop=${reader.scrollTop}`);
  // 调试 reader overlay 的滚动状态
  const readerCS = window.getComputedStyle(reader);
  console.log(`  reader overflowY=${readerCS.overflowY}, scrollHeight=${reader.scrollHeight}, clientHeight=${reader.clientHeight}`);
  console.log(`  readerContent.scrollHeight=${readerContent?.scrollHeight}`);
  items[3].click();
  await new Promise(r => setTimeout(r, 300));
  console.log(`  scrollIntoView 信息: ${JSON.stringify(window.__lastScrollInfo)}`);
  console.log(`  reader scrollTop (after): ${reader.scrollTop}`);
  // 阅读模式下,大纲 item 跳的 target 应该在 #reader-content 内,
  // 而 #reader 是 fixed + overflow-y:auto,所以 node 应该是 #reader
  assert(window.__lastScrollInfo && window.__lastScrollInfo.node === 'DIV#reader',
    '阅读模式:scrollIntoView 在 reader overlay 内执行');
  // jsdom 不计算 layout(scrollHeight=0),所以 scrollTop 数值看不出真实滚动,
  // 但确认走对了路径已经足够。真实浏览器中这里 reader.scrollTop > 0。
  assert(window.__lastScrollInfo.targetId === items[3].dataset.id,
    '阅读模式:滚到正确的目标标题(id 匹配)');

  // ---- 测试 3:边界 - 中文章幕 ----
  console.log('\n=== 测试 3:纯中文标题 ===');
  document.getElementById('view-btn-edit').click();
  await new Promise(r => setTimeout(r, 100));
  editor.value = '# 中文标题\n内容';
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  document.getElementById('outline-btn').click();
  await new Promise(r => setTimeout(r, 200));
  items = document.querySelectorAll('#outline-list .outline-item');
  console.log(`  outline items: ${items.length}`);
  if (items.length >= 1) {
    items[0].click();
    await new Promise(r => setTimeout(r, 100));
    const lines2 = editor.value.split('\n');
    const ss = editor.selectionStart;
    let found = false;
    for (let i = 0, c = 0; i < lines2.length; i++) {
      if (lines2[i].includes('中文标题') && (ss >= c && ss <= c + lines2[i].length)) { found = true; break; }
      c += lines2[i].length + 1;
    }
    assert(found, '纯中文标题:点击后光标落在标题行');
  }

  console.log(`\n=== 总结: ${pass} passed, ${fail} failed ===`);
  if (errors.length > 0) {
    console.log('\n=== JS 错误 ===');
    errors.forEach(e => console.log('  ' + e.slice(0, 250)));
  }
  process.exit(fail === 0 ? 0 : 1);
})();
