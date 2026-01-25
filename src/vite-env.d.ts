/// <reference types="vite/client" />

interface Window {
  api: {
    getDashboardStats: () => Promise<{ success: boolean; data: any; error?: string }>;
    getCategories: () => Promise<{ success: boolean; data: any[]; error?: string }>;
  }
}