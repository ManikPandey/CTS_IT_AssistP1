import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Inventory
  getDashboardStats: () => ipcRenderer.invoke('dashboard:get-stats'),
  getCategories: () => ipcRenderer.invoke('inventory:get-categories'),
  getAssets: (categoryId?: string) => ipcRenderer.invoke('inventory:get-assets', categoryId),
  createCategory: (data: any) => ipcRenderer.invoke('inventory:create-category', data),
  updateCategory: (id: string, data: any) => ipcRenderer.invoke('inventory:update-category', { id, data }),
  importExcel: () => ipcRenderer.invoke('inventory:import-excel'),
  exportExcel: () => ipcRenderer.invoke('inventory:export-excel'),

  // Purchase Orders
  getPurchaseOrders: () => ipcRenderer.invoke('purchase:get-all'),
  createPurchaseOrder: (data: any) => ipcRenderer.invoke('purchase:create', data),
  deletePurchaseOrder: (id: string) => ipcRenderer.invoke('purchase:delete', id),
  getPurchaseOrder: (id: string) => ipcRenderer.invoke('purchase:get-one', id),
  
  // NEW: Receive Items
  receiveItems: (data: any) => ipcRenderer.invoke('purchase:receive-items', data),
});