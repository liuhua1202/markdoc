/**
 * Electron Preload Script
 *
 * 安全地在主进程和渲染进程之间搭桥：
 * - 使用 contextBridge 暴露有限的 API
 * - 不直接暴露 ipcRenderer
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('Desktop', {
  isElectron: true,
  platform: process.platform,

  // 保存 Markdown 文件（系统对话框）
  saveMarkdown: (content, defaultName) => ipcRenderer.invoke('save-md', { content, defaultName }),

  // 打开 Markdown 文件（系统对话框）
  openMarkdown: () => ipcRenderer.invoke('open-md'),

  // 系统通知
  notify: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),

  // 监听菜单事件
  onMenuAction: (handler) => {
    const listener = (event, action) => handler(action);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.removeListener('menu-action', listener);
  },

  // 监听打开文件事件（菜单"打开"或拖入）
  onImportDoc: (handler) => {
    const listener = (event, data) => handler(data);
    ipcRenderer.on('import-doc', listener);
    return () => ipcRenderer.removeListener('import-doc', listener);
  },

  // 监听主题变化（系统级）
  onThemeChange: (handler) => {
    const listener = (event, isDark) => handler(isDark);
    ipcRenderer.on('theme-changed', listener);
    return () => ipcRenderer.removeListener('theme-changed', listener);
  },
});