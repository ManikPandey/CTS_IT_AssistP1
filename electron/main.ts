import { app, BrowserWindow } from 'electron';
import path from 'path';
import { seedDatabase } from './db';
import { registerHandlers } from './handlers';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400, // Large "Enterprise" width
    height: 900,
    webPreferences: {
      // SECURITY: Deny direct Node access to frontend
      nodeIntegration: false,
      // SECURITY: Isolate context
      contextIsolation: true,
      // Connect the secure bridge
      preload: path.join(__dirname, 'preload.js'),
    },
    title: "IT Asset & Procurement System",
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    // In dev mode, load from the Vite server
    mainWindow.loadURL('http://localhost:5173');
    
    // Open the DevTools for debugging
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  try {
    console.log("🚀 Application Starting...");

    // 1. Initialize Database & Seed Categories
    // This runs the logic in db.ts to make sure Laptops, Printers, etc. exist
    await seedDatabase();
    
    // 2. Register API Handlers
    // This runs the logic in handlers.ts to listen for frontend requests
    registerHandlers();

    // 3. Create the Main Window
    createWindow();

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

  } catch (error) {
    console.error("❌ Fatal Error during startup:", error);
  }
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});