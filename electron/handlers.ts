import { ipcMain } from 'electron';
import { prisma } from './db';

export function registerHandlers() {
  
  // 1. GET Dashboard Stats
  ipcMain.handle('dashboard:get-stats', async () => {
    try {
      const [assetCount, poCount, categoryCount] = await Promise.all([
        prisma.asset.count(),
        prisma.purchaseOrder.count(),
        prisma.category.count()
      ]);
      
      return { success: true, data: { assetCount, poCount, categoryCount } };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return { success: false, error: "Failed to fetch stats" };
    }
  });

  // 2. GET All Categories (For the sidebar/inventory)
  ipcMain.handle('inventory:get-categories', async () => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { subCategories: true } } }
      });
      return { success: true, data: categories };
    } catch (error) {
      return { success: false, error: "Failed to fetch categories" };
    }
  });

  console.log('✅ IPC Handlers Registered');
}