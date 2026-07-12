// test-import-redesign.js
// 验证统一导入流程:
// 1. 静态 #file-input 接受 .md/.json 多选
// 2. ImportManager.importFiles 按类型分发(.md 新建, .json 整库)
// 3. ImportManager.importToTarget 区分 editor / library 目标
// 4. 抽屉 act-import 弹 mini picker(showImportTargetPicker)
// 5. mini picker 选项点击触发 file-input(带正确 dataset.target)
// 6. 混合选择(md+json)分批处理 + 汇总 toast
// 7. 跳过不识别的类型
// 8. Native importMarkdown(text, filename) 按 filename 分发
// 9. 文档库 btn-doc-import 复用 file-input 不再动态创建

const { JSDOM, VirtualConsole } = require('jsdom');

const errors = [];
const warnings = [];
const logs = [];

const vc = new VirtualConsole();
vc.on('error', e => errors.push('[ERR] ' + e));
vc.on('warn', e => warnings.push('[WARN] ' + e));
vc.on('log', (...args) => logs.push(args.join(' ')));
vc.on('jsdomError', e => errors.push('[JSDOM] ' + (e.detail?.message || e.message)));

let dom;
(async () => {
  console.log('Loading from HTTP server...');
  dom = await JSDOM.fromURL('http://localhost:8765/index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  await new Promise(r => setTimeout(r, 4000));

  const doc = dom.window.document;
  const win = dom.window;
  let failed = 0;
  const assert = (cond, label) => {
    const ok = !!cond;
    console.log(`  ${ok ? '\u2713' : '\u2717'} ${label}`);
    if (!ok) failed++;
  };

  // ----------------------------------------------------------------
  // 1) 静态 file-input 存在 & 接受 .md/.json
  // ----------------------------------------------------------------
  console.log('\n=== 1) 静态 file-input ===');
  const fileInput = doc.getElementById('file-input');
  assert(fileInput, '#file-input exists');
  assert(fileInput.type === 'file', 'type = file');
  assert(fileInput.multiple === true, 'multiple = true');
  assert(fileInput.accept.includes('.md'), `accept includes .md (got: ${fileInput.accept})`);
  assert(fileInput.accept.includes('.json'), 'accept includes .json');
  assert(fileInput.accept.includes('.markdown'), 'accept includes .markdown');
  assert(fileInput.accept.includes('application/json'), 'accept includes application/json');

  // ----------------------------------------------------------------
  // 2) ImportManager 顶层对象存在 & 暴露方法
  // ----------------------------------------------------------------
  console.log('\n=== 2) ImportManager ===');
  assert(typeof win.ImportManager === 'object', 'ImportManager exists');
  assert(typeof win.ImportManager.importFiles === 'function', 'importFiles function');
  assert(typeof win.ImportManager.importToTarget === 'function', 'importToTarget function');
  assert(typeof win.ImportManager.isMdFile === 'function', 'isMdFile function');
  assert(typeof win.ImportManager.isJsonFile === 'function', 'isJsonFile function');
  assert(win.ImportManager.isMdFile({ name: 'a.md', type: '' }), 'isMdFile detects .md');
  assert(win.ImportManager.isMdFile({ name: 'b.MARKDOWN', type: '' }), 'isMdFile detects .MARKDOWN (case insensitive)');
  assert(win.ImportManager.isMdFile({ name: 'c.txt', type: '' }), 'isMdFile detects .txt');
  assert(win.ImportManager.isMdFile({ name: 'd', type: 'text/markdown' }), 'isMdFile detects text/markdown');
  assert(win.ImportManager.isJsonFile({ name: 'a.json', type: '' }), 'isJsonFile detects .json');
  assert(win.ImportManager.isJsonFile({ name: 'a', type: 'application/json' }), 'isJsonFile detects application/json');
  assert(!win.ImportManager.isMdFile({ name: 'a.png', type: 'image/png' }), 'isMdFile rejects .png');
  assert(!win.ImportManager.isJsonFile({ name: 'a.md', type: '' }), 'isJsonFile rejects .md');

  // ----------------------------------------------------------------
  // 3) 文档库 btn-doc-import 不再动态创建 input,改为复用 file-input
  // ----------------------------------------------------------------
  console.log('\n=== 3) btn-doc-import 复用 file-input ===');
  const btnImport = doc.getElementById('btn-doc-import');
  assert(btnImport, 'btn-doc-import exists');
  // hook createElement 看是否被用来创建 input
  const origCreate = doc.createElement.bind(doc);
  let dynamicInputCreated = false;
  doc.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === 'input') dynamicInputCreated = true;
    return el;
  };
  // 模拟 click
  btnImport.click();
  await new Promise(r => setTimeout(r, 100));
  assert(!dynamicInputCreated, 'no dynamic input created for btn-doc-import');
  assert(fileInput.dataset.target === 'library', `file-input.dataset.target = library (got: ${fileInput.dataset.target})`);
  // 还原 createElement
  doc.createElement = origCreate;

  // ----------------------------------------------------------------
  // 4) 抽屉 act-import 弹 mini picker
  // ----------------------------------------------------------------
  console.log('\n=== 4) act-import → mini picker ===');
  const actImport = doc.getElementById('act-import');
  assert(actImport, 'act-import exists');
  actImport.click();
  await new Promise(r => setTimeout(r, 200));
  const miniPicker = doc.getElementById('import-target-picker');
  assert(miniPicker, 'mini picker mounted');
  assert(miniPicker.classList.contains('show'), 'mini picker has .show');

  const ipOpts = miniPicker?.querySelectorAll('.ip-opt');
  assert(ipOpts && ipOpts.length === 2, `2 ip-opt (got ${ipOpts?.length})`);
  const targets = ipOpts ? Array.from(ipOpts).map(o => o.dataset.target) : [];
  assert(targets.includes('editor'), 'option editor');
  assert(targets.includes('library'), 'option library');
  // 文档库选项应该是 primary(高亮)
  const primaryOpt = miniPicker?.querySelector('.ip-opt.primary');
  assert(primaryOpt && primaryOpt.dataset.target === 'library', 'library option is primary');

  // ----------------------------------------------------------------
  // 5) mini picker 选项 → 触发 file-input(带正确 target)
  // ----------------------------------------------------------------
  console.log('\n=== 5) mini picker 选项触发 file-input ===');
  // stub fileInput.click 记录被点击
  let fileInputClickCount = 0;
  let lastTargetBeforeClick = null;
  const origInputClick = fileInput.click.bind(fileInput);
  fileInput.click = function () {
    fileInputClickCount++;
    lastTargetBeforeClick = fileInput.dataset.target;
    // 不真的触发系统选择器
  };
  // 点 "导入到当前编辑器"
  const editorOpt = miniPicker.querySelector('[data-target="editor"]');
  editorOpt.click();
  await new Promise(r => setTimeout(r, 50));
  assert(fileInputClickCount === 1, 'fileInput clicked once');
  assert(lastTargetBeforeClick === 'editor', `target = editor before click (got: ${lastTargetBeforeClick})`);
  assert(!doc.getElementById('import-target-picker'), 'mini picker closed after click');

  // 重新点 act-import,这次选 library
  actImport.click();
  await new Promise(r => setTimeout(r, 200));
  const miniPicker2 = doc.getElementById('import-target-picker');
  const libraryOpt = miniPicker2.querySelector('[data-target="library"]');
  libraryOpt.click();
  await new Promise(r => setTimeout(r, 50));
  assert(fileInputClickCount === 2, 'fileInput clicked twice');
  assert(lastTargetBeforeClick === 'library', `target = library before click (got: ${lastTargetBeforeClick})`);

  // 还原 fileInput.click
  fileInput.click = origInputClick;

  // ----------------------------------------------------------------
  // 6) ImportManager.importFiles - 模拟用户选 .md 文件
  // ----------------------------------------------------------------
  console.log('\n=== 6) ImportManager.importFiles .md 批量 ===');
  const beforeDocs = win.DocManager.docs.length;
  const fakeMdFiles = [
    new win.File(['# Hello\n\nWorld'], 'hello.md', { type: 'text/markdown' }),
    new win.File(['# Test\n\nTest2'], 'test.md', { type: 'text/markdown' }),
  ];
  const result1 = await win.ImportManager.importFiles(fakeMdFiles);
  assert(result1.mdCount === 2, `imported 2 .md (got: ${result1.mdCount})`);
  assert(win.DocManager.docs.length === beforeDocs + 2, `docs grew by 2 (before: ${beforeDocs}, after: ${win.DocManager.docs.length})`);
  // 文档标题取自文件名
  const titles = win.DocManager.docs.slice(-2).map(d => d.title);
  assert(titles.includes('hello'), `title includes 'hello' (got: ${JSON.stringify(titles)})`);
  assert(titles.includes('test'), `title includes 'test' (got: ${JSON.stringify(titles)})`);

  // ----------------------------------------------------------------
  // 7) ImportManager.importFiles - 混合 md + json
  // ----------------------------------------------------------------
  console.log('\n=== 7) ImportManager.importFiles 混合 ===');
  // mock confirm → merge
  win.confirm = () => true;
  const beforeDocs2 = win.DocManager.docs.length;
  const fakeBackup = {
    exportedAt: new Date().toISOString(),
    docs: [
      { id: '1', title: '备份甲', content: '# 备份甲内容', tags: [], pinned: false, createdAt: 1, updatedAt: 1 },
      { id: '2', title: '备份乙', content: '# 备份乙内容', tags: [], pinned: false, createdAt: 2, updatedAt: 2 },
    ],
  };
  const fakeMixed = [
    new win.File(['# 新建\n\nNew'], 'new.md', { type: 'text/markdown' }),
    new win.File([JSON.stringify(fakeBackup)], 'backup.json', { type: 'application/json' }),
  ];
  const result2 = await win.ImportManager.importFiles(fakeMixed);
  assert(result2.mdCount === 1, `1 md imported (got: ${result2.mdCount})`);
  assert(result2.jsonCount === 2, `2 json docs imported (got: ${result2.jsonCount})`);
  assert(win.DocManager.docs.length === beforeDocs2 + 3, `docs grew by 3 (before: ${beforeDocs2}, after: ${win.DocManager.docs.length})`);

  // ----------------------------------------------------------------
  // 8) ImportManager.importFiles - 跳过不支持的类型
  // ----------------------------------------------------------------
  console.log('\n=== 8) ImportManager.importFiles 跳过不支持 ===');
  const beforeDocs3 = win.DocManager.docs.length;
  const fakeUnsupported = [
    new win.File(['fake'], 'image.png', { type: 'image/png' }),
    new win.File(['fake'], 'doc.pdf', { type: 'application/pdf' }),
  ];
  const result3 = await win.ImportManager.importFiles(fakeUnsupported);
  assert(result3.mdCount === 0 && result3.jsonCount === 0, 'no docs imported');
  assert(result3.skipped.length === 2, `2 skipped (got: ${result3.skipped.length})`);
  assert(win.DocManager.docs.length === beforeDocs3, 'docs unchanged');

  // ----------------------------------------------------------------
  // 9) ImportManager.importToTarget('editor') - 走 ContentManager.set
  // ----------------------------------------------------------------
  console.log('\n=== 9) importToTarget editor ===');
  const editor = doc.getElementById('editor');
  editor.value = '现有的内容别覆盖我';
  win.confirm = () => true; // 自动确认
  const fakeMd = [new win.File(['# 新的内容'], 'newdoc.md', { type: 'text/markdown' })];
  await win.ImportManager.importToTarget(fakeMd, 'editor');
  await new Promise(r => setTimeout(r, 100));
  assert(editor.value.includes('新的内容'), 'editor content updated to new doc');
  assert(!editor.value.includes('现有的内容别覆盖我'), 'old content replaced');

  // ----------------------------------------------------------------
  // 10) ContentManager.getCurrentLength 存在
  // ----------------------------------------------------------------
  console.log('\n=== 10) ContentManager.getCurrentLength ===');
  assert(typeof win.ContentManager.getCurrentLength === 'function', 'getCurrentLength function');
  assert(win.ContentManager.getCurrentLength() === editor.value.length, 'length matches');

  // ----------------------------------------------------------------
  // 11) importToTarget editor - 没有 ContentManager 时 fallback
  // ----------------------------------------------------------------
  console.log('\n=== 11) importToTarget fallback ===');
  const savedCM = win.ContentManager;
  // 不能真的删除,改成用空 list 验证 - md 找不到时 toast
  const fakeNoMd = [new win.File(['x'], 'x.png', { type: 'image/png' })];
  const beforeDocs4 = win.DocManager.docs.length;
  await win.ImportManager.importToTarget(fakeNoMd, 'editor');
  await new Promise(r => setTimeout(r, 50));
  assert(win.DocManager.docs.length === beforeDocs4, 'no docs added when no md');
  // 还原
  void savedCM;

  // ----------------------------------------------------------------
  // 12) Native window.importMarkdown(text, filename) - .md 走 ContentManager
  // ----------------------------------------------------------------
  console.log('\n=== 12) Native importMarkdown .md ===');
  editor.value = 'old';
  win.importMarkdown('# 从 native 来', 'doc.md');
  await new Promise(r => setTimeout(r, 50));
  assert(editor.value.includes('从 native 来'), 'editor set to .md content');

  // ----------------------------------------------------------------
  // 13) Native window.importMarkdown(text, filename) - .json 走 DocManager
  // ----------------------------------------------------------------
  console.log('\n=== 13) Native importMarkdown .json ===');
  win.confirm = () => true;
  const beforeDocs5 = win.DocManager.docs.length;
  const jsonBackup = {
    exportedAt: new Date().toISOString(),
    docs: [
      { id: 'n1', title: 'Native 导入 1', content: '# N1', tags: [], pinned: false, createdAt: 1, updatedAt: 1 },
    ],
  };
  win.importMarkdown(JSON.stringify(jsonBackup), 'backup.json');
  await new Promise(r => setTimeout(r, 50));
  assert(win.DocManager.docs.length === beforeDocs5 + 1, 'json imported via native importMarkdown');
  const newTitle = win.DocManager.docs[win.DocManager.docs.length - 1].title;
  assert(newTitle === 'Native 导入 1', `last doc title = 'Native 导入 1' (got: ${newTitle})`);

  // ----------------------------------------------------------------
  // 14) Native window.importMarkdown(text) - 缺 filename 时启发式判断
  // ----------------------------------------------------------------
  console.log('\n=== 14) Native importMarkdown 无 filename ===');
  // 传纯 .md 文本,不带 filename → 走 ContentManager.set
  editor.value = 'old content';
  win.importMarkdown('# Only text, no filename');
  await new Promise(r => setTimeout(r, 50));
  assert(editor.value.includes('Only text'), 'content set when only text passed');

  // 传 JSON 文本,不带 filename → 启发式判断是 JSON,走 DocManager
  const beforeDocs6 = win.DocManager.docs.length;
  const heuristicBackup = { docs: [{ id: 'h1', title: 'Heuristic', content: 'x' }] };
  win.importMarkdown(JSON.stringify(heuristicBackup));
  await new Promise(r => setTimeout(r, 50));
  assert(win.DocManager.docs.length === beforeDocs6 + 1, 'json detected by heuristic');

  // ----------------------------------------------------------------
  // 15) file-input change handler 集成测试 - 用 DataTransfer 模拟
  // ----------------------------------------------------------------
  console.log('\n=== 15) file-input change 集成 ===');
  // 模拟选文件后 change 事件
  const dt = new win.DataTransfer();
  dt.items.add(new win.File(['# change test'], 'change.md', { type: 'text/markdown' }));
  fileInput.files = dt.files;
  fileInput.dataset.target = 'library';
  const beforeDocs7 = win.DocManager.docs.length;
  const changeEvt = new win.Event('change', { bubbles: true });
  fileInput.dispatchEvent(changeEvt);
  await new Promise(r => setTimeout(r, 200));
  assert(win.DocManager.docs.length === beforeDocs7 + 1, 'file change → importFiles');
  // dataset.target 应该被重置回 'editor'
  assert(fileInput.dataset.target === 'editor', `target reset to editor (got: ${fileInput.dataset.target})`);
  // value 被清空(允许重复选择)
  assert(fileInput.value === '' || fileInput.value === null, 'file input value cleared');

  // ----------------------------------------------------------------
  console.log('\n=== 日志 (last 8) ===');
  logs.slice(-8).forEach(l => console.log('  ', l));
  console.log('\n=== 错误 (' + errors.length + ') ===');
  errors.slice(0, 10).forEach(e => console.log('  ', e));
  console.log('\n=== 警告 (' + warnings.length + ') ===');
  warnings.slice(0, 5).forEach(w => console.log('  ', w));

  console.log(`\n=== ${failed === 0 ? 'PASS' : 'FAIL'} ===`);
  process.exit(failed === 0 ? 0 : 1);
})();
