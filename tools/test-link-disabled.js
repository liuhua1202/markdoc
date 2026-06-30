const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><html><head>
<link id="test" rel="stylesheet" href="data:text/css,body{color:red}">
</head><body></body></html>`);
const el = dom.window.document.getElementById('test');
console.log('before:', el.disabled);
try {
  el.disabled = true;
  console.log('set true: OK, now =', el.disabled);
} catch(e) {
  console.log('set true failed:', e.message);
}
try {
  el.disabled = false;
  console.log('set false: OK, now =', el.disabled);
} catch(e) {
  console.log('set false failed:', e.message);
}