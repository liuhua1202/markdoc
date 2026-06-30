/**
 * 马克档 - Electron 主进程
 *
 * 职责：
 * - 创建窗口并加载 index.html
 * - 提供原生菜单（文件 / 编辑 / 视图 / 帮助）
 * - 文件对话框集成（打开/保存 .md）
 * - 系统通知
 * - 快捷键支持
 */
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const isDev = process.argv.includes('--dev');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 320,
    minHeight: 480,
    title: '马克档',
    icon: path.join(__dirname, 'assets', 'logo.svg'),
    backgroundColor: '#FDFCF7',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 监听主题切换
  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    mainWindow.webContents.send('theme-changed', isDark);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        {
          label: '新建文档',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu-action', 'new-doc'),
        },
        {
          label: '打开 .md...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile(),
        },
        {
          label: '保存为 .md...',
          accelerator: 'CmdOrCtrl+S',
          click: () => saveFile(),
        },
        {
          label: '导出全部 (备份)...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu-action', 'export-all'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '仅源码',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.send('menu-action', 'view-edit'),
        },
        {
          label: '分屏',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.send('menu-action', 'view-split'),
        },
        {
          label: '仅预览',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow?.webContents.send('menu-action', 'view-preview'),
        },
        { type: 'separator' },
        {
          label: '切换主题',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow?.webContents.send('menu-action', 'toggle-theme'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于马克档',
          click: () => mainWindow?.webContents.send('menu-action', 'about'),
        },
        {
          label: '访问 GitHub',
          click: () => shell.openExternal('https://github.com'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: '全部', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled || !result.filePaths.length) return;
  for (const fp of result.filePaths) {
    try {
      const content = await fs.promises.readFile(fp, 'utf-8');
      const title = path.basename(fp).replace(/\.[^.]+$/, '');
      mainWindow?.webContents.send('import-doc', { title, content, path: fp });
    } catch (e) {
      dialog.showErrorBox('打开失败', e.message);
    }
  }
}

async function saveFile() {
  // 让 JS 端发送当前内容回来
  mainWindow?.webContents.send('menu-action', 'save-md-prompt');
}

// IPC: JS → 主进程 的桥接
ipcMain.handle('save-md', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Markdown',
    defaultPath: defaultName || 'untitled.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    await fs.promises.writeFile(result.filePath, content, 'utf-8');
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('open-md', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    const content = await fs.promises.readFile(result.filePaths[0], 'utf-8');
    return { content, name: path.basename(result.filePaths[0]), path: result.filePaths[0] };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('show-notification', async (event, { title, body }) => {
  const { Notification } = require('electron');
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
    return true;
  }
  return false;
});

ipcMain.handle('get-platform', () => process.platform);

// App 生命周期
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});