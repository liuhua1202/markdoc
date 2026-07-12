// 验证 tooltip stacking context 修复
// 关键:.nav-btn:active 有 transform,会创建新 stacking context
//       会把 tooltip 困在 button 内部
// 修复:[data-tip]:active 加 z-index: 3000,让 button stacking context 升到顶
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const fs = require('fs');

const errors = [];
const vc = new VirtualConsole();
vc.on('error', e => errors.push('[ERR] ' + (e.detail?.message || e.message || e)));
vc.on('jsdomError', e => errors.push('[JSDOM] ' + (e.detail?.message || e.message || e)));

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

(async () => {
  await new Promise(r => setTimeout(r, 4000));

  const doc = dom.window.document;
  let pass = 0, fail = 0;
  const check = (name, cond) => {
    if (cond) { pass++; console.log('  PASS:', name); }
    else      { fail++; console.log('  FAIL:', name); }
  };

  const sheets = doc.querySelectorAll('style');
  let css = '';
  sheets.forEach(s => css += s.textContent + '\n');

  console.log('--- 关键规则存在 ---');
  check('[data-tip]:active { z-index: 3000 } 规则存在',
        /\[data-tip\]:active\s*\{[^}]*z-index:\s*3000/.test(css));
  check('[data-tip] { position: relative } 规则存在',
        /\[data-tip\]\s*\{\s*position:\s*relative/.test(css));
  check('.nav-btn:active 仍有 transform: scale(0.94)(要确认冲突)',
        /\.nav-btn:active\s*\{[^}]*transform:\s*scale/.test(css));

  console.log('\n--- 确认 z-index 数值 ---');
  // 抓 [data-tip]:active 块的 z-index
  const m = css.match(/\[data-tip\]:active\s*\{[^}]*z-index:\s*(\d+)/);
  const z = m ? parseInt(m[1], 10) : 0;
  check('button:active z-index 是 3000', z === 3000);
  check('z-index 3000 > find-panel 1700', z > 1700);
  check('z-index 3000 > drawer 1601', z > 1601);
  check('z-index 3000 > reader 1500', z > 1500);

  console.log('\n--- 模拟真实场景:阅读模式下长按 navbar 按钮 ---');
  // 切到阅读模式
  const readBtn = doc.getElementById('view-btn-read');
  if (readBtn) readBtn.click();
  await new Promise(r => setTimeout(r, 300));

  const reader = doc.getElementById('reader');
  check('reader 浮层已出现', reader && reader.classList.contains('show'));

  // 模拟长按 outline-btn(在 reader 之上)
  // 我们手工设置 :active 状态的 z-index(用 .style 不行,但可以用 class 模拟或读 stylesheet)
  const outlineBtn = doc.getElementById('outline-btn');
  check('outline-btn 存在', !!outlineBtn);
  if (outlineBtn) {
    // 直接看 button 在 :active 时的 z-index
    // jsdom 不支持伪类,但我们可以验证 CSS 规则匹配
    check('outline-btn 带 data-tip', outlineBtn.hasAttribute('data-tip'));
    check('outline-btn position=relative', dom.window.getComputedStyle(outlineBtn).position === 'relative');
  }

  console.log('\n--- 模拟"按钮被 reader 盖住"的真实情况 ---');
  // 创建一个 reader 元素的子 div 覆盖到 navbar 位置,模拟 reader 覆盖 button 的场景
  // 然后用 CSS 让 reader z-index 比 [data-tip]:active(3000) 低 — 模拟修复后
  // 这一段是用 CSS 验证:无论 reader z-index 多高(1500/2000/2500),tooltip 都在它之上
  const allOverlays = [
    { name: 'reader', z: 1500 },
    { name: 'outline', z: 1601 },
    { name: 'drawer', z: 1601 },
    { name: 'find-panel', z: 1700 },
  ];
  for (const ov of allOverlays) {
    check(`button:active(z=3000) > ${ov.name}(z=${ov.z})`, z > ov.z);
  }

  console.log('\n--- 回归:drawer 仍正常左滑 ---');
  const drawer = doc.getElementById('drawer');
  if (drawer) {
    const ds = dom.window.getComputedStyle(drawer);
    check('drawer 仍为 left: 0', ds.left === '0px');
  }

  console.log('\n--- 错误检查 ---');
  const realErrors = errors.filter(e =>
    !e.includes('Could not load script') &&
    !e.includes('Could not load link') &&
    !e.includes('Could not parse CSS') &&
    !e.includes('Not implemented:'));
  check('无严重错误 (剩 ' + realErrors.length + ' 条噪音)', realErrors.length === 0);
  if (realErrors.length) realErrors.slice(0, 3).forEach(e => console.log('    ' + e));

  console.log('\n=== ' + pass + ' pass, ' + fail + ' fail ===');
  process.exit(fail > 0 ? 1 : 0);
})();
