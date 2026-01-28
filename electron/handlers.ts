import { ipcMain, dialog, app } from 'electron';
import { prisma } from './db';
import { importExcelData, exportExcelData, importPurchaseOrders } from './services/excel';
import { parsePurchaseOrderPDF } from './services/pdf';
import fs from 'fs';
import path from 'path';

// --- HELPER: Audit Logging ---
// Records actions to the database for security and tracking
// UPDATED: Accepts optional 'tx' to support logging inside transactions
async function logAction(action: string, entityType: string, entityId: string | null, details: string, tx?: any) {
  try {
    const db = tx || prisma; // Use transaction client if provided, else global client
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

  // ==========================================
  // 2. INVENTORY HANDLERS
  // ==========================================

  // Get Categories tree
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

  // Get Assets (Filtered)
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

  // Create Category
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

  // Update Category
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

  // Create Sub-Category
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

  // Update Sub-Category (Field Definitions)
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

  // Create Asset
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

  // Update Asset
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

  // Import Inventory Excel
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

  // Export Inventory Excel
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

  // Get All POs
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

  // Create PO
  ipcMain.handle('purchase:create', async (_, poData: any) => {
    try {
      // Destructure to handle fields not directly in schema top-level
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

  // Delete PO
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

  // Get Single PO
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

  // Receive Items (GRN Logic)
  ipcMain.handle('purchase:receive-items', async (_, payload: { 
    poId: string, 
    items: Array<{ lineItemId: string, quantity: number, categoryId: string, subCategoryId: string, serials: string[] }> 
  }) => {
    try {
      // 1. Set Timeout to 20 seconds for large batches
      await prisma.$transaction(async (tx: any) => {
        let itemsReceivedCount = 0;
        
        for (const item of payload.items) {
          // Validation
          if (!item.subCategoryId || item.subCategoryId === '') {
             throw new Error(`Sub-Category selection is missing for item (Line ID: ${item.lineItemId}).`);
          }

          // A. Update Received Qty
          await tx.lineItem.update({
            where: { id: item.lineItemId },
            data: { receivedQty: { increment: item.quantity } }
          });

          // B. Fetch Line Item details for Asset Name
          const lineItem = await tx.lineItem.findUnique({ where: { id: item.lineItemId } });
          const productName = lineItem?.productName || "Received Asset";

          // C. PREPARE ASSETS FOR BULK INSERT
          // This creates the array in memory instead of awaiting database calls one by one
          const assetsData = item.serials.map(serial => {
            const propertiesObj = {
                name: productName,
                serial: serial || "Unknown",
                "po_ref": payload.poId
            };
            
            return {
                subCategoryId: item.subCategoryId,
                properties: JSON.stringify(propertiesObj),
                status: "ACTIVE",
                purchaseOrderId: payload.poId
            };
          });

          // D. BULK INSERT (Much Faster)
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
          
          // FIXED: Pass the 'tx' object to logAction to avoid Socket Timeout (deadlock)
          await logAction('RECEIVE', 'PO', payload.poId, `Received ${itemsReceivedCount} items. Status: ${newStatus}`, tx);
        }
      }, {
        timeout: 20000 // 20 Seconds Timeout
      });

      return { success: true };
    } catch (error: any) {
      console.error("Receive Items Error:", error);
      return { success: false, error: "Failed to receive items: " + error.message };
    }
  });

  // Import POs from Excel
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

  // Parse PDF PO
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
  // 4. SYSTEM HANDLERS
  // ==========================================

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