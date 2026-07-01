const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const zipPath = 'tools/ci-log.zip';
const outDir = 'tools/ci-logs';

if (!fs.existsSync(zipPath)) {
  console.log('No zip file:', zipPath);
  process.exit(1);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

try {
  execSync(`Expand-Archive -Path "${zipPath}" -DestinationPath "${outDir}" -Force`, { shell: 'powershell.exe', stdio: 'inherit' });
} catch (e) {
  console.log('Expand-Archive failed:', e.message);
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(outDir).filter(f => f.endsWith('.txt'));
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  console.log('=== ' + path.relative(outDir, f) + ' ===');
  // 显示失败相关部分
  const lines = content.split('\n');
  const failureIdx = lines.findIndex(l => /error|Error|FAIL|✗|失败|exception/i.test(l));
  if (failureIdx >= 0) {
    console.log('--- Failure context (50 lines around first error) ---');
    const start = Math.max(0, failureIdx - 30);
    const end = Math.min(lines.length, failureIdx + 30);
    console.log(lines.slice(start, end).join('\n'));
  } else {
    console.log('--- Last 80 lines ---');
    console.log(lines.slice(-80).join('\n'));
  }
  console.log();
}