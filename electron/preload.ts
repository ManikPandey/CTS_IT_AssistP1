import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // --- AUTHENTICATION ---
  checkInit: () => ipcRenderer.invoke('auth:check-init'),
  login: (creds: any) => ipcRenderer.invoke('auth:login', creds),
  register: (data: any) => ipcRenderer.invoke('auth:register', data),
  getUsers: () => ipcRenderer.invoke('auth:get-users'),
  changePassword: (data: any) => ipcRenderer.invoke('auth:change-password', data),

  // --- INVENTORY & DASHBOARD ---
  getDashboardStats: () => ipcRenderer.invoke('dashboard:get-stats'),
  getCategories: () => ipcRenderer.invoke('inventory:get-categories'),
  getAssets: (categoryId?: string) => ipcRenderer.invoke('inventory:get-assets', categoryId),
  
  // Category Management
  createCategory: (data: any) => ipcRenderer.invoke('inventory:create-category', data),
  updateCategory: (id: string, data: any) => ipcRenderer.invoke('inventory:update-category', { id, data }),
  
  // Sub-Category Management
  createSubCategory: (data: any) => ipcRenderer.invoke('inventory:create-subcategory', data),
  updateSubCategory: (id: string, data: any) => ipcRenderer.invoke('inventory:update-subcategory', { id, data }),
  
  // Asset Management
  createAsset: (data: any) => ipcRenderer.invoke('inventory:create-asset', data),
  updateAsset: (id: string, data: any) => ipcRenderer.invoke('inventory:update-asset', { id, ...data }),

  // Excel Operations
  importExcel: () => ipcRenderer.invoke('inventory:import-excel'),
  exportExcel: () => ipcRenderer.invoke('inventory:export-excel'),

  // --- PURCHASE ORDERS ---
  getPurchaseOrders: () => ipcRenderer.invoke('purchase:get-all'),
  createPurchaseOrder: (data: any) => ipcRenderer.invoke('purchase:create', data),
  deletePurchaseOrder: (id: string) => ipcRenderer.invoke('purchase:delete', id),
  getPurchaseOrder: (id: string) => ipcRenderer.invoke('purchase:get-one', id),
  
  // Receiving
  receiveItems: (data: any) => ipcRenderer.invoke('purchase:receive-items', data),
  
  // Import/Scan
  importPurchaseOrders: () => ipcRenderer.invoke('purchase:import'),
  parsePurchaseOrderPDF: () => ipcRenderer.invoke('purchase:parse-pdf'),

  // --- MAINTENANCE ---
  createMaintenanceRecord: (data: any) => ipcRenderer.invoke('maintenance:create', data),
  getMaintenanceRecords: () => ipcRenderer.invoke('maintenance:get-all'),
  resolveMaintenanceRecord: (data: any) => ipcRenderer.invoke('maintenance:resolve', data),

  // --- SYSTEM & SETTINGS ---
  getAuditLogs: () => ipcRenderer.invoke('system:get-audit-logs'),
  backupDatabase: () => ipcRenderer.invoke('system:backup'),

  // NEW: Delete Handlers (Added in Phase 10)
  deleteAsset: (id: string) => ipcRenderer.invoke('system:delete-asset', id),
  deleteSubCategory: (id: string) => ipcRenderer.invoke('system:delete-subcategory', id),
  deleteCategory: (id: string) => ipcRenderer.invoke('system:delete-category', id),
});