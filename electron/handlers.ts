import { ipcMain, dialog } from 'electron';
import { prisma } from './db';
import { importExcelData, exportExcelData } from './services/excel';

export function registerHandlers() {
  
  // ... (Keep ALL previous handlers) ...
  // dashboard:get-stats, inventory:*, purchase:get-all, purchase:create, purchase:delete, purchase:get-one
  
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

  // 2. GET All Categories
  ipcMain.handle('inventory:get-categories', async () => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { subCategories: true }
      });
      return { success: true, data: categories };
    } catch (error) {
      console.error("Error fetching categories:", error);
      return { success: false, error: "Failed to fetch categories" };
    }
  });

  // 3. GET Assets
  ipcMain.handle('inventory:get-assets', async (_, categoryId?: string) => {
    try {
      const whereClause = categoryId 
        ? { subCategory: { categoryId: categoryId } } 
        : {};

      const assets = await prisma.asset.findMany({
        where: whereClause,
        include: { 
          subCategory: { include: { category: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 100 
      });
      return { success: true, data: assets };
    } catch (error) {
      console.error("Error fetching assets:", error);
      return { success: false, error: "Failed to fetch assets" };
    }
  });

  // 4. CREATE Category
  ipcMain.handle('inventory:create-category', async (_, data: { name: string, description?: string }) => {
    try {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const category = await prisma.category.create({
        data: { ...data, slug }
      });
      return { success: true, data: category };
    } catch (error) {
      console.error("Error creating category:", error);
      return { success: false, error: "Failed to create category." };
    }
  });

  // 5. UPDATE Category
  ipcMain.handle('inventory:update-category', async (_, { id, data }: { id: string, data: any }) => {
    try {
       if (data.name) {
         data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
       }
       const category = await prisma.category.update({
         where: { id },
         data
       });
       return { success: true, data: category };
    } catch (error) {
      console.error("Error updating category:", error);
      return { success: false, error: "Failed to update category" };
    }
  });

  // 6. IMPORT EXCEL
  ipcMain.handle('inventory:import-excel', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: "No file selected" };
    }

    try {
      const importResult = await importExcelData(result.filePaths[0]);
      return importResult;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 7. EXPORT EXCEL
  ipcMain.handle('inventory:export-excel', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Inventory Report',
      defaultPath: `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: "Export cancelled" };
    }

    try {
      await exportExcelData(result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (error: any) {
      console.error("Export failed:", error);
      return { success: false, error: error.message };
    }
  });

  // 8. GET All POs
  ipcMain.handle('purchase:get-all', async () => {
    try {
      const pos = await prisma.purchaseOrder.findMany({
        orderBy: { date: 'desc' },
        include: { lineItems: true }
      });
      return { success: true, data: pos };
    } catch (error) {
      console.error("Error fetching POs:", error);
      return { success: false, error: "Failed to fetch Purchase Orders" };
    }
  });

  // 9. CREATE PO
  ipcMain.handle('purchase:create', async (_, poData: any) => {
    try {
      const { lineItems, vendorName, gstin, ...header } = poData;

      const newPO = await prisma.purchaseOrder.create({
        data: {
          ...header,
          vendorNameSnap: vendorName, 
          gstin: gstin,
          date: new Date(header.date),
          lineItems: {
            create: lineItems.map((item: any) => ({
              srNo: Number(item.srNo),
              productName: item.productName,
              quantity: Number(item.quantity),
              uom: item.uom,
              unitPrice: Number(item.unitPrice),
              gst: Number(item.gst),
              totalAmount: Number(item.totalAmount)
            }))
          }
        }
      });
      
      return { success: true, data: newPO };
    } catch (error: any) {
      console.error("Error creating PO:", error);
      return { success: false, error: "Failed to create Purchase Order: " + error.message };
    }
  });

  // 10. DELETE PO
  ipcMain.handle('purchase:delete', async (_, id: string) => {
    try {
      await prisma.purchaseOrder.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      console.error("Delete Error:", error);
      return { success: false, error: "Failed to delete PO: " + error.message };
    }
  });

  // 11. GET Single PO
  ipcMain.handle('purchase:get-one', async (_, id: string) => {
    try {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { lineItems: true }
      });
      return { success: true, data: po };
    } catch (error) {
      return { success: false, error: "PO not found" };
    }
  });

  // 12. RECEIVE ITEMS (NEW GRN HANDLER)
  ipcMain.handle('purchase:receive-items', async (_, payload: { 
    poId: string, 
    items: Array<{ lineItemId: string, quantity: number, categoryId: string, subCategoryId: string, serials: string[] }> 
  }) => {
    try {
      // Use a transaction to ensure all or nothing
      await prisma.$transaction(async (tx: any) => {
        for (const item of payload.items) {
          // 1. Update Line Item Received Qty
          await tx.lineItem.update({
            where: { id: item.lineItemId },
            data: { receivedQty: { increment: item.quantity } }
          });

          // 2. Fetch Line Item details for Asset Name
          const lineItem = await tx.lineItem.findUnique({ where: { id: item.lineItemId } });
          const productName = lineItem?.productName || "Received Asset";

          // 3. Create Assets
          for (const serial of item.serials) {
            const properties = JSON.stringify({
              name: productName,
              serial: serial,
              "po_ref": payload.poId
            });

            await tx.asset.create({
              data: {
                subCategoryId: item.subCategoryId,
                properties: properties,
                status: "ACTIVE",
                purchaseOrderId: payload.poId
              }
            });
          }
        }

        // 4. Check if PO is Fully Completed
        const po = await tx.purchaseOrder.findUnique({
          where: { id: payload.poId },
          include: { lineItems: true }
        });

        if (po) {
          const allReceived = po.lineItems.every((li: any) => li.receivedQty >= li.quantity);
          if (allReceived) {
            await tx.purchaseOrder.update({
              where: { id: payload.poId },
              data: { status: "COMPLETED" }
            });
          } else {
             await tx.purchaseOrder.update({
              where: { id: payload.poId },
              data: { status: "PARTIAL" }
            });
          }
        }
      });

      return { success: true };
    } catch (error: any) {
      console.error("Receive Items Error:", error);
      return { success: false, error: "Failed to receive items: " + error.message };
    }
  });

  console.log('✅ IPC Handlers Registered');
}