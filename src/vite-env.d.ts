/// <reference types="vite/client" />

interface Window {
  api: {
    // --- AUTHENTICATION ---
    checkInit: () => Promise<{ initialized: boolean }>;
    login: (creds: any) => Promise<{ success: boolean; user?: any; error?: string }>;
    register: (data: any) => Promise<{ success: boolean; user?: any; error?: string }>;
    getUsers: () => Promise<{ success: boolean; data?: any[] }>;
    changePassword: (data: { userId: string, newPassword: string }) => Promise<{ success: boolean; error?: string }>;

    // --- INVENTORY & DASHBOARD ---
    getDashboardStats: () => Promise<{ success: boolean; data: any; error?: string }>;
    getCategories: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    getAssets: (categoryId?: string) => Promise<{ success: boolean; data: any[]; error?: string }>;
    
    // Category Management
    createCategory: (data: { name: string, description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateCategory: (id: string, data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    
    // Sub-Category Management
    createSubCategory: (data: { categoryId: string, name: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateSubCategory: (id: string, data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    
    // Asset Management
    createAsset: (data: { subCategoryId: string, status: string, properties: any }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateAsset: (id: string, data: { status: string, properties: any }) => Promise<{ success: boolean; data?: any; error?: string }>;

    // Excel Operations
    importExcel: () => Promise<{ success: boolean; report?: any; error?: string }>;
    exportExcel: () => Promise<{ success: boolean; filePath?: string; error?: string }>;

    // --- PURCHASE ORDERS ---
    getPurchaseOrders: (filters?: { search?: string, sort?: string, status?: string }) => Promise<{ success: boolean; data: any[]; error?: string }>;
    createPurchaseOrder: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    deletePurchaseOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
    getPurchaseOrder: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    
    // Receiving
    receiveItems: (data: any) => Promise<{ success: boolean; error?: string }>;
    
    // Import/Scan
    importPurchaseOrders: () => Promise<{ success: boolean; count?: number; error?: string }>;
    parsePurchaseOrderPDF: () => Promise<{ success: boolean; data?: any; error?: string }>;

    // --- MAINTENANCE MODULE ---
    getMaintenanceRecords: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    createMaintenanceRecord: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    resolveMaintenanceRecord: (data: { id: string, cost: number }) => Promise<{ success: boolean; error?: string }>;

    // --- SYSTEM & AUDIT ---
    getAuditLogs: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    backupDatabase: () => Promise<{ success: boolean; filePath?: string; error?: string }>;

    // NEW: Delete Handlers
    deleteAsset: (id: string) => Promise<{ success: boolean; error?: string }>;
    deleteSubCategory: (id: string) => Promise<{ success: boolean; error?: string }>;
    deleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>;
  }
}