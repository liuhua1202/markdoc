// test-export-picker.js
// 验证 docs-panel 底部"导出"按钮触发 picker,支持多选 + 格式切换 + 单/批导出
// 验证 docs-panel 底部"导入"按钮支持 .md / .json 多选

const { JSDOM, VirtualConsole } = require('jsdom');

const errors = [];
const warnings = [];
const logs = [];

const vc = new VirtualConsole();
vc.on('error', e => errors.push('[ERR] ' + e));
vc.on('warn', e => warnings.push('[WARN] ' + e));
vc.on('log', (...args) => logs.push(args.join(' ')));
vc.on('jsdomError', e => errors.push('[JSDOM] ' + (e.detail?.message || e.message)));

// jsdom 不实现 URL.createObjectURL / revokeObjectURL,产物代码会用,先 stub
const _objectUrls = new Map();
let _idCounter = 0;
function stubUrl(window) {
  window.URL.createObjectURL = (blob) => {
    const id = `blob:test/${++_idCounter}`;
    _objectUrls.set(id, blob);
    return id;
  };
  window.URL.revokeObjectURL = (id) => {
    _objectUrls.delete(id);
  };
}

let dom;
(async () => {
  console.log('Loading from HTTP server...');
  dom = await JSDOM.fromURL('http://localhost:8765/index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  stubUrl(dom.window);

  await new Promise(r => setTimeout(r, 4000));

  const doc = dom.window.document;
  let failed = 0;
  const assert = (cond, label) => {
    const ok = !!cond;
    console.log(`  ${ok ? '\u2713' : '\u2717'} ${label}`);
    if (!ok) failed++;
  };

  // ----------------------------------------------------------------
  // 1) 导出按钮存在 & 类型正确
  // ----------------------------------------------------------------
  console.log('\n=== 1) btn-doc-export ===');
  const btnExport = doc.getElementById('btn-doc-export');
  assert(btnExport, 'btn-doc-export exists');
  assert(btnExport?.textContent.includes('导出'), 'label has 导出');

  // ----------------------------------------------------------------
  // 2) 导入按钮存在 & accept 包含 .md
  // ----------------------------------------------------------------
  console.log('\n=== 2) btn-doc-import 静态校验 ===');
  const btnImport = doc.getElementById('btn-doc-import');
  assert(btnImport, 'btn-doc-import exists');
  // import 是动态创建 input,直接验证代码 accept 字段需要 eval;
  // 这里只验证按钮存在 & label
  assert(btnImport?.textContent.includes('导入'), 'label has 导入');

  // ----------------------------------------------------------------
  // 3) 模拟点击导出,验证 picker DOM 出现
  // ----------------------------------------------------------------
  console.log('\n=== 3) 导出 picker 弹出 ===');
  btnExport.click();
  await new Promise(r => setTimeout(r, 300));

  const picker = doc.querySelector('.export-picker');
  assert(picker, '.export-picker mounted');
  assert(picker?.classList.contains('show'), 'picker has .show class');

  const title = picker?.querySelector('.ep-title');
  assert(title && /选择要导出的文档/.test(title.textContent), 'picker title');

  const tools = picker?.querySelectorAll('.ep-tool');
  assert(tools && tools.length === 3, `3 tool buttons (got ${tools?.length})`);
  const toolLabels = tools ? Array.from(tools).map(t => t.textContent.trim()) : [];
  console.log('    tools:', toolLabels);
  assert(toolLabels.includes('全选'), 'tool 全选');
  assert(toolLabels.includes('全不选'), 'tool 全不选');
  assert(toolLabels.includes('反选'), 'tool 反选');

  const fmts = picker?.querySelectorAll('.ep-format');
  assert(fmts && fmts.length === 3, `3 format options (got ${fmts?.length})`);
  const fmtLabels = fmts ? Array.from(fmts).map(f => f.textContent.trim()) : [];
  console.log('    formats:', fmtLabels);
  assert(fmtLabels.includes('.md'), 'format .md');
  assert(fmtLabels.includes('.json'), 'format .json');
  assert(fmtLabels.includes('打包'), 'format 打包');
  // 默认选中 json
  const activeFmt = picker?.querySelector('.ep-format.active');
  assert(activeFmt?.dataset.fmt === 'json', 'default format = json');

  const items = picker?.querySelectorAll('.ep-item');
  assert(items && items.length > 0, `>=1 doc items (got ${items?.length})`);
  console.log(`    items: ${items?.length}`);

  const count = picker?.querySelector('.ep-count');
  assert(count && count.textContent === '0', 'initial count = 0');

  // ----------------------------------------------------------------
  // 4) 选中 / 全选 / 反选 / 计数
  // ----------------------------------------------------------------
  console.log('\n=== 4) 多选交互 ===');
  // 点第一项
  items[0].click();
  await new Promise(r => setTimeout(r, 50));
  assert(items[0].classList.contains('checked'), 'first item checked');
  assert(count.textContent === '1', 'count = 1 after 1 click');

  // 全选:renderList 会重建 DOM,重新 query
  picker.querySelector('[data-tool="all"]').click();
  await new Promise(r => setTimeout(r, 50));
  let fresh = picker.querySelectorAll('.ep-item');
  assert(count.textContent === String(fresh.length), `count = ${fresh.length} after 全选`);
  assert(fresh[0].classList.contains('checked'), 'first item checked after 全选');

  // 全不选
  picker.querySelector('[data-tool="none"]').click();
  await new Promise(r => setTimeout(r, 50));
  fresh = picker.querySelectorAll('.ep-item');
  assert(count.textContent === '0', 'count = 0 after 全不选');
  assert(!fresh[0].classList.contains('checked'), 'first item unchecked after 全不选');

  // 反选(全不选状态下反选 = 全选)
  picker.querySelector('[data-tool="invert"]').click();
  await new Promise(r => setTimeout(r, 50));
  assert(count.textContent === String(fresh.length), `count = ${fresh.length} after 反选 from 0`);

  // ----------------------------------------------------------------
  // 5) 格式切换
  // ----------------------------------------------------------------
  console.log('\n=== 5) 格式切换 ===');
  const fmtMd = picker.querySelector('[data-fmt="md"]');
  fmtMd.click();
  await new Promise(r => setTimeout(r, 50));
  assert(fmtMd.classList.contains('active'), '.md active after click');
  assert(!picker.querySelector('[data-fmt="json"]').classList.contains('active'), '.json no longer active');

  // ----------------------------------------------------------------
  // 6) 空选状态确认 → toast
  // ----------------------------------------------------------------
  console.log('\n=== 6) 空选导出 → 提示 ===');
  picker.querySelector('[data-tool="none"]').click();
  await new Promise(r => setTimeout(r, 50));
  picker.querySelector('.ep-confirm').click();
  await new Promise(r => setTimeout(r, 100));
  assert(count.textContent === '0', 'still 0 selected');
  // picker 不应关闭
  assert(doc.querySelector('.export-picker'), 'picker still open after empty submit');

  // ----------------------------------------------------------------
  // 7) 确认导出 → 触发下载 + picker 关闭
  // ----------------------------------------------------------------
  console.log('\n=== 7) 确认导出 ===');
  let downloadCount = 0;
  // jsdom 默认 createObjectURL 返回 blob:null/<id>,监听 click on <a download>
  const origClick = dom.window.HTMLAnchorElement.prototype.click;
  dom.window.HTMLAnchorElement.prototype.click = function () {
    if (this.download) {
      downloadCount++;
      console.log(`    download: ${this.download}`);
    }
    return origClick.call(this);
  };

  picker.querySelector('[data-tool="all"]').click();
  await new Promise(r => setTimeout(r, 50));
  // 选 .md 格式,逐个下
  picker.querySelector('[data-fmt="md"]').click();
  await new Promise(r => setTimeout(r, 50));
  picker.querySelector('.ep-confirm').click();

  // 等待 setTimeout 错开的下载全部触发 + picker 关闭(220ms transition)
  await new Promise(r => setTimeout(r, items.length * 120 + 350));
  assert(downloadCount === items.length, `triggered ${items.length} downloads (got ${downloadCount})`);
  assert(!doc.querySelector('.export-picker'), 'picker closed after export');

  // ----------------------------------------------------------------
  // 8) bundle 模式: 1 个下载
  // ----------------------------------------------------------------
  console.log('\n=== 8) bundle 模式 ===');
  btnExport.click();
  await new Promise(r => setTimeout(r, 300));
  const picker2 = doc.querySelector('.export-picker');
  assert(picker2, 'picker reopened');
  picker2.querySelector('[data-tool="all"]').click();
  await new Promise(r => setTimeout(r, 50));
  picker2.querySelector('[data-fmt="bundle"]').click();
  await new Promise(r => setTimeout(r, 50));
  downloadCount = 0;
  picker2.querySelector('.ep-confirm').click();
  await new Promise(r => setTimeout(r, 350));
  assert(downloadCount === 1, `bundle = 1 download (got ${downloadCount})`);
  assert(!doc.querySelector('.export-picker'), 'picker closed after bundle');

  // ----------------------------------------------------------------
  // 9) mask 点击关闭
  // ----------------------------------------------------------------
  console.log('\n=== 9) mask 关闭 ===');
  btnExport.click();
  await new Promise(r => setTimeout(r, 300));
  const picker3 = doc.querySelector('.export-picker');
  assert(picker3, 'picker opened again');
  picker3.querySelector('.ep-mask').click();
  await new Promise(r => setTimeout(r, 350));
  assert(!doc.querySelector('.export-picker'), 'picker closed after mask click');

  // ----------------------------------------------------------------
  // 10) import 按钮 — 复用静态 #file-input
  // (注:本测试只验导出 picker,导入逻辑在 test-import-redesign.js)
  // ----------------------------------------------------------------
  console.log('\n=== 10) import 按钮 — 复用静态 file-input ===');
  const staticFileInput = doc.getElementById('file-input');
  assert(staticFileInput, 'static #file-input exists');
  assert(staticFileInput.accept.includes('.md'), `accept includes .md (got: ${staticFileInput.accept})`);
  assert(staticFileInput.accept.includes('.json'), 'accept includes .json');
  assert(staticFileInput.multiple === true, 'multiple = true');
  // 文档库 import 按钮不应动态创建 input(避免 WebView 兼容问题)
  const origCreate2 = doc.createElement.bind(doc);
  let dynamicInputCreated2 = false;
  doc.createElement = function (tag) {
    const el = origCreate2(tag);
    if (tag === 'input') dynamicInputCreated2 = true;
    return el;
  };
  btnImport.click();
  await new Promise(r => setTimeout(r, 50));
  assert(!dynamicInputCreated2, 'btn-doc-import does not dynamically create input');
  assert(staticFileInput.dataset.target === 'library', `target = library (got: ${staticFileInput.dataset.target})`);
  doc.createElement = origCreate2;

  // ----------------------------------------------------------------
  console.log('\n=== 日志 (last 5) ===');
  logs.slice(-5).forEach(l => console.log('  ', l));
  console.log('\n=== 错误 (' + errors.length + ') ===');
  errors.slice(0, 10).forEach(e => console.log('  ', e));
  console.log('\n=== 警告 (' + warnings.length + ') ===');
  warnings.slice(0, 5).forEach(w => console.log('  ', w));

  console.log(`\n=== ${failed === 0 ? 'PASS' : 'FAIL'} ===`);
  process.exit(failed === 0 ? 0 : 1);
})();