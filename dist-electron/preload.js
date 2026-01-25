"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('api', {
    // Dashboard Stats
    getDashboardStats: () => electron_1.ipcRenderer.invoke('dashboard:get-stats'),
    // Inventory: Categories
    getCategories: () => electron_1.ipcRenderer.invoke('inventory:get-categories'),
    // Inventory: Assets (Fetch logic)
    getAssets: (categoryId) => electron_1.ipcRenderer.invoke('inventory:get-assets', categoryId),
    // Inventory: Actions (Create & Update Categories)
    createCategory: (data) => electron_1.ipcRenderer.invoke('inventory:create-category', data),
    updateCategory: (id, data) => electron_1.ipcRenderer.invoke('inventory:update-category', { id, data }),
});
