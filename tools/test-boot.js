// 简化版测试：通过 HTTP 加载
const { JSDOM, VirtualConsole } = require('jsdom');

const errors = [];
const warnings = [];
const logs = [];

const vc = new VirtualConsole();
vc.on('error', e => errors.push('[ERR] ' + e));
vc.on('warn', e => warnings.push('[WARN] ' + e));
vc.on('log', (...args) => logs.push(args.join(' ')));
vc.on('info', (...args) => logs.push('[INFO] ' + args.join(' ')));
vc.on('jsdomError', e => errors.push('[JSDOM] ' + (e.detail?.message || e.message)));

(async () => {
  console.log('Loading from HTTP server...');
  let dom;
  try {
    dom = await JSDOM.fromURL('http://localhost:8765/index.html', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole: vc,
    });
  } catch (e) {
    console.error('Failed to load:', e.message);
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 4000));

  console.log('\n=== Boot 结果 ===\n');
  const splash = dom.window.document.getElementById('splash');
  console.log('splash 元素:', splash ? '✓ 存在' : '✗ 缺失');
  if (splash) {
    console.log('  hidden class:', splash.classList.contains('hidden'));
  }

  const editor = dom.window.document.getElementById('editor');
  console.log('editor.value 长度:', editor ? editor.value.length : 0);
  console.log('editor 前 50 字符:', editor ? JSON.stringify(editor.value.substring(0, 50)) : '(no editor)');

  const preview = dom.window.document.getElementById('preview-content');
  console.log('preview innerHTML 长度:', preview ? preview.innerHTML.length : 0);

  console.log('\n=== 全局模块 ===');
  for (const c of ['marked', 'hljs', 'ContentManager', 'DocManager', 'DocsUI', 'Divider', 'Drawer', 'SyncManager', 'AIAssistant', 'DragDrop', 'Outline', 'ViewManager', 'ThemeManager', 'renderMathInElement']) {
    const v = dom.window[c];
    const status = v === undefined ? '✗ undefined' : '✓ ' + typeof v;
    console.log(`  ${c.padEnd(20)}: ${status}`);
  }

  console.log('\n=== 日志 (' + logs.length + ') ===');
  logs.slice(0, 20).forEach(l => console.log('  ', l));

  console.log('\n=== 错误 (' + errors.length + ') ===');
  errors.slice(0, 20).forEach(e => console.log('  ', e));

  console.log('\n=== 警告 (' + warnings.length + ') ===');
  warnings.slice(0, 10).forEach(w => console.log('  ', w));

  process.exit(0);
})();