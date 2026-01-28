/// <reference types="vite/client" />

interface Window {
  api: {
    // --- INVENTORY & DASHBOARD ---
    getDashboardStats: () => Promise<{ success: boolean; data: any; error?: string }>;
    getCategories: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    getAssets: (categoryId?: string) => Promise<{ success: boolean; data: any[]; error?: string }>;
    
    // Category Management
    createCategory: (data: { name: string, description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateCategory: (id: string, data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    createSubCategory: (data: { categoryId: string, name: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateSubCategory: (id: string, data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    
    // Asset Management
    createAsset: (data: { subCategoryId: string, status: string, properties: any }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateAsset: (id: string, data: { status: string, properties: any }) => Promise<{ success: boolean; data?: any; error?: string }>;

    // Excel Operations
    importExcel: () => Promise<{ success: boolean; report?: any; error?: string }>;
    exportExcel: () => Promise<{ success: boolean; filePath?: string; error?: string }>;

    // --- PURCHASE ORDERS ---
    getPurchaseOrders: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    createPurchaseOrder: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    deletePurchaseOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
    getPurchaseOrder: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    receiveItems: (data: any) => Promise<{ success: boolean; error?: string }>;
    importPurchaseOrders: () => Promise<{ success: boolean; count?: number; error?: string }>;
    parsePurchaseOrderPDF: () => Promise<{ success: boolean; data?: any; error?: string }>;

    // --- MAINTENANCE MODULE ---
    getMaintenanceRecords: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    createMaintenanceRecord: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    // Updated to accept object with id and cost
    resolveMaintenanceRecord: (data: { id: string, cost: number }) => Promise<{ success: boolean; error?: string }>;

    // --- SYSTEM & AUDIT ---
    getAuditLogs: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    backupDatabase: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  }
}