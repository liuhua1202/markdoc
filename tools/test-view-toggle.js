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

  console.log('\n--- 编辑/阅读 toggle 按钮 ---');
  const toggle = doc.getElementById('view-toggle');
  check('view-toggle 容器存在', !!toggle);
  const editBtn = doc.getElementById('view-btn-edit');
  const readBtn = doc.getElementById('view-btn-read');
  check('view-btn-edit 存在', !!editBtn);
  check('view-btn-read 存在', !!readBtn);
  check('编辑按钮默认 active', editBtn && editBtn.classList.contains('active'));
  check('阅读按钮默认 not active', readBtn && !readBtn.classList.contains('active'));
  check('toggle 包含两个按钮', toggle && toggle.querySelectorAll('button').length === 2);

  console.log('\n--- 点击阅读按钮触发 ViewManager ---');
  if (readBtn) readBtn.click();
  await new Promise(r => setTimeout(r, 200));
  // 注: ViewManager 是 const 闭包内,无法从 dom.window 读;
  // 但通过 DOM 可观察 set() 是否生效:按钮高亮 + Reader 浮层
  check('点击阅读后 阅读按钮变 active', readBtn.classList.contains('active'));
  check('点击阅读后 编辑按钮取消 active', !editBtn.classList.contains('active'));
  check('点击阅读后 Reader 浮层出现', !!doc.getElementById('reader'));

  console.log('\n--- 点击编辑按钮回到 edit ---');
  if (editBtn) editBtn.click();
  await new Promise(r => setTimeout(r, 500));  // Reader.close 有 300ms 延迟移除 DOM
  check('点击编辑后 编辑按钮重新 active', editBtn.classList.contains('active'));
  check('点击编辑后 阅读按钮取消 active', !readBtn.classList.contains('active'));
  check('点击编辑后 Reader 浮层消失(等 500ms)', !doc.getElementById('reader'));

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
