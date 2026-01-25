import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Dashboard Stats
  getDashboardStats: () => ipcRenderer.invoke('dashboard:get-stats'),
  
  // Inventory: Categories
  getCategories: () => ipcRenderer.invoke('inventory:get-categories'),
  
  // Inventory: Assets (Fetch logic)
  getAssets: (categoryId?: string) => ipcRenderer.invoke('inventory:get-assets', categoryId),
  
  // Inventory: Actions (Create & Update Categories)
  createCategory: (data: any) => ipcRenderer.invoke('inventory:create-category', data),
  updateCategory: (id: string, data: any) => ipcRenderer.invoke('inventory:update-category', { id, data }),
});