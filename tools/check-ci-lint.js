const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const checks = [
  '# 欢迎使用',
  '```javascript',
  '```python',
  '```mermaid',
  '$$',
  'graph TD',
  'task-list',
  '## 📊',
];
for (const c of checks) {
  const found = html.includes(c);
  console.log((found ? '  ✓ ' : '  ❌ ') + JSON.stringify(c));
}