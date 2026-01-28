"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandlers = registerHandlers;
const electron_1 = require("electron");
const db_1 = require("./db");
const excel_1 = require("./services/excel");
const pdf_1 = require("./services/pdf");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// --- HELPER: Audit Logging ---
// Records actions to the database for security and tracking
// UPDATED: Accepts optional 'tx' to support logging inside transactions
async function logAction(action, entityType, entityId, details, tx) {
    try {
        const db = tx || db_1.prisma; // Use transaction client if provided, else global client
        await db.auditLog.create({
            data: { action, entityType, entityId, details }
        });
    }
    catch (e) {
        console.error("Failed to write audit log:", e);
    }
}
function registerHandlers() {
    // ==========================================
    // 1. DASHBOARD HANDLERS
    // ==========================================
    electron_1.ipcMain.handle('dashboard:get-stats', async () => {
        try {
            const [assetCount, poCount, categoryCount] = await Promise.all([
                db_1.prisma.asset.count(),
                db_1.prisma.purchaseOrder.count(),
                db_1.prisma.category.count()
            ]);
            return { success: true, data: { assetCount, poCount, categoryCount } };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch stats" };
        }
    });
    // ==========================================
    // 2. INVENTORY HANDLERS
    // ==========================================
    // Get Categories tree
    electron_1.ipcMain.handle('inventory:get-categories', async () => {
        try {
            const categories = await db_1.prisma.category.findMany({
                orderBy: { name: 'asc' },
                include: { subCategories: true }
            });
            return { success: true, data: categories };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch categories" };
        }
    });
    // Get Assets (Filtered)
    electron_1.ipcMain.handle('inventory:get-assets', async (_, categoryId) => {
        try {
            const whereClause = categoryId ? { subCategory: { categoryId: categoryId } } : {};
            const assets = await db_1.prisma.asset.findMany({
                where: whereClause,
                include: { subCategory: { include: { category: true } } },
                orderBy: { updatedAt: 'desc' },
                take: 100 // Limit for performance
            });
            return { success: true, data: assets };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch assets" };
        }
    });
    // Create Category
    electron_1.ipcMain.handle('inventory:create-category', async (_, data) => {
        try {
            const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const category = await db_1.prisma.category.create({ data: { ...data, slug } });
            await logAction('CREATE', 'CATEGORY', category.id, `Created category: ${data.name}`);
            return { success: true, data: category };
        }
        catch (error) {
            return { success: false, error: "Failed to create category." };
        }
    });
    // Update Category
    electron_1.ipcMain.handle('inventory:update-category', async (_, { id, data }) => {
        try {
            if (data.name)
                data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const category = await db_1.prisma.category.update({ where: { id }, data });
            await logAction('UPDATE', 'CATEGORY', id, `Updated category: ${category.name}`);
            return { success: true, data: category };
        }
        catch (error) {
            return { success: false, error: "Failed to update category" };
        }
    });
    // Create Sub-Category
    electron_1.ipcMain.handle('inventory:create-subcategory', async (_, { categoryId, name }) => {
        try {
            const category = await db_1.prisma.category.findUnique({ where: { id: categoryId } });
            if (!category)
                return { success: false, error: "Category not found" };
            const slug = (category.slug + '-' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const subCategory = await db_1.prisma.subCategory.create({
                data: { name, slug, categoryId }
            });
            await logAction('CREATE', 'SUBCATEGORY', subCategory.id, `Created sub-category: ${name} in ${category.name}`);
            return { success: true, data: subCategory };
        }
        catch (error) {
            return { success: false, error: "Failed to create sub-category: " + error.message };
        }
    });
    // Update Sub-Category (Field Definitions)
    electron_1.ipcMain.handle('inventory:update-subcategory', async (_, { id, data }) => {
        try {
            if (data.fieldDefinitions && typeof data.fieldDefinitions !== 'string') {
                data.fieldDefinitions = JSON.stringify(data.fieldDefinitions);
            }
            const subCategory = await db_1.prisma.subCategory.update({ where: { id }, data });
            await logAction('UPDATE', 'SUBCATEGORY', id, `Updated sub-category ${subCategory.name}`);
            return { success: true, data: subCategory };
        }
        catch (error) {
            return { success: false, error: "Failed to update sub-category: " + error.message };
        }
    });
    // Create Asset
    electron_1.ipcMain.handle('inventory:create-asset', async (_, { subCategoryId, status, properties }) => {
        try {
            const asset = await db_1.prisma.asset.create({
                data: {
                    subCategoryId,
                    status,
                    properties: JSON.stringify(properties)
                }
            });
            const name = properties['name'] || properties['Name'] || 'Asset';
            await logAction('CREATE', 'ASSET', asset.id, `Created asset: ${name}`);
            return { success: true, data: asset };
        }
        catch (error) {
            return { success: false, error: "Failed to create asset: " + error.message };
        }
    });
    // Update Asset
    electron_1.ipcMain.handle('inventory:update-asset', async (_, { id, status, properties }) => {
        try {
            const asset = await db_1.prisma.asset.update({
                where: { id },
                data: {
                    status,
                    properties: JSON.stringify(properties)
                }
            });
            const name = properties['name'] || properties['Name'] || id;
            await logAction('UPDATE', 'ASSET', id, `Updated asset: ${name} (${status})`);
            return { success: true, data: asset };
        }
        catch (error) {
            return { success: false, error: "Failed to update asset: " + error.message };
        }
    });
    // Import Inventory Excel
    electron_1.ipcMain.handle('inventory:import-excel', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });
        if (result.canceled || result.filePaths.length === 0)
            return { success: false, error: "No file selected" };
        try {
            const importResult = await (0, excel_1.importExcelData)(result.filePaths[0]);
            await logAction('IMPORT', 'SYSTEM', null, `Imported Excel. Success: ${importResult.report?.success}`);
            return importResult;
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Export Inventory Excel
    electron_1.ipcMain.handle('inventory:export-excel', async () => {
        const result = await electron_1.dialog.showSaveDialog({
            title: 'Export Inventory Report',
            defaultPath: `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });
        if (result.canceled || !result.filePath)
            return { success: false, error: "Export cancelled" };
        try {
            await (0, excel_1.exportExcelData)(result.filePath);
            await logAction('EXPORT', 'SYSTEM', null, `Exported inventory to ${path_1.default.basename(result.filePath)}`);
            return { success: true, filePath: result.filePath };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ==========================================
    // 3. PURCHASE ORDER HANDLERS
    // ==========================================
    // Get All POs
    electron_1.ipcMain.handle('purchase:get-all', async () => {
        try {
            const pos = await db_1.prisma.purchaseOrder.findMany({
                orderBy: { date: 'desc' },
                include: { lineItems: true }
            });
            return { success: true, data: pos };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch POs" };
        }
    });
    // Create PO
    electron_1.ipcMain.handle('purchase:create', async (_, poData) => {
        try {
            // Destructure to handle fields not directly in schema top-level
            const { lineItems, vendorName, gstin, ...header } = poData;
            const newPO = await db_1.prisma.purchaseOrder.create({
                data: {
                    ...header,
                    vendorNameSnap: vendorName, // Map UI field to DB field
                    gstin: gstin, // Map UI field to DB field
                    date: new Date(header.date),
                    lineItems: {
                        create: lineItems.map((item) => ({
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
        }
        catch (error) {
            console.error("Create PO Error:", error);
            return { success: false, error: "Failed to create PO: " + error.message };
        }
    });
    // Delete PO
    electron_1.ipcMain.handle('purchase:delete', async (_, id) => {
        try {
            const po = await db_1.prisma.purchaseOrder.findUnique({ where: { id } });
            await db_1.prisma.purchaseOrder.delete({ where: { id } });
            await logAction('DELETE', 'PO', id, `Deleted PO ${po?.poNumber}`);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: "Failed to delete PO" };
        }
    });
    // Get Single PO
    electron_1.ipcMain.handle('purchase:get-one', async (_, id) => {
        try {
            const po = await db_1.prisma.purchaseOrder.findUnique({
                where: { id },
                include: { lineItems: true }
            });
            return { success: true, data: po };
        }
        catch (error) {
            return { success: false, error: "PO not found" };
        }
    });
    // Receive Items (GRN Logic)
    electron_1.ipcMain.handle('purchase:receive-items', async (_, payload) => {
        try {
            // 1. Set Timeout to 20 seconds for large batches
            await db_1.prisma.$transaction(async (tx) => {
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
                    const allReceived = po.lineItems.every((li) => li.receivedQty >= li.quantity);
                    const newStatus = allReceived ? "COMPLETED" : "PARTIAL";
                    await tx.purchaseOrder.update({ where: { id: payload.poId }, data: { status: newStatus } });
                    // FIXED: Pass the 'tx' object to logAction to avoid Socket Timeout (deadlock)
                    await logAction('RECEIVE', 'PO', payload.poId, `Received ${itemsReceivedCount} items. Status: ${newStatus}`, tx);
                }
            }, {
                timeout: 20000 // 20 Seconds Timeout
            });
            return { success: true };
        }
        catch (error) {
            console.error("Receive Items Error:", error);
            return { success: false, error: "Failed to receive items: " + error.message };
        }
    });
    // Import POs from Excel
    electron_1.ipcMain.handle('purchase:import', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });
        if (result.canceled || result.filePaths.length === 0)
            return { success: false, error: "No file selected" };
        try {
            const importResult = await (0, excel_1.importPurchaseOrders)(result.filePaths[0]);
            await logAction('IMPORT', 'PO', null, `Imported ${importResult.count} POs from Excel.`);
            return importResult;
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Parse PDF PO
    electron_1.ipcMain.handle('purchase:parse-pdf', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });
        if (result.canceled || result.filePaths.length === 0)
            return { success: false, error: "No file selected" };
        try {
            const parsedData = await (0, pdf_1.parsePurchaseOrderPDF)(result.filePaths[0]);
            return parsedData;
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ==========================================
    // 4. SYSTEM HANDLERS
    // ==========================================
    electron_1.ipcMain.handle('system:get-audit-logs', async () => {
        try {
            const logs = await db_1.prisma.auditLog.findMany({
                orderBy: { timestamp: 'desc' },
                take: 200
            });
            return { success: true, data: logs };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch logs" };
        }
    });
    electron_1.ipcMain.handle('system:backup', async () => {
        const result = await electron_1.dialog.showSaveDialog({
            title: 'Backup Database',
            defaultPath: `IT_Assets_Backup_${new Date().toISOString().split('T')[0]}.db`,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });
        if (result.canceled || !result.filePath)
            return { success: false };
        try {
            const dbPath = path_1.default.join(process.cwd(), 'prisma/dev.db');
            fs_1.default.copyFileSync(dbPath, result.filePath);
            await logAction('BACKUP', 'SYSTEM', null, 'Database backup created manually');
            return { success: true, filePath: result.filePath };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    console.log('✅ IPC Handlers Registered');
}
