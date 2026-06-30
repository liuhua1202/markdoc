/**
 * Electron 桥接层（在渲染进程加载）
 *
 * 与 Android 原生桥接 (window.Android) 同样的设计模式，
 * 通过 window.Desktop 暴露 API。
 */
(function() {
  'use strict';

  if (typeof window.Desktop === 'undefined' || !window.Desktop.isElectron) {
    return;
  }

  console.log('%c🖥️ 马克档 Desktop 已连接 (Electron)', 'color:#FF5A5F;font-weight:bold;font-size:14px;');
  console.log('  平台:', window.Desktop.platform);

  // 菜单事件处理
  window.Desktop.onMenuAction(async (action) => {
    switch (action) {
      case 'new-doc':
        if (typeof DocManager !== 'undefined') DocManager.create('未命名文档', '');
        break;
      case 'export-all':
        if (typeof DocManager !== 'undefined') DocManager.exportAll();
        break;
      case 'view-edit':
        if (typeof ViewManager !== 'undefined') ViewManager.set('edit');
        break;
      case 'view-split':
        if (typeof ViewManager !== 'undefined') ViewManager.set('split');
        break;
      case 'view-preview':
        if (typeof ViewManager !== 'undefined') ViewManager.set('preview');
        break;
      case 'toggle-theme':
        if (typeof ThemeManager !== 'undefined') ThemeManager.cycle();
        break;
      case 'about':
        showToast('马克档 v1.0.0 · 桌面版');
        break;
      case 'save-md-prompt': {
        const text = document.getElementById('editor').value;
        const active = typeof DocManager !== 'undefined' ? DocManager.active() : null;
        const defaultName = active ? active.title + '.md' : 'untitled.md';
        const result = await window.Desktop.saveMarkdown(text, defaultName);
        if (result.ok) {
          window.Desktop.notify('保存成功', result.path);
        } else if (result.error) {
          window.Desktop.notify('保存失败', result.error);
        }
        break;
      }
    }
  });

  // 监听从菜单打开文件
  window.Desktop.onImportDoc(({ title, content, path }) => {
    if (typeof DocManager !== 'undefined') {
      const doc = DocManager.create(title || '导入文档', content);
      if (path) doc.path = path;
      showToast(`已导入: ${title}`);
    }
  });

  // 系统主题变化
  window.Desktop.onThemeChange((isDark) => {
    if (typeof ThemeManager !== 'undefined' && ThemeManager.current === 'auto') {
      ThemeManager.set('auto', false);
    }
  });

  // 覆盖部分原生桥接方法（用 Electron 替代浏览器）
  window.openExternalFile = async function() {
    const result = await window.Desktop.openMarkdown();
    if (result && result.content) {
      if (typeof DocManager !== 'undefined') {
        DocManager.create(result.name || '导入文档', result.content);
      }
      showToast(`已打开: ${result.name}`);
    }
  };

  // 拦截 SW 注册（Electron 用本地缓存，不需要 SW）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  }

  // 标记为 Desktop 模式（用于 UI 显示）
  document.documentElement.setAttribute('data-platform', 'electron');
})();