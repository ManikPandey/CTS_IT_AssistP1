"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    // --- AUTHENTICATION ---
    checkInit: () => electron_1.ipcRenderer.invoke('auth:check-init'),
    login: (creds) => electron_1.ipcRenderer.invoke('auth:login', creds),
    register: (data) => electron_1.ipcRenderer.invoke('auth:register', data),
    getUsers: () => electron_1.ipcRenderer.invoke('auth:get-users'),
    // NEW: Change Password
    changePassword: (data) => electron_1.ipcRenderer.invoke('auth:change-password', data),
    // --- INVENTORY & DASHBOARD ---
    getDashboardStats: () => electron_1.ipcRenderer.invoke('dashboard:get-stats'),
    getCategories: () => electron_1.ipcRenderer.invoke('inventory:get-categories'),
    getAssets: (categoryId) => electron_1.ipcRenderer.invoke('inventory:get-assets', categoryId),
    // Category Management
    createCategory: (data) => electron_1.ipcRenderer.invoke('inventory:create-category', data),
    updateCategory: (id, data) => electron_1.ipcRenderer.invoke('inventory:update-category', { id, data }),
    // Sub-Category Management
    createSubCategory: (data) => electron_1.ipcRenderer.invoke('inventory:create-subcategory', data),
    updateSubCategory: (id, data) => electron_1.ipcRenderer.invoke('inventory:update-subcategory', { id, data }),
    // Asset Management
    createAsset: (data) => electron_1.ipcRenderer.invoke('inventory:create-asset', data),
    updateAsset: (id, data) => electron_1.ipcRenderer.invoke('inventory:update-asset', { id, ...data }),
    // Excel Operations
    importExcel: () => electron_1.ipcRenderer.invoke('inventory:import-excel'),
    exportExcel: () => electron_1.ipcRenderer.invoke('inventory:export-excel'),
    // --- PURCHASE ORDERS ---
    getPurchaseOrders: () => electron_1.ipcRenderer.invoke('purchase:get-all'),
    createPurchaseOrder: (data) => electron_1.ipcRenderer.invoke('purchase:create', data),
    deletePurchaseOrder: (id) => electron_1.ipcRenderer.invoke('purchase:delete', id),
    getPurchaseOrder: (id) => electron_1.ipcRenderer.invoke('purchase:get-one', id),
    // Receiving
    receiveItems: (data) => electron_1.ipcRenderer.invoke('purchase:receive-items', data),
    // Import/Scan
    importPurchaseOrders: () => electron_1.ipcRenderer.invoke('purchase:import'),
    parsePurchaseOrderPDF: () => electron_1.ipcRenderer.invoke('purchase:parse-pdf'),
    // --- MAINTENANCE ---
    createMaintenanceRecord: (data) => electron_1.ipcRenderer.invoke('maintenance:create', data),
    getMaintenanceRecords: () => electron_1.ipcRenderer.invoke('maintenance:get-all'),
    resolveMaintenanceRecord: (data) => electron_1.ipcRenderer.invoke('maintenance:resolve', data),
    // --- SYSTEM ---
    getAuditLogs: () => electron_1.ipcRenderer.invoke('system:get-audit-logs'),
    backupDatabase: () => electron_1.ipcRenderer.invoke('system:backup'),
});
