// 深度测试 - 看 boot 期间的具体状态
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const INDEX_HTML = path.resolve(__dirname, '..', 'android-app', 'app', 'src', 'main', 'assets', 'index.html');

const savedViewMode = process.argv[2] || null;
console.log('═══════════════════════════════════════════');
console.log(`  savedViewMode=${savedViewMode || '(null)'}`);
console.log('═══════════════════════════════════════════');

const html = fs.readFileSync(INDEX_HTML, 'utf8');
const vc = new VirtualConsole();
const errors = [];
const allLogs = [];
vc.on('error', e => errors.push('[ERR] ' + (e.message || String(e))));
vc.on('log', (...args) => allLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a).slice(0,200) : String(a)).join(' ')));
vc.on('info', (...args) => allLogs.push('[INFO] ' + args.join(' ')));
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
    // 注入探针
    if (savedViewMode) {
      const origGetItem = window.localStorage.getItem.bind(window.localStorage);
      window.localStorage.getItem = function(key) {
        if (key === 'markdoc.viewMode.v1') return savedViewMode;
        return origGetItem(key);
      };
    }
  }
});

(async () => {
  await new Promise(r => setTimeout(r, 4500));
  const doc = dom.window.document;

  // 通过 DOM 间接检测 Reader 状态
  const reader = doc.getElementById('reader');
  const readerBtn = doc.getElementById('view-reader');
  const navbar = doc.querySelector('.navbar');

  console.log('\n[启动后状态]');
  console.log('  reader DOM:', reader);
  console.log('  readerBtn.active:', readerBtn?.classList.contains('active'));
  console.log('  navbar opacity:', navbar?.style.opacity);

  // 第一次点 reader
  console.log('\n[点 reader]');
  readerBtn.click();
  await new Promise(r => setTimeout(r, 100));
  const reader2 = doc.getElementById('reader');
  console.log('  同步 reader:', reader2);
  console.log('  reader.show:', reader2?.classList.contains('show'));
  console.log('  readerBtn.active:', readerBtn.classList.contains('active'));
  console.log('  navbar opacity:', navbar.style.opacity);
  await new Promise(r => setTimeout(r, 300));
  const reader3 = doc.getElementById('reader');
  console.log('  异步后 reader:', reader3);
  console.log('  reader3.show:', reader3?.classList.contains('show'));

  // 点 split
  console.log('\n[点 split]');
  doc.getElementById('view-split').click();
  await new Promise(r => setTimeout(r, 500));

  // 再点 reader
  console.log('\n[再点 reader]');
  doc.getElementById('view-reader').click();
  await new Promise(r => setTimeout(r, 300));
  const reader4 = doc.getElementById('reader');
  console.log('  reader DOM:', reader4);
  console.log('  reader.show:', reader4?.classList.contains('show'));
  console.log('  readerBtn.active:', readerBtn.classList.contains('active'));

  console.log('\n=== Boot 日志 ===');
  allLogs.filter(l => l.includes('[Boot]') || l.includes('视图') || l.includes('内容') || l.includes('阅读') || l.includes('Reader')).forEach(l => console.log(' ', l));
  console.log('\n=== 错误 ===');
  errors.slice(0, 10).forEach(e => console.log(' ', e));

  process.exit(0);
})();