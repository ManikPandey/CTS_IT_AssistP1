/// <reference types="vite/client" />

interface Window {
  api: {
    // Dashboard
    getDashboardStats: () => Promise<{ success: boolean; data: any; error?: string }>;
    
    // Inventory: Fetching
    getCategories: () => Promise<{ success: boolean; data: any[]; error?: string }>;
    getAssets: (categoryId?: string) => Promise<{ success: boolean; data: any[]; error?: string }>;
    
    // Inventory: Actions
    createCategory: (data: { name: string, description?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateCategory: (id: string, data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  }
}