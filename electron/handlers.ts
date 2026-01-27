import { ipcMain, dialog, app } from 'electron';
import { prisma } from './db';
import { importExcelData, exportExcelData } from './services/excel';
import fs from 'fs';
import path from 'path';

// --- HELPER: Audit Logging ---
async function logAction(action: string, entityType: string, entityId: string | null, details: string) {
  try {
    await prisma.auditLog.create({
      data: { action, entityType, entityId, details }
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}

export function registerHandlers() {
  
  // --- DASHBOARD ---
  ipcMain.handle('dashboard:get-stats', async () => {
    try {
      const [assetCount, poCount, categoryCount] = await Promise.all([
        prisma.asset.count(),
        prisma.purchaseOrder.count(),
        prisma.category.count()
      ]);
      return { success: true, data: { assetCount, poCount, categoryCount } };
    } catch (error) {
      return { success: false, error: "Failed to fetch stats" };
    }
  });

  // --- INVENTORY ---
  ipcMain.handle('inventory:get-categories', async () => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { subCategories: true }
      });
      return { success: true, data: categories };
    } catch (error) {
      return { success: false, error: "Failed to fetch categories" };
    }
  });

  ipcMain.handle('inventory:get-assets', async (_, categoryId?: string) => {
    try {
      const whereClause = categoryId ? { subCategory: { categoryId: categoryId } } : {};
      const assets = await prisma.asset.findMany({
        where: whereClause,
        include: { subCategory: { include: { category: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100 
      });
      return { success: true, data: assets };
    } catch (error) {
      return { success: false, error: "Failed to fetch assets" };
    }
  });

  ipcMain.handle('inventory:create-category', async (_, data: { name: string }) => {
    try {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const category = await prisma.category.create({ data: { ...data, slug } });
      await logAction('CREATE', 'CATEGORY', category.id, `Created category: ${data.name}`);
      return { success: true, data: category };
    } catch (error) {
      return { success: false, error: "Failed to create category." };
    }
  });

  // NEW: Create Sub-Category
  ipcMain.handle('inventory:create-subcategory', async (_, { categoryId, name }: { categoryId: string, name: string }) => {
    try {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) return { success: false, error: "Category not found" };

      const slug = (category.slug + '-' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      const subCategory = await prisma.subCategory.create({
        data: { name, slug, categoryId }
      });
      
      await logAction('CREATE', 'SUBCATEGORY', subCategory.id, `Created sub-category: ${name} in ${category.name}`);
      return { success: true, data: subCategory };
    } catch (error: any) {
      console.error(error);
      return { success: false, error: "Failed to create sub-category: " + error.message };
    }
  });

  ipcMain.handle('inventory:update-category', async (_, { id, data }: { id: string, data: any }) => {
    try {
       if (data.name) data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
       const category = await prisma.category.update({ where: { id }, data });
       await logAction('UPDATE', 'CATEGORY', id, `Updated category: ${category.name}`);
       return { success: true, data: category };
    } catch (error) {
      return { success: false, error: "Failed to update category" };
    }
  });

  // NEW: Update Asset
  ipcMain.handle('inventory:update-asset', async (_, { id, status, properties }: { id: string, status: string, properties: any }) => {
    try {
      const asset = await prisma.asset.update({
        where: { id },
        data: {
          status,
          properties: JSON.stringify(properties) // Store as JSON string
        }
      });
      
      // Try to get a name for the log
      const name = properties['name'] || properties['Name'] || id;
      await logAction('UPDATE', 'ASSET', id, `Updated asset: ${name} (${status})`);
      
      return { success: true, data: asset };
    } catch (error: any) {
      return { success: false, error: "Failed to update asset: " + error.message };
    }
  });

  ipcMain.handle('inventory:import-excel', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false, error: "No file selected" };

    try {
      const importResult = await importExcelData(result.filePaths[0]);
      await logAction('IMPORT', 'SYSTEM', null, `Imported Excel. Success: ${importResult.report?.success}`);
      return importResult;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:export-excel', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Inventory Report',
      defaultPath: `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || !result.filePath) return { success: false, error: "Export cancelled" };

    try {
      await exportExcelData(result.filePath);
      await logAction('EXPORT', 'SYSTEM', null, `Exported inventory to ${path.basename(result.filePath)}`);
      return { success: true, filePath: result.filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // --- PURCHASE ORDERS ---
  ipcMain.handle('purchase:get-all', async () => {
    try {
      const pos = await prisma.purchaseOrder.findMany({
        orderBy: { date: 'desc' },
        include: { lineItems: true }
      });
      return { success: true, data: pos };
    } catch (error) {
      return { success: false, error: "Failed to fetch POs" };
    }
  });

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
      await logAction('CREATE', 'PO', newPO.id, `Created PO ${newPO.poNumber} for ${vendorName}`);
      return { success: true, data: newPO };
    } catch (error: any) {
      return { success: false, error: "Failed to create PO: " + error.message };
    }
  });

  ipcMain.handle('purchase:delete', async (_, id: string) => {
    try {
      const po = await prisma.purchaseOrder.findUnique({ where: { id } });
      await prisma.purchaseOrder.delete({ where: { id } });
      await logAction('DELETE', 'PO', id, `Deleted PO ${po?.poNumber}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: "Failed to delete PO" };
    }
  });

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

  ipcMain.handle('purchase:receive-items', async (_, payload: { 
    poId: string, 
    items: Array<{ lineItemId: string, quantity: number, categoryId: string, subCategoryId: string, serials: string[] }> 
  }) => {
    try {
      await prisma.$transaction(async (tx: any) => {
        let itemsReceivedCount = 0;
        for (const item of payload.items) {
          await tx.lineItem.update({
            where: { id: item.lineItemId },
            data: { receivedQty: { increment: item.quantity } }
          });
          const lineItem = await tx.lineItem.findUnique({ where: { id: item.lineItemId } });
          const productName = lineItem?.productName || "Received Asset";
          for (const serial of item.serials) {
            const properties = JSON.stringify({ name: productName, serial: serial, "po_ref": payload.poId });
            await tx.asset.create({
              data: {
                subCategoryId: item.subCategoryId,
                properties: properties,
                status: "ACTIVE",
                purchaseOrderId: payload.poId
              }
            });
            itemsReceivedCount++;
          }
        }
        const po = await tx.purchaseOrder.findUnique({ where: { id: payload.poId }, include: { lineItems: true } });
        if (po) {
          const allReceived = po.lineItems.every((li: any) => li.receivedQty >= li.quantity);
          const newStatus = allReceived ? "COMPLETED" : "PARTIAL";
          await tx.purchaseOrder.update({ where: { id: payload.poId }, data: { status: newStatus } });
          await logAction('RECEIVE', 'PO', payload.poId, `Received ${itemsReceivedCount} items for PO ${po.poNumber}. Status: ${newStatus}`);
        }
      });
      return { success: true };
    } catch (error: any) {
      console.error(error);
      return { success: false, error: "Failed to receive items: " + error.message };
    }
  });

  // --- SYSTEM & SETTINGS ---
  ipcMain.handle('system:get-audit-logs', async () => {
    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 200
      });
      return { success: true, data: logs };
    } catch (error) {
      return { success: false, error: "Failed to fetch logs" };
    }
  });

  ipcMain.handle('system:backup', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Backup Database',
      defaultPath: `IT_Assets_Backup_${new Date().toISOString().split('T')[0]}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (result.canceled || !result.filePath) return { success: false };

    try {
      const dbPath = path.join(process.cwd(), 'prisma/dev.db');
      fs.copyFileSync(dbPath, result.filePath);
      await logAction('BACKUP', 'SYSTEM', null, 'Database backup created manually');
      return { success: true, filePath: result.filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  console.log('✅ IPC Handlers Registered');
}