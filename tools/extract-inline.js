// 提取 index.html 中确切的 inline <script> 块，剥掉外层标签
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const lines = html.split('\n');

const ranges = [
  [2190, 2230],
  [2515, 7011],
  [7021, 7287],
];

for (const [s, e] of ranges) {
  const head = lines[s - 1].trim();
  const tail = lines[e - 1].trim();
  if (!head.startsWith('<script')) throw new Error(`Line ${s} is not <script>: ${head}`);
  if (tail !== '</script>') throw new Error(`Line ${e} is not </script>: ${tail}`);
}

const combined = ranges.map(([s, e], i) => {
  // 包含开头的 <script>... 与结束的 </script> 行之间的纯 JS 源码
  const body = lines.slice(s, e - 1).join('\n');
  return `\n/* === script #${i} (lines ${s+1}-${e-1}, ${body.length} chars) === */\n` + body;
}).join('\n');

fs.writeFileSync(path.resolve(__dirname, '../tools/all-inline.js'), combined);
console.log('written ' + combined.length + ' chars');
