// 验证本次改动:大纲左滑 + 编辑/阅读 toggle
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const fs = require('fs');

const errors = [];
const vc = new VirtualConsole();
vc.on('error', e => errors.push('[ERR] ' + (e.detail?.message || e.message || e)));
vc.on('jsdomError', e => errors.push('[JSDOM] ' + (e.detail?.message || e.message || e)));

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');

// 注入 base + 必要 script src
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

  console.log('--- 大纲面板位置 ---');
  // 创建 outline 面板(它动态创建)
  dom.window.eval('Outline.open()');
  await new Promise(r => setTimeout(r, 200));
  const outlinePanel = doc.querySelector('.outline-panel');
  check('outline-panel 存在', !!outlinePanel);
  if (outlinePanel) {
    const style = dom.window.getComputedStyle(outlinePanel);
    check('outline-panel position = fixed', style.position === 'fixed');
    check('outline-panel left = 0px', style.left === '0px');
    check('outline-panel right = auto (不是 0)', style.right === 'auto');
    // 大纲 CSS 通过动态 <style> 注入,检查 sheet 内容
    const styleEls = doc.querySelectorAll('style');
    let sheetText = '';
    styleEls.forEach(s => sheetText += s.textContent + '\n');
    check('CSS 含 outline-panel left:0', /outline-panel[^}]*left:\s*0/.test(sheetText));
    check('CSS 含 outline-panel translateX(-100%)', /outline-panel[^}]*translateX\(-100%/.test(sheetText));
  }

  console.log('\n--- pill 开关(两个图标按钮:铅笔=编辑,书=阅读) ---');
  const toggle = doc.getElementById('view-toggle');
  const editBtn = doc.getElementById('view-btn-edit');
  const readBtn = doc.getElementById('view-btn-read');
  check('view-toggle pill 容器存在', !!toggle);
  check('view-btn-edit 存在', !!editBtn);
  check('view-btn-read 存在', !!readBtn);
  check('pill 包含两个按钮', toggle && toggle.querySelectorAll('button').length === 2);
  check('编辑按钮是 SVG 图标(2 path 铅笔)', editBtn && editBtn.querySelectorAll('path').length === 2);
  check('阅读按钮是 SVG 图标(2 path 书)', readBtn && readBtn.querySelectorAll('path').length === 2);
  check('默认 编辑按钮 active', editBtn && editBtn.classList.contains('active'));
  check('默认 阅读按钮 not active', readBtn && !readBtn.classList.contains('active'));
  check('默认 编辑按钮 aria-selected=true', editBtn && editBtn.getAttribute('aria-selected') === 'true');
  check('默认 阅读按钮 aria-selected=false', readBtn && readBtn.getAttribute('aria-selected') === 'false');

  // 记录点击前 pill 位置(关键:切换时位置不能变)
  const rectBefore = toggle.getBoundingClientRect();
  const xBefore = rectBefore.x;
  const yBefore = rectBefore.y;

  console.log('\n--- 点击阅读按钮切到阅读模式 ---');
  if (readBtn) readBtn.click();
  await new Promise(r => setTimeout(r, 200));
  check('Reader 浮层出现', !!doc.getElementById('reader'));
  check('navbar data-mode=reader', doc.getElementById('navbar').getAttribute('data-mode') === 'reader');
  check('阅读按钮变 active', readBtn.classList.contains('active'));
  check('编辑按钮取消 active', !editBtn.classList.contains('active'));
  check('阅读按钮 aria-selected=true', readBtn.getAttribute('aria-selected') === 'true');
  check('编辑按钮 aria-selected=false', editBtn.getAttribute('aria-selected') === 'false');

  // 阅读模式下 navbar 所有按钮都常驻可见(用户要求)
  const docsBtn = doc.getElementById('docs-btn');
  const outlineBtn = doc.getElementById('outline-btn');
  const moreBtn = doc.getElementById('more-btn');
  const themeBtn = doc.getElementById('theme-toggle');
  check('阅读模式下 docs-btn 仍然可见', docsBtn && dom.window.getComputedStyle(docsBtn).display !== 'none');
  check('阅读模式下 outline-btn 仍然可见', outlineBtn && dom.window.getComputedStyle(outlineBtn).display !== 'none');
  check('阅读模式下 more-btn 仍然可见', moreBtn && dom.window.getComputedStyle(moreBtn).display !== 'none');
  check('阅读模式下 theme-toggle 仍然可见', themeBtn && dom.window.getComputedStyle(themeBtn).display !== 'none');
  check('阅读模式下 pill 仍然可见', dom.window.getComputedStyle(toggle).display !== 'none');

  // 关键断言:pill 位置在切换前后保持不变
  const rectInRead = toggle.getBoundingClientRect();
  check('pill X 位置不变(关键 UX 需求)', Math.abs(rectInRead.x - xBefore) < 1);
  check('pill Y 位置不变(关键 UX 需求)', Math.abs(rectInRead.y - yBefore) < 1);

  // reader 不应该覆盖 navbar 区域
  const navbar = doc.getElementById('navbar');
  const reader = doc.getElementById('reader');
  check('reader 元素存在', !!reader);
  if (reader && navbar) {
    const rs = dom.window.getComputedStyle(reader);
    check('reader top 用了 var(--navbar-h) 变量(关键)', /var\(--navbar-h/.test(rs.top));
    check('reader top 不是 inset: 0(否则会盖住 navbar)', rs.top !== '0px');
    const navH = dom.window.getComputedStyle(doc.documentElement).getPropertyValue('--navbar-h');
    check('--navbar-h CSS 变量被设置', navH && /px$/.test(navH.trim()));
  }

  console.log('\n--- 阅读模式下点击编辑按钮切回编辑 ---');
  editBtn.click();
  await new Promise(r => setTimeout(r, 500));
  check('Reader 浮层消失(等 500ms)', !doc.getElementById('reader'));
  check('navbar data-mode=edit', doc.getElementById('navbar').getAttribute('data-mode') === 'edit');
  check('编辑按钮重新 active', editBtn.classList.contains('active'));
  check('阅读按钮取消 active', !readBtn.classList.contains('active'));

  // 关键断言:再次确认切回后位置还是不变
  const rectAfter = toggle.getBoundingClientRect();
  check('pill X 位置始终不变(二次确认)', Math.abs(rectAfter.x - xBefore) < 1);
  check('pill Y 位置始终不变(二次确认)', Math.abs(rectAfter.y - yBefore) < 1);

  console.log('\n--- 阅读模式下 outline / drawer / docs 不能被 reader 盖住 ---');
  // 关键:这些侧栏的 z-index 必须大于 #reader (1500)
  if (readBtn) readBtn.click();   // 再次进入 reader
  await new Promise(r => setTimeout(r, 200));

  // 打开 outline(动态注入样式,需要先 open 一次才会注入到 <head>)
  dom.window.eval('Outline.open()');
  await new Promise(r => setTimeout(r, 200));
  const outlineEl = doc.querySelector('.outline-panel');
  if (outlineEl) {
    const op = dom.window.getComputedStyle(outlineEl).zIndex;
    const rp = dom.window.getComputedStyle(doc.getElementById('reader')).zIndex;
    check('outline-panel z-index 大于 reader', parseInt(op, 10) > parseInt(rp, 10));
  } else {
    check('outline-panel 创建成功', false);
  }
  // 关闭 outline
  dom.window.eval('Outline.close()');
  await new Promise(r => setTimeout(r, 100));

  // 检查 drawer
  const drawerEl = doc.getElementById('drawer');
  if (drawerEl) {
    const dz = parseInt(dom.window.getComputedStyle(drawerEl).zIndex, 10);
    const rz = parseInt(dom.window.getComputedStyle(doc.getElementById('reader')).zIndex, 10);
    check('drawer z-index 大于 reader', dz > rz);
  }

  // 检查 docs-panel
  const docsEl = doc.getElementById('docs-panel');
  if (docsEl) {
    const dpz = parseInt(dom.window.getComputedStyle(docsEl).zIndex, 10);
    const rz = parseInt(dom.window.getComputedStyle(doc.getElementById('reader')).zIndex, 10);
    check('docs-panel z-index 大于 reader', dpz > rz);
  }

  console.log('\n--- 大纲和更多菜单互斥(同时只能开一个) ---');
  // 先关 reader
  editBtn.click();
  await new Promise(r => setTimeout(r, 500));

  // 开 outline
  dom.window.eval('Outline.open()');
  await new Promise(r => setTimeout(r, 200));
  const outlineEl2 = doc.querySelector('.outline-panel');
  const drawerEl2 = doc.getElementById('drawer');
  check('outline 打开后 outline-panel 有 show 类', outlineEl2 && outlineEl2.classList.contains('show'));
  check('outline 打开后 drawer 无 show 类', drawerEl2 && !drawerEl2.classList.contains('show'));

  // 模拟点 more-btn(打开 drawer,大纲应自动关)
  doc.getElementById('more-btn').click();
  await new Promise(r => setTimeout(r, 200));
  const outlineEl3 = doc.querySelector('.outline-panel');
  const drawerEl3 = doc.getElementById('drawer');
  check('打开 drawer 后 drawer 有 show 类', drawerEl3 && drawerEl3.classList.contains('show'));
  check('打开 drawer 后 outline 自动关闭(无 show 类)', outlineEl3 && !outlineEl3.classList.contains('show'));

  // 模拟关 drawer
  doc.getElementById('drawer-mask').click();
  await new Promise(r => setTimeout(r, 200));
  // 再开 outline
  dom.window.eval('Outline.open()');
  await new Promise(r => setTimeout(r, 200));
  const drawerEl4 = doc.getElementById('drawer');
  check('再次开 outline 后 drawer 仍无 show 类', drawerEl4 && !drawerEl4.classList.contains('show'));
  // 收尾:关 outline
  dom.window.eval('Outline.close()');
  await new Promise(r => setTimeout(r, 100));

  console.log('\n--- data-tip 工具提示 z-index 高于所有浮层 ---');
  // 关键:.nav-btn:active 有 transform,会创建独立 stacking context
  //       把 tooltip ::after 困在 button 内,无法浮出 reader(1500) 等浮层
  // 修复:[data-tip]:active 给 button 自身 z-index: 3000,把整个 stacking context 抬到顶
  const themeBtn2 = doc.getElementById('theme-toggle');
  if (themeBtn2 && themeBtn2.hasAttribute('data-tip')) {
    check('theme-toggle 按钮带 data-tip', true);
    const sheets = doc.querySelectorAll('style');
    let cssText = '';
    sheets.forEach(s => cssText += s.textContent + '\n');
    // 关键断言:[data-tip]:active 的 z-index 必须足够高
    const activeMatch = cssText.match(/\[data-tip\]:active\s*\{[^}]*z-index:\s*(\d+)/);
    if (activeMatch) {
      const z = parseInt(activeMatch[1], 10);
      check('[data-tip]:active z-index 至少 3000(覆盖 reader/drawer/find 等)', z >= 3000);
    } else {
      check('[data-tip]:active 规则包含 z-index', false);
    }
    // ::after 自身在 button stacking context 内,z-index >= 1 即可(已自动浮到顶)
    const afterMatch = cssText.match(/\[data-tip\]:active::after\s*\{[^}]*z-index:\s*(\d+)/);
    if (afterMatch) {
      const z2 = parseInt(afterMatch[1], 10);
      check('[data-tip]:active::after z-index >= 1(button stacking context 内部正向叠放)', z2 >= 1);
    }
  } else {
    check('theme-toggle 按钮带 data-tip', false);
  }

  console.log('\n--- 抽屉仍正常(左滑) ---');
  const drawer = doc.getElementById('drawer');
  if (drawer) {
    const ds = dom.window.getComputedStyle(drawer);
    check('drawer 仍为 left: 0', ds.left === '0px');
    check('drawer 默认 translateX -100%', ds.transform.includes('-1'));
  }

  console.log('\n--- 错误检查 ---');
  // 过滤 jsdom 已知的环境噪音(vendor 脚本本地无文件 + CSS 选择器警告)
  const realErrors = errors.filter(e =>
    !e.includes('Could not load script') &&
    !e.includes('Could not load link') &&
    !e.includes('Could not parse CSS') &&
    !e.includes('Not implemented:'));
  check('无严重错误 (剩 ' + realErrors.length + ' 条噪音)', realErrors.length === 0);
  if (realErrors.length) realErrors.slice(0, 5).forEach(e => console.log('    ' + e));

  console.log('\n=== ' + pass + ' pass, ' + fail + ' fail ===');
  process.exit(fail > 0 ? 1 : 0);
})();
