"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const handlers_1 = require("./handlers");
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
const createWindow = () => {
    // Create the browser window.
    mainWindow = new electron_1.BrowserWindow({
        width: 1400, // Large "Enterprise" width
        height: 900,
        webPreferences: {
            // SECURITY: Deny direct Node access to frontend
            nodeIntegration: false,
            // SECURITY: Isolate context
            contextIsolation: true,
            // Connect the secure bridge
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
        title: "IT Asset & Procurement System",
    });
    // Load the app
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        // In dev mode, load from the Vite server
        mainWindow.loadURL('http://localhost:5173');
        // Open the DevTools for debugging
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, load the built index.html
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
};
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
electron_1.app.whenReady().then(async () => {
    try {
        console.log("🚀 Application Starting...");
        // 1. Initialize Database & Seed Categories
        // This runs the logic in db.ts to make sure Laptops, Printers, etc. exist
        await (0, db_1.seedDatabase)();
        // 2. Register API Handlers
        // This runs the logic in handlers.ts to listen for frontend requests
        (0, handlers_1.registerHandlers)();
        // 3. Create the Main Window
        createWindow();
        electron_1.app.on('activate', () => {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (electron_1.BrowserWindow.getAllWindows().length === 0)
                createWindow();
        });
    }
    catch (error) {
        console.error("❌ Fatal Error during startup:", error);
    }
});
// Quit when all windows are closed, except on macOS.
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
