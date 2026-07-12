const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\liuhua\\Desktop\\Github\\markdown\\index.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, total = 0, idx = 0;
while ((m = re.exec(html))) {
  const code = m[1];
  if (!code.trim()) continue;
  idx++;
  try {
    new Function(code);
    console.log('script #' + idx + ' OK (' + code.length + ' chars)');
  } catch (e) {
    console.log('script #' + idx + ' SYNTAX ERROR: ' + e.message);
  }
  total++;
}
console.log('total inline scripts:', total);