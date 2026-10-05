const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('node:path');
require('node:fs').mkdirSync(path.join(process.env.DANYA_DATA, '桌宠缓存'), { recursive: true });
app.setPath('userData', path.join(process.env.DANYA_DATA, '桌宠缓存'));
require('./main.js');
app.setName('danya-desktop-pet');
let tray;
let settingsWindow;
app.whenReady().then(() => {
  const base = new URL(process.env.DSH_PET_CONFIG_URL).origin;
  const openSettings = () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow.show();
    settingsWindow = new BrowserWindow({ width: 560, height: 590, title: '达妮娅桌宠设置', autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    settingsWindow.loadURL(base);
    settingsWindow.on('closed', () => { settingsWindow = null; });
  };
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '../../assets/logo.png')).resize({ width: 32, height: 32 }));
  tray.setToolTip('达妮娅桌宠 · dsh-pet 0.3.0');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '桌宠设置', click: openSettings },
    { type: 'separator' },
    { label: '退出桌宠', click: () => fetch(base + '/shutdown', { method: 'POST' }).finally(() => app.quit()) },
  ]));
  tray.on('double-click', openSettings);
  console.log('danya-ready');
});
