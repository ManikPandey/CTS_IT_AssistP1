import { app, BrowserWindow } from 'electron';
import path from 'path';

// Global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400, // Enterprise width
    height: 900,
    webPreferences: {
      nodeIntegration: false, // SECURITY: False
      contextIsolation: true, // SECURITY: True
      preload: path.join(__dirname, 'preload.js'),
    },
    title: "IT Asset & Procurement System",
  });

  // In production, load the file. In dev, load localhost.
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools(); // Helpful for debugging
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});