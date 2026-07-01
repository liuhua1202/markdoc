// 批量替换剩余的 makemdown 引用为 markdoc
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const REPLACEMENTS = [
  // localStorage keys
  ['markdoc.content.v1', 'markdoc.content.v1'],
  ['markdoc.docs.v1', 'markdoc.docs.v1'],
  ['markdoc.activeDocId.v1', 'markdoc.activeDocId.v1'],
  ['markdoc.theme.v1', 'markdoc.theme.v1'],
  ['markdoc.viewMode.v1', 'markdoc.viewMode.v1'],
  ['markdoc.splitRatio.v1', 'markdoc.splitRatio.v1'],
  ['markdoc.syncConfig.v1', 'markdoc.syncConfig.v1'],
  ['markdoc.lastSync.v1', 'markdoc.lastSync.v1'],
  ['markdoc.reader.v1', 'markdoc.reader.v1'],
  ['markdoc.aiConfig.v1', 'markdoc.aiConfig.v1'],
  // BroadcastChannel
  ['markdoc-sync', 'markdoc-sync'],
  // 下载文件名
  ['markdoc-backup-', 'markdoc-backup-'],
  // Android package
  ['com.markdoc.app', 'com.markdoc.app'],
  // .gitignore artifact patterns
  ['markdoc-*.zip', 'markdoc-*.zip'],
  ['markdoc-*.apk', 'markdoc-*.apk'],
  ['markdoc-*.dmg', 'markdoc-*.dmg'],
  ['markdoc-*.exe', 'markdoc-*.exe'],
  ['markdoc-*.AppImage', 'markdoc-*.AppImage'],
  ['markdoc-pwa/', 'markdoc-pwa/'],
  // PWA zip
  ['markdoc-pwa.zip', 'markdoc-pwa.zip'],
  // Service worker cache names
  ['markdoc-static-', 'markdoc-static-'],
  ['markdoc-runtime-', 'markdoc-runtime-'],
  // Server example
  ['markdoc.example.com', 'markdoc.example.com'],
  // Desktop Electron appId
  // (handled by com.markdoc.app)
  // iOS capacitor appId
  // (handled by com.markdoc.app)
  // iOS package.json name
  // (handled below — careful, package.json has "name": "makemdown" not in path)
];

// 单独处理 package.json 的 name 字段
const PKG_NAME_FIELDS = [
  'desktop-app/package.json',
  'desktop-app/package-lock.json',
];

const SKIP_DIRS = new Set(['.git', 'node_modules', '.gradle', 'build', 'dist', 'vendor']);
const TEXT_EXT = new Set(['.html', '.js', '.json', '.md', '.kts', '.kt', '.xml', '.pro', '.yml', '.yaml', '.ps1', '.py', '.gradle']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const all = walk(ROOT);
let changedFiles = 0;
let totalReplacements = 0;

for (const file of all) {
  const ext = path.extname(file);
  if (!TEXT_EXT.has(ext)) continue;
  // 跳过二进制/无关
  if (file.includes('logo.ico') || file.includes('.gradle/') || file.includes('icons/')) continue;

  let original = fs.readFileSync(file, 'utf8');
  let content = original;

  for (const [old, neu] of REPLACEMENTS) {
    if (content.includes(old)) {
      const before = content;
      content = content.split(old).join(neu);
      const count = before.length - content.length;
      // 简单的计数(按字符串出现次数差值,不准但够用)
      totalReplacements += (before.match(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log(`  ✓ ${path.relative(ROOT, file)}`);
  }
}

// 单独处理 package.json 的 name 字段
for (const rel of PKG_NAME_FIELDS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (pkg.name === 'makemdown') {
    pkg.name = 'markdoc';
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    changedFiles++;
    console.log(`  ✓ ${rel} (name field)`);
  }
}

console.log(`\n总结: ${changedFiles} 个文件被修改`);