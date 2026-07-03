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

  console.log('\n--- 单个图标切换按钮(图标随状态切换) ---');
  const toggleBtn = doc.getElementById('view-toggle-btn');
  const toggleIcon = doc.getElementById('view-toggle-icon');
  check('view-toggle-btn 存在', !!toggleBtn);
  check('view-toggle-icon 存在', !!toggleIcon);
  check('view-toggle-btn 是 nav-btn 样式', toggleBtn && toggleBtn.classList.contains('nav-btn'));
  check('默认 data-mode-target=reader(图标提示"切到阅读")', toggleBtn && toggleBtn.getAttribute('data-mode-target') === 'reader');
  check('默认图标含 "book" 路径(2 path)', toggleIcon && toggleIcon.querySelectorAll('path').length === 2);
  check('默认 aria-label 提示"切到阅读"', toggleBtn && /阅读/.test(toggleBtn.getAttribute('aria-label') || ''));
  check('默认按钮不 active(还在 edit)', toggleBtn && !toggleBtn.classList.contains('active'));

  // 记录点击前按钮位置(关键:切换时位置不能变)
  const rectBefore = toggleBtn.getBoundingClientRect();
  const xBefore = rectBefore.x;
  const yBefore = rectBefore.y;

  console.log('\n--- 点击切到阅读模式 ---');
  if (toggleBtn) toggleBtn.click();
  await new Promise(r => setTimeout(r, 200));
  check('Reader 浮层出现', !!doc.getElementById('reader'));
  check('navbar data-mode=reader', doc.getElementById('navbar').getAttribute('data-mode') === 'reader');
  check('图标变成铅笔(2 path,含外框 + 笔尖)', toggleIcon.querySelectorAll('path').length === 2);
  check('切到阅读后 SVG 内部 HTML 变化了', toggleIcon.innerHTML.length > 30);
  check('data-mode-target=edit(切回编辑)', toggleBtn.getAttribute('data-mode-target') === 'edit');
  check('按钮变 active 态(在阅读模式)', toggleBtn.classList.contains('active'));
  check('aria-label 变"切到编辑"', /编辑/.test(toggleBtn.getAttribute('aria-label') || ''));

  // 阅读模式下隐藏其他 nav 按钮(只留 brand 和 toggle)
  const nav = doc.getElementById('navbar');
  const docsBtn = doc.getElementById('docs-btn');
  const outlineBtn = doc.getElementById('outline-btn');
  const moreBtn = doc.getElementById('more-btn');
  const themeBtn = doc.getElementById('theme-toggle');
  check('阅读模式下 docs-btn 隐藏', docsBtn && dom.window.getComputedStyle(docsBtn).display === 'none');
  check('阅读模式下 outline-btn 隐藏', outlineBtn && dom.window.getComputedStyle(outlineBtn).display === 'none');
  check('阅读模式下 more-btn 隐藏', moreBtn && dom.window.getComputedStyle(moreBtn).display === 'none');
  check('阅读模式下 theme-toggle 隐藏', themeBtn && dom.window.getComputedStyle(themeBtn).display === 'none');
  check('阅读模式下 view-toggle-btn 仍然可见', dom.window.getComputedStyle(toggleBtn).display !== 'none');

  // 关键断言:按钮位置在切换前后保持不变
  const rectInRead = toggleBtn.getBoundingClientRect();
  check('按钮 X 位置不变(关键 UX 需求)', Math.abs(rectInRead.x - xBefore) < 1);
  check('按钮 Y 位置不变(关键 UX 需求)', Math.abs(rectInRead.y - yBefore) < 1);

  // reader 不应该覆盖 navbar 区域
  const navbar = doc.getElementById('navbar');
  const reader = doc.getElementById('reader');
  check('reader 元素存在', !!reader);
  if (reader && navbar) {
    // jsdom 不解析 CSS 变量 — rs.top 会是原始的 "var(--navbar-h, 56px)" 字符串
    // 真正的浏览器里这个值会被解析成 ~56px,把 reader 推到 navbar 下方
    const rs = dom.window.getComputedStyle(reader);
    check('reader top 用了 var(--navbar-h) 变量(关键)', /var\(--navbar-h/.test(rs.top));
    check('reader top 不是 inset: 0(否则会盖住 navbar)', rs.top !== '0px');
    // 也检查 --navbar-h 变量被设置过
    const navH = dom.window.getComputedStyle(doc.documentElement).getPropertyValue('--navbar-h');
    check('--navbar-h CSS 变量被设置', navH && /px$/.test(navH.trim()));
  }

  console.log('\n--- 阅读模式下点击同一按钮切回编辑 ---');
  toggleBtn.click();
  await new Promise(r => setTimeout(r, 500));
  check('Reader 浮层消失(等 500ms)', !doc.getElementById('reader'));
  check('navbar data-mode=edit', doc.getElementById('navbar').getAttribute('data-mode') === 'edit');
  check('图标恢复 book(2 path)', toggleIcon.querySelectorAll('path').length === 2);
  check('data-mode-target=reader', toggleBtn.getAttribute('data-mode-target') === 'reader');
  check('按钮 active 取消', !toggleBtn.classList.contains('active'));

  // 关键断言:再次确认切回后位置还是不变
  const rectAfter = toggleBtn.getBoundingClientRect();
  check('按钮 X 位置始终不变(二次确认)', Math.abs(rectAfter.x - xBefore) < 1);
  check('按钮 Y 位置始终不变(二次确认)', Math.abs(rectAfter.y - yBefore) < 1);

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
