// 追踪脚本执行流
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const INDEX_HTML = path.resolve(__dirname, '..', 'android-app', 'app', 'src', 'main', 'assets', 'index.html');

const savedViewMode = process.argv[2] || null;
console.log(`Scenario: savedViewMode=${savedViewMode || '(null)'}`);

let html = fs.readFileSync(INDEX_HTML, 'utf8');
// 注入追踪脚本
html = html.replace(
  '<script>',
  `<script>
    window.__trace = [];
    function trace(msg) { window.__trace.push(msg); }
    const _origSafe = null;  // placeholder
  </script>
  <script>`
);

// 在 Reader.open 前后插桩（用全局标记，避免被新代码干扰）
html = html.replace(
  'open() {',
  `open() { window.__trace.push('Reader.open ENTER, isOpen=' + this.isOpen);`
);
html = html.replace(
  /this\.isOpen = true;/g,
  `window.__trace.push('Reader.open: setting isOpen=true (line matched)'); this.isOpen = true;`
);
html = html.replace(
  'if (typeof ContentManager !== \'undefined\') {',
  `trace('Reader.open: about to call ContentManager.save, ContentManager.editor=' + (ContentManager && ContentManager.editor)); if (typeof ContentManager !== 'undefined') {`
);
html = html.replace(
  'ContentManager.save();',
  `trace('Reader.open: calling ContentManager.save()'); try { ContentManager.save(); trace('Reader.open: ContentManager.save ok'); } catch(e) { trace('Reader.open: ContentManager.save THREW: ' + e.message); throw e; }`
);

// 在 Reader.close 前后插桩
html = html.replace(
  'close() {',
  `close() { trace('Reader.close start, isOpen=' + this.isOpen + ', el=' + (this.el ? this.el.id : 'null'));`
);

// 在 ViewManager.set 前后插桩
html = html.replace(
  'set(mode, save = true) {',
  `set(mode, save = true) { trace('ViewManager.set(' + mode + ',' + save + ')');`
);

// 在 boot 的 safe 包装中插桩
html = html.replace(
  "const safe = (name, fn) => {",
  `const safe = (name, fn) => { trace('safe(' + name + ') start');`
);
html = html.replace(
  "const msg = `[Boot] ${name} 失败: ${e && e.message ? e.message : String(e)}`;",
  "trace('safe(' + name + ') FAILED: ' + (e && e.message)); const msg = `[Boot] ${name} 失败: ${e && e.message ? e.message : String(e)}`;"
);

const vc = new VirtualConsole();
const errors = [];
vc.on('error', e => errors.push('[ERR] ' + (e.message || String(e))));
vc.on('jsdomError', e => {
  const msg = e.detail?.message || e.message || String(e);
  if (msg.includes('Could not load') || msg.includes('Could not parse CSS')) return;
  errors.push('[JSDOM] ' + msg);
});

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    if (savedViewMode) {
      // 预填充 localStorage
      try {
        window.localStorage.setItem('markdoc.viewMode.v1', savedViewMode);
      } catch (e) {
        console.log('localStorage.setItem failed:', e.message);
      }
    }
  }
});

(async () => {
  await new Promise(r => setTimeout(r, 4500));
  const trace = dom.window.__trace || [];
  console.log('\n=== Trace (' + trace.length + ' events) ===');
  trace.forEach((t, i) => console.log(`  ${i}: ${t}`));

  // 检查启动后状态
  const reader0 = dom.window.document.getElementById('reader');
  const rb0 = dom.window.document.getElementById('view-reader');
  console.log('\n[启动后状态]');
  console.log('  reader DOM:', reader0 ? 'exists' : 'null');
  console.log('  reader.show:', reader0?.classList.contains('show'));
  console.log('  readerBtn.active:', rb0?.classList.contains('active'));

  console.log('\n=== 点击 reader ===');
  trace.length = 0;
  dom.window.document.getElementById('view-reader').click();
  await new Promise(r => setTimeout(r, 200));
  trace.forEach((t, i) => console.log(`  ${i}: ${t}`));

  const reader = dom.window.document.getElementById('reader');
  console.log('\n  reader.show:', reader?.classList.contains('show'));
  console.log('  readerBtn.active:', dom.window.document.getElementById('view-reader').classList.contains('active'));

  console.log('\n=== 点击 split ===');
  trace.length = 0;
  dom.window.document.getElementById('view-split').click();
  await new Promise(r => setTimeout(r, 200));
  trace.forEach((t, i) => console.log(`  ${i}: ${t}`));

  console.log('\n=== 再次点击 reader ===');
  trace.length = 0;
  dom.window.document.getElementById('view-reader').click();
  await new Promise(r => setTimeout(r, 200));
  trace.forEach((t, i) => console.log(`  ${i}: ${t}`));
  const reader2 = dom.window.document.getElementById('reader');
  console.log('  reader.show:', reader2?.classList.contains('show'));
  console.log('  readerBtn.active:', dom.window.document.getElementById('view-reader').classList.contains('active'));

  console.log('\n=== Errors ===');
  errors.slice(0, 5).forEach(e => console.log(' ', e));
  process.exit(0);
})();