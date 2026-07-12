// 验证:Reader theme 默认跟随 app 整体主题
//   - 首次进 reader(lcoalStorage 无 markdoc.reader.v1)→ 用 app 主题决定
//     * app light → reader paper
//     * app dark  → reader dark
//   - 用户在 reader 控件里显式选过 → 锁定,不再跟随
//   - ThemeManager.set() 在 userExplicitTheme=false 时会同步更新 reader.settings.theme
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const fs = require('fs');

const errors = [];
const vc = new VirtualConsole();
vc.on('error', e => errors.push('[ERR] ' + (e.detail?.message || e.message || e)));
vc.on('jsdomError', e => errors.push('[JSDOM] ' + (e.detail?.message || e.message || e)));

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');

// 用 JSDOM 加载并跑脚本(以获取 Reader / ThemeManager 全局对象)
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

  const R = dom.window.Reader;
  const T = dom.window.ThemeManager;

  check('Reader 全局对象存在', !!R);
  check('ThemeManager 全局对象存在', !!T);
  check('Reader.defaults.userExplicitTheme 默认 false',
        R && R.defaults && R.defaults.userExplicitTheme === false);
  check('Reader.defaults.theme 仍是 paper(默认值,真正逻辑在 init/open)',
        R && R.defaults && R.defaults.theme === 'paper');

  console.log('\n--- 场景 1:app = light,首次进 reader → reader 用 paper ---');
  // 清掉 localStorage
  dom.window.localStorage.removeItem('markdoc.reader.v1');
  // 重置 reader settings
  R.settings = null;
  // 模拟 app 切到 light
  doc.documentElement.setAttribute('data-theme', 'light');
  T.set('light', false);
  // 现在模拟 reader init
  R.init();
  check('app=light,init 后 reader.theme = paper', R.settings.theme === 'paper');
  check('init 后 userExplicitTheme 仍是 false', R.settings.userExplicitTheme === false);

  console.log('\n--- 场景 2:app = dark,首次进 reader → reader 用 dark ---');
  dom.window.localStorage.removeItem('markdoc.reader.v1');
  R.settings = null;
  doc.documentElement.setAttribute('data-theme', 'dark');
  T.set('dark', false);
  R.init();
  check('app=dark,init 后 reader.theme = dark', R.settings.theme === 'dark');
  check('app=dark,userExplicitTheme 仍是 false(没显式选过)', R.settings.userExplicitTheme === false);

  console.log('\n--- 场景 3:app = auto → 跟随系统,系统亮就 light ---');
  dom.window.localStorage.removeItem('markdoc.reader.v1');
  R.settings = null;
  // 模拟 prefers-color-scheme: light(默认)
  doc.documentElement.setAttribute('data-theme', 'light');
  T.set('auto', false);
  R.init();
  check('app=auto(系统亮),reader.theme = paper', R.settings.theme === 'paper');

  console.log('\n--- 场景 4:用户显式选过 reader 主题,锁定不跟随 ---');
  // 模拟:Reader 已有 settings,userExplicitTheme=true
  dom.window.localStorage.setItem('markdoc.reader.v1', JSON.stringify({
    theme: 'sepia',
    font: 'serif',
    size: 'large',
    lineHeight: 'relaxed',
    userExplicitTheme: true,
  }));
  R.settings = JSON.parse(dom.window.localStorage.getItem('markdoc.reader.v1'));

  // app 从 light 切到 dark
  doc.documentElement.setAttribute('data-theme', 'light');
  T.set('light', false);
  check('切到 light 后,reader.theme 仍是 sepia(用户锁定)', R.settings.theme === 'sepia');

  T.set('dark', false);
  check('再切到 dark 后,reader.theme 还是 sepia(用户锁定)', R.settings.theme === 'sepia');

  console.log('\n--- 场景 5:ThemeManager.syncReaderTheme 在 userExplicitTheme=false 时同步 ---');
  dom.window.localStorage.removeItem('markdoc.reader.v1');
  R.settings = { ...R.defaults, theme: 'paper', userExplicitTheme: false };
  // app 切到 dark
  T.set('dark', false);
  check('ThemeManager.set(dark) → reader.settings.theme 跟随变为 dark', R.settings.theme === 'dark');
  // app 切回 light
  T.set('light', false);
  check('ThemeManager.set(light) → reader.settings.theme 跟随变为 paper', R.settings.theme === 'paper');

  console.log('\n--- 场景 6:显式选主题的按钮会设 userExplicitTheme=true ---');
  // 模拟用户点 sepia 按钮
  R.setSetting('theme', 'sepia');
  check('setSetting(theme, sepia) 后 userExplicitTheme = true', R.settings.userExplicitTheme === true);
  check('setSetting(theme, sepia) 后 theme = sepia', R.settings.theme === 'sepia');
  // 之后 app 切主题不会影响 reader
  T.set('dark', false);
  check('app 切 dark 后 reader.theme 仍是 sepia(锁定)', R.settings.theme === 'sepia');

  console.log('\n--- 场景 7:setSetting 其他字段不改变 userExplicitTheme ---');
  // 重置
  R.settings = { ...R.defaults, userExplicitTheme: false };
  R.setSetting('size', 'large');
  check('setSetting(size) 不改变 userExplicitTheme', R.settings.userExplicitTheme === false);
  R.setSetting('font', 'serif');
  check('setSetting(font) 不改变 userExplicitTheme', R.settings.userExplicitTheme === false);
  R.setSetting('lineHeight', 'compact');
  check('setSetting(lineHeight) 不改变 userExplicitTheme', R.settings.userExplicitTheme === false);

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
