/// <reference types="vite/client" />

interface Window {
  api: {
    // Inventory
    getDashboardStats: () => Promise<{ success: boolean; data: any; error?: string }>;
    getCategories: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    getAssets: (categoryId?: string) => Promise<{ success: boolean; data: any[]; error?: string }>;
    createCategory: (data: { name: string, description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateCategory: (id: string, data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    
    // NEW TYPES (Sub-Categories & Assets)
    createSubCategory: (data: { categoryId: string, name: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateAsset: (id: string, data: { status: string, properties: any }) => Promise<{ success: boolean; data?: any; error?: string }>;

    importExcel: () => Promise<{ success: boolean; report?: any; error?: string }>;
    exportExcel: () => Promise<{ success: boolean; filePath?: string; error?: string }>;

    // Purchase Orders
    getPurchaseOrders: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    createPurchaseOrder: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    deletePurchaseOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
    getPurchaseOrder: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    receiveItems: (data: any) => Promise<{ success: boolean; error?: string }>;

    // System
    getAuditLogs: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    backupDatabase: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  }
}