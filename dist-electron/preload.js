"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    // Inventory
    getDashboardStats: () => electron_1.ipcRenderer.invoke('dashboard:get-stats'),
    getCategories: () => electron_1.ipcRenderer.invoke('inventory:get-categories'),
    getAssets: (categoryId) => electron_1.ipcRenderer.invoke('inventory:get-assets', categoryId),
    createCategory: (data) => electron_1.ipcRenderer.invoke('inventory:create-category', data),
    updateCategory: (id, data) => electron_1.ipcRenderer.invoke('inventory:update-category', { id, data }),
    importExcel: () => electron_1.ipcRenderer.invoke('inventory:import-excel'),
    exportExcel: () => electron_1.ipcRenderer.invoke('inventory:export-excel'),
    // Purchase Orders
    getPurchaseOrders: () => electron_1.ipcRenderer.invoke('purchase:get-all'),
    createPurchaseOrder: (data) => electron_1.ipcRenderer.invoke('purchase:create', data),
    deletePurchaseOrder: (id) => electron_1.ipcRenderer.invoke('purchase:delete', id),
    getPurchaseOrder: (id) => electron_1.ipcRenderer.invoke('purchase:get-one', id),
    receiveItems: (data) => electron_1.ipcRenderer.invoke('purchase:receive-items', data),
    // NEW: System & Settings
    getAuditLogs: () => electron_1.ipcRenderer.invoke('system:get-audit-logs'),
    backupDatabase: () => electron_1.ipcRenderer.invoke('system:backup'),
});
