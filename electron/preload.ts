import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Inventory & Dashboard
  getDashboardStats: () => ipcRenderer.invoke('dashboard:get-stats'),
  getCategories: () => ipcRenderer.invoke('inventory:get-categories'),
  getAssets: (categoryId?: string) => ipcRenderer.invoke('inventory:get-assets', categoryId),
  createCategory: (data: any) => ipcRenderer.invoke('inventory:create-category', data),
  updateCategory: (id: string, data: any) => ipcRenderer.invoke('inventory:update-category', { id, data }),
  
  createSubCategory: (data: any) => ipcRenderer.invoke('inventory:create-subcategory', data),
  updateSubCategory: (id: string, data: any) => ipcRenderer.invoke('inventory:update-subcategory', { id, data }),
  
  createAsset: (data: any) => ipcRenderer.invoke('inventory:create-asset', data),
  updateAsset: (id: string, data: any) => ipcRenderer.invoke('inventory:update-asset', { id, ...data }),

  importExcel: () => ipcRenderer.invoke('inventory:import-excel'),
  exportExcel: () => ipcRenderer.invoke('inventory:export-excel'),

  // Purchase Orders
  getPurchaseOrders: () => ipcRenderer.invoke('purchase:get-all'),
  createPurchaseOrder: (data: any) => ipcRenderer.invoke('purchase:create', data),
  deletePurchaseOrder: (id: string) => ipcRenderer.invoke('purchase:delete', id),
  getPurchaseOrder: (id: string) => ipcRenderer.invoke('purchase:get-one', id),
  receiveItems: (data: any) => ipcRenderer.invoke('purchase:receive-items', data),
  importPurchaseOrders: () => ipcRenderer.invoke('purchase:import'),
  parsePurchaseOrderPDF: () => ipcRenderer.invoke('purchase:parse-pdf'),

  // NEW: Maintenance Module
  getMaintenanceRecords: () => ipcRenderer.invoke('maintenance:get-all'),
  createMaintenanceRecord: (data: any) => ipcRenderer.invoke('maintenance:create', data),
  resolveMaintenanceRecord: (id: string) => ipcRenderer.invoke('maintenance:resolve', id),

  // System & Security
  getAuditLogs: () => ipcRenderer.invoke('system:get-audit-logs'),
  backupDatabase: () => ipcRenderer.invoke('system:backup'),
});