import { ipcMain, dialog, app } from 'electron';
import { prisma } from './db';
import { importExcelData, exportExcelData, importPurchaseOrders } from './services/excel';
import { parsePurchaseOrderPDF } from './services/pdf';
import fs from 'fs';
import path from 'path';

// --- HELPER: Audit Logging ---
// Records actions to the database. Accepts optional 'tx' to log inside a transaction safely.
async function logAction(action: string, entityType: string, entityId: string | null, details: string, tx?: any) {
  try {
    const db = tx || prisma; 
    await db.auditLog.create({
      data: { action, entityType, entityId, details }
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}

export function registerHandlers() {
  
  // ==========================================
  // 1. DASHBOARD HANDLERS
  // ==========================================
  
  // [1] Get Dashboard Statistics
  ipcMain.handle('dashboard:get-stats', async () => {
    try {
      // Basic Counts
      const [assetCount, poCount, categoryCount, maintenanceCount] = await Promise.all([
        prisma.asset.count(),
        prisma.purchaseOrder.count(),
        prisma.category.count(),
        prisma.maintenanceRecord.count({ where: { status: { not: 'CLOSED' } } })
      ]);

      // Chart Data: Assets by Status
      const statusGroups = await prisma.asset.groupBy({
        by: ['status'],
        _count: { status: true }
      });
      const assetsByStatus = statusGroups.map((g:any) => ({ name: g.status, value: g._count.status }));

      // Chart Data: Assets by Category
      const categories = await prisma.category.findMany({
        include: {
          subCategories: { include: { _count: { select: { assets: true } } } }
        }
      });
      const assetsByCategory = categories.map((cat: any) => ({
        name: cat.name,
        value: cat.subCategories.reduce((acc: any, sub: any) => acc + sub._count.assets, 0)
      })).filter((c:any) => c.value > 0);

      // Chart Data: Purchase Cost by Month
      const allPOs = await prisma.purchaseOrder.findMany({ select: { date: true, totalAmount: true } });
      const costMap: Record<string, number> = {};
      allPOs.forEach((po:any) => {
        const month = new Date(po.date).toLocaleString('default', { month: 'short', year: '2-digit' });
        costMap[month] = (costMap[month] || 0) + po.totalAmount;
      });
      const costByMonth = Object.entries(costMap).map(([name, value]) => ({ name, value }));

      return { 
        success: true, 
        data: { assetCount, poCount, categoryCount, maintenanceCount, assetsByStatus, assetsByCategory, costByMonth } 
      };
    } catch (error) {
      return { success: false, error: "Failed to fetch stats" };
    }
  });

  // ==========================================
  // 2. INVENTORY HANDLERS (Categories/Assets)
  // ==========================================

  // [2] Get Categories Tree
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

  // [3] Get Assets (Filtered)
  ipcMain.handle('inventory:get-assets', async (_, categoryId?: string) => {
    try {
      const whereClause = categoryId ? { subCategory: { categoryId: categoryId } } : {};
      const assets = await prisma.asset.findMany({
        where: whereClause,
        include: { subCategory: { include: { category: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100 // Limit for performance
      });
      return { success: true, data: assets };
    } catch (error) {
      return { success: false, error: "Failed to fetch assets" };
    }
  });

  // [4] Create Category
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

  // [5] Update Category
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

  // [6] Create Sub-Category
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
      return { success: false, error: "Failed to create sub-category: " + error.message };
    }
  });

  // [7] Update Sub-Category (Renaming or Field Definitions)
  ipcMain.handle('inventory:update-subcategory', async (_, { id, data }: { id: string, data: any }) => {
    try {
      if (data.fieldDefinitions && typeof data.fieldDefinitions !== 'string') {
        data.fieldDefinitions = JSON.stringify(data.fieldDefinitions);
      }
      const subCategory = await prisma.subCategory.update({ where: { id }, data });
      await logAction('UPDATE', 'SUBCATEGORY', id, `Updated sub-category ${subCategory.name}`);
      return { success: true, data: subCategory };
    } catch (error: any) {
      return { success: false, error: "Failed to update sub-category: " + error.message };
    }
  });

  // [8] Create Asset
  ipcMain.handle('inventory:create-asset', async (_, { subCategoryId, status, properties }: { subCategoryId: string, status: string, properties: any }) => {
    try {
      const asset = await prisma.asset.create({
        data: {
          subCategoryId,
          status,
          properties: JSON.stringify(properties)
        }
      });
      const name = properties['name'] || properties['Name'] || 'Asset';
      await logAction('CREATE', 'ASSET', asset.id, `Created asset: ${name}`);
      return { success: true, data: asset };
    } catch (error: any) {
      return { success: false, error: "Failed to create asset: " + error.message };
    }
  });

  // [9] Update Asset
  ipcMain.handle('inventory:update-asset', async (_, { id, status, properties }: { id: string, status: string, properties: any }) => {
    try {
      const asset = await prisma.asset.update({
        where: { id },
        data: {
          status,
          properties: JSON.stringify(properties) 
        }
      });
      const name = properties['name'] || properties['Name'] || id;
      await logAction('UPDATE', 'ASSET', id, `Updated asset: ${name} (${status})`);
      return { success: true, data: asset };
    } catch (error: any) {
      return { success: false, error: "Failed to update asset: " + error.message };
    }
  });

  // [10] Import Inventory Excel
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

  // [11] Export Inventory Excel
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

  // ==========================================
  // 3. PURCHASE ORDER HANDLERS
  // ==========================================

  // [12] Get All POs
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

  // [13] Create PO
  ipcMain.handle('purchase:create', async (_, poData: any) => {
    try {
      // Destructure to handle fields
      const { lineItems, vendorName, gstin, ...header } = poData;

      const newPO = await prisma.purchaseOrder.create({
        data: {
          ...header,
          vendorNameSnap: vendorName, // Map UI field to DB field
          gstin: gstin,               // Map UI field to DB field
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
      console.error("Create PO Error:", error);
      return { success: false, error: "Failed to create PO: " + error.message };
    }
  });

  // [14] Delete PO
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

  // [15] Get Single PO
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

  // [16] Receive Items (GRN) - BULK INSERT LOGIC
  ipcMain.handle('purchase:receive-items', async (_, payload: { 
    poId: string, 
    items: Array<{ lineItemId: string, quantity: number, categoryId: string, subCategoryId: string, serials: string[] }> 
  }) => {
    try {
      // 20 Second timeout for large batches
      await prisma.$transaction(async (tx: any) => {
        let itemsReceivedCount = 0;
        
        for (const item of payload.items) {
          // Validation
          if (!item.subCategoryId || item.subCategoryId === '') {
             throw new Error(`Sub-Category selection is missing for item (Line ID: ${item.lineItemId}).`);
          }

          // A. Update Received Qty in PO Line Item
          await tx.lineItem.update({
            where: { id: item.lineItemId },
            data: { receivedQty: { increment: item.quantity } }
          });

          // B. Fetch Line Item details for Asset Name
          const lineItem = await tx.lineItem.findUnique({ where: { id: item.lineItemId } });
          const productName = lineItem?.productName || "Received Asset";

          // C. Prepare Bulk Data for Asset Creation
          const assetsData = item.serials.map(serial => {
            const propertiesObj = {
                Name: productName,
                "Serial No": serial || "Unknown",
                "PO Ref": payload.poId
            };
            
            return {
                subCategoryId: item.subCategoryId,
                properties: JSON.stringify(propertiesObj),
                status: "ACTIVE",
                purchaseOrderId: payload.poId
            };
          });

          // D. Bulk Insert (Performance Optimization)
          if (assetsData.length > 0) {
            await tx.asset.createMany({
                data: assetsData
            });
            itemsReceivedCount += assetsData.length;
          }
        }

        // E. Update PO Status
        const po = await tx.purchaseOrder.findUnique({
          where: { id: payload.poId },
          include: { lineItems: true }
        });

        if (po) {
          const allReceived = po.lineItems.every((li: any) => li.receivedQty >= li.quantity);
          const newStatus = allReceived ? "COMPLETED" : "PARTIAL";
          await tx.purchaseOrder.update({ where: { id: payload.poId }, data: { status: newStatus } });
          
          // Use 'tx' for logging to avoid deadlock/socket timeout
          await logAction('RECEIVE', 'PO', payload.poId, `Received ${itemsReceivedCount} items. Status: ${newStatus}`, tx);
        }
      }, {
        timeout: 20000 
      });

      return { success: true };
    } catch (error: any) {
      console.error("Receive Items Error:", error);
      return { success: false, error: "Failed to receive items: " + error.message };
    }
  });

  // [17] Import POs from Excel
  ipcMain.handle('purchase:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false, error: "No file selected" };

    try {
      const importResult = await importPurchaseOrders(result.filePaths[0]);
      await logAction('IMPORT', 'PO', null, `Imported ${importResult.count} POs from Excel.`);
      return importResult;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // [18] Parse PDF PO
  ipcMain.handle('purchase:parse-pdf', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false, error: "No file selected" };

    try {
      const parsedData = await parsePurchaseOrderPDF(result.filePaths[0]);
      return parsedData;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 4. MAINTENANCE HANDLERS
  // ==========================================

  // [19] Create Maintenance Record
  ipcMain.handle('maintenance:create', async (_, data: any) => {
    try {
      const record = await prisma.maintenanceRecord.create({
        data: {
          assetId: data.assetId,
          issueType: data.issueType,
          description: data.description,
          cost: parseFloat(data.cost) || 0,
          status: "OPEN",
          reportedBy: "Admin"
        }
      });
      // Auto-set status
      await prisma.asset.update({ where: { id: data.assetId }, data: { status: "MAINTENANCE" } });
      await logAction('MAINTENANCE', 'ASSET', data.assetId, `Reported issue: ${data.issueType}`);
      return { success: true, data: record };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // [20] Get All Maintenance Records
  ipcMain.handle('maintenance:get-all', async () => {
    try {
      const records = await prisma.maintenanceRecord.findMany({
        orderBy: { createdAt: 'desc' },
        include: { asset: { include: { subCategory: { include: { category: true } } } } }
      });
      return { success: true, data: records };
    } catch (e) {
      return { success: false, error: "Failed to fetch maintenance records" };
    }
  });

  // [21] Resolve Maintenance Record
  ipcMain.handle('maintenance:resolve', async (_, { id, cost }: { id: string, cost: number }) => {
    try {
      const record = await prisma.maintenanceRecord.update({
        where: { id },
        data: { status: "CLOSED", resolvedDate: new Date(), cost: cost || 0 }
      });
      // Restore asset status
      await prisma.asset.update({ where: { id: record.assetId }, data: { status: "ACTIVE" } });
      await logAction('MAINTENANCE', 'ASSET', record.assetId, `Resolved issue: ${record.issueType}. Cost: ${cost}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // ==========================================
  // 5. SYSTEM HANDLERS
  // ==========================================

  // [22] Get Audit Logs
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

  // [23] Backup Database
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