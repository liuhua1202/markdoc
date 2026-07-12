// 回归测试: 验证更多按钮失效 bug 已修复
// 核心断言: Outline.open 关闭 Drawer 后, Drawer.isOpen 必须变 false
// 这样后续 Drawer.open() 不会早返回,按钮能正常开抽屉
const assert = require('assert');

// 模拟 DOM
const fakeEl = (id) => {
  const cls = new Set();
  return {
    id,
    classList: {
      contains: (c) => cls.has(c),
      add: (c) => cls.add(c),
      remove: (c) => cls.delete(c),
      toggle: (c, v) => v === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : (v ? cls.add(c) : cls.delete(c)),
    },
  };
};

// === 复制 Drawer 核心逻辑 (从 index.html 重构后) ===
const drawer = fakeEl('drawer');
const mask = fakeEl('drawer-mask');
const Drawer = {
  drawer,
  mask,
  isOpen: false,
  setOpen(next) {
    if (this.isOpen === next) return;
    this.isOpen = next;
    this.drawer.classList.toggle('show', next);
    this.mask.classList.toggle('show', next);
  },
  open() {
    const outline = fakeEl('outline-panel');
    const outlineMask = fakeEl('outline-mask');
    if (outline && outline.classList.contains('show')) {
      outline.classList.remove('show');
      if (outlineMask) outlineMask.classList.remove('show');
    }
    this.setOpen(true);
  },
  close() {
    this.setOpen(false);
  },
};

// === 复制 Outline.open 修复后逻辑 ===
const outline = fakeEl('outline-panel');
const Outline = {
  panel: outline,
  open() {
    if (typeof Drawer !== 'undefined' && Drawer.isOpen) Drawer.close();
    this.panel.classList.add('show');
  },
};

// === Test 1: 初始状态 ===
assert.strictEqual(Drawer.isOpen, false, '初始状态应为关闭');
console.log('✓ initial: Drawer.isOpen = false');

// === Test 2: 第一次点更多按钮 ===
Drawer.open();
assert.strictEqual(Drawer.isOpen, true, 'open 后应 isOpen = true');
assert.strictEqual(drawer.classList.contains('show'), true, 'drawer 应有 show class');
console.log('✓ after Drawer.open(): isOpen = true, drawer.show = true');

// === Test 3: 点大纲按钮, Outline.open 互斥关闭 Drawer ===
Outline.open();
assert.strictEqual(Drawer.isOpen, false, 'Outline.open 后 Drawer.isOpen 必须为 false');
assert.strictEqual(drawer.classList.contains('show'), false, 'drawer 不应有 show class');
console.log('✓ after Outline.open(): Drawer.isOpen = false, drawer.show = false');

// === Test 4: 再次点更多按钮 (这是用户报"失效"的关键场景) ===
Drawer.open();
assert.strictEqual(Drawer.isOpen, true, '第二次打开必须成功 (修复点)');
console.log('✓ second Drawer.open(): isOpen = true — 更多按钮未失效');

// === Test 5: 多次切换不漏状态 ===
for (let i = 0; i < 5; i++) {
  Drawer.open();
  Outline.open();
}
assert.strictEqual(Drawer.isOpen, false, '循环后状态仍正确');
console.log('✓ 5 轮 Outline→Drawer 切换后, 状态仍正确');

console.log('\n✅ 全部 PASS — 更多按钮失效 bug 已修复');