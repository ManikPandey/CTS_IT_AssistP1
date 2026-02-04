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
const crypto_1 = __importDefault(require("crypto"));
// --- HELPER: Password Hashing ---
function hashPassword(password) {
    return crypto_1.default.createHash('sha256').update(password).digest('hex');
}
// --- HELPER: Audit Logging ---
// Records actions to the database. Accepts optional 'tx' to log inside a transaction safely.
async function logAction(action, entityType, entityId, details, tx) {
    try {
        const db = tx || db_1.prisma;
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
    // 1. AUTHENTICATION HANDLERS
    // ==========================================
    // Check if any user exists (to trigger First Run setup)
    electron_1.ipcMain.handle('auth:check-init', async () => {
        const count = await db_1.prisma.user.count();
        return { initialized: count > 0 };
    });
    // Login
    electron_1.ipcMain.handle('auth:login', async (_, { username, password }) => {
        try {
            const user = await db_1.prisma.user.findUnique({ where: { username } });
            if (!user)
                return { success: false, error: "User not found" };
            const hashed = hashPassword(password);
            if (user.password !== hashed)
                return { success: false, error: "Invalid password" };
            await logAction('LOGIN', 'USER', user.id, `User ${user.username} logged in`);
            return {
                success: true,
                user: { id: user.id, username: user.username, name: user.name, role: user.role }
            };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // Register / Create User
    electron_1.ipcMain.handle('auth:register', async (_, data) => {
        try {
            const existing = await db_1.prisma.user.findUnique({ where: { username: data.username } });
            if (existing)
                return { success: false, error: "Username already exists" };
            const user = await db_1.prisma.user.create({
                data: {
                    username: data.username,
                    password: hashPassword(data.password),
                    name: data.name,
                    role: data.role || 'USER'
                }
            });
            await logAction('CREATE', 'USER', user.id, `Created user ${user.username} as ${user.role}`);
            return { success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // Get Users List (For Admin Settings)
    electron_1.ipcMain.handle('auth:get-users', async () => {
        try {
            const users = await db_1.prisma.user.findMany({
                select: { id: true, username: true, name: true, role: true, createdAt: true }
            });
            return { success: true, data: users };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch users" };
        }
    });
    electron_1.ipcMain.handle('auth:change-password', async (_, { userId, newPassword }) => {
        try {
            await db_1.prisma.user.update({
                where: { id: userId },
                data: { password: hashPassword(newPassword) }
            });
            await logAction('UPDATE', 'USER', userId, `Password reset for user ID ${userId}`);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ==========================================
    // 2. DASHBOARD HANDLERS
    // ==========================================
    electron_1.ipcMain.handle('dashboard:get-stats', async () => {
        try {
            const [assetCount, poCount, categoryCount, maintenanceCount] = await Promise.all([
                db_1.prisma.asset.count(),
                db_1.prisma.purchaseOrder.count(),
                db_1.prisma.category.count(),
                db_1.prisma.maintenanceRecord.count({ where: { status: { not: 'CLOSED' } } })
            ]);
            // UPDATED: Stock Analysis
            const inStock = await db_1.prisma.asset.count({ where: { status: 'IN_STOCK' } });
            const outStock = await db_1.prisma.asset.count({ where: { status: 'OUT_STOCK' } });
            const statusGroups = await db_1.prisma.asset.groupBy({ by: ['status'], _count: { status: true } });
            const assetsByStatus = statusGroups.map((g) => ({ name: g.status, value: g._count.status }));
            const categories = await db_1.prisma.category.findMany({ include: { subCategories: { include: { _count: { select: { assets: true } } } } } });
            const assetsByCategory = categories.map((cat) => ({ name: cat.name, value: cat.subCategories.reduce((acc, sub) => acc + sub._count.assets, 0) })).filter((c) => c.value > 0);
            const allPOs = await db_1.prisma.purchaseOrder.findMany({ select: { date: true, totalAmount: true } });
            const costMap = {};
            allPOs.forEach((po) => { const month = new Date(po.date).toLocaleString('default', { month: 'short', year: '2-digit' }); costMap[month] = (costMap[month] || 0) + po.totalAmount; });
            const costByMonth = Object.entries(costMap).map(([name, value]) => ({ name, value }));
            return {
                success: true,
                data: {
                    assetCount, poCount, categoryCount, maintenanceCount,
                    inStock, outStock, // NEW
                    assetsByStatus, assetsByCategory, costByMonth
                }
            };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch stats" };
        }
    });
    // ==========================================
    // 3. INVENTORY HANDLERS
    // ==========================================
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
    electron_1.ipcMain.handle('inventory:get-assets', async (_, categoryId) => {
        try {
            const whereClause = categoryId ? { subCategory: { categoryId: categoryId } } : {};
            const assets = await db_1.prisma.asset.findMany({
                where: whereClause,
                include: { subCategory: { include: { category: true } } },
                orderBy: { updatedAt: 'desc' },
                take: 100
            });
            return { success: true, data: assets };
        }
        catch (error) {
            return { success: false, error: "Failed to fetch assets" };
        }
    });
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
    // 4. PURCHASE ORDER HANDLERS
    // ==========================================
    electron_1.ipcMain.handle('purchase:get-all', async (_, { search, sort, status } = {}) => {
        try {
            const whereClause = {};
            // 1. Search Logic (Checks both PO Number and Vendor Name)
            if (search && search.trim() !== '') {
                whereClause.OR = [
                    { poNumber: { contains: search } },
                    { vendorNameSnap: { contains: search } }
                ];
            }
            // 2. Filter Logic (Status)
            if (status && status !== 'ALL') {
                whereClause.status = status;
            }
            // 3. Sort Logic (Date)
            const sortDir = sort === 'oldest' ? 'asc' : 'desc';
            const pos = await db_1.prisma.purchaseOrder.findMany({
                where: whereClause,
                orderBy: { date: sortDir },
                include: { lineItems: true }
            });
            return { success: true, data: pos };
        }
        catch (error) {
            console.error("Fetch PO Error:", error);
            return { success: false, error: "Failed to fetch POs" };
        }
    });
    electron_1.ipcMain.handle('purchase:create', async (_, poData) => {
        try {
            const { lineItems, vendorName, gstin, properties, ...header } = poData; // Extract 'properties'
            const newPO = await db_1.prisma.purchaseOrder.create({
                data: {
                    ...header,
                    vendorNameSnap: vendorName,
                    gstin: gstin,
                    properties: JSON.stringify(properties || {}), // Store as JSON
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
            await logAction('CREATE', 'PO', newPO.id, `Created PO ${newPO.poNumber}`);
            return { success: true, data: newPO };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
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
    electron_1.ipcMain.handle('purchase:receive-items', async (_, payload) => {
        try {
            // Set Timeout to 20 seconds for large batches
            await db_1.prisma.$transaction(async (tx) => {
                let itemsReceivedCount = 0;
                for (const item of payload.items) {
                    if (!item.subCategoryId || item.subCategoryId === '') {
                        throw new Error(`Sub-Category selection is missing for item (Line ID: ${item.lineItemId}).`);
                    }
                    // A. Update Received Qty
                    await tx.lineItem.update({
                        where: { id: item.lineItemId },
                        data: { receivedQty: { increment: item.quantity } }
                    });
                    // B. Fetch Line Item details
                    const lineItem = await tx.lineItem.findUnique({ where: { id: item.lineItemId } });
                    const productName = lineItem?.productName || "Received Asset";
                    // C. Prepare Bulk Data
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
                    // D. Bulk Insert
                    if (assetsData.length > 0) {
                        await tx.asset.createMany({ data: assetsData });
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
                    // Pass 'tx' to logAction to avoid deadlock
                    await logAction('RECEIVE', 'PO', payload.poId, `Received ${itemsReceivedCount} items. Status: ${newStatus}`, tx);
                }
            }, {
                timeout: 20000
            });
            return { success: true };
        }
        catch (error) {
            console.error("Receive Items Error:", error);
            return { success: false, error: "Failed to receive items: " + error.message };
        }
    });
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
    // 5. MAINTENANCE HANDLERS
    // ==========================================
    // Create Maintenance Record
    electron_1.ipcMain.handle('maintenance:create', async (_, data) => {
        try {
            const record = await db_1.prisma.maintenanceRecord.create({
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
            await db_1.prisma.asset.update({ where: { id: data.assetId }, data: { status: "MAINTENANCE" } });
            await logAction('MAINTENANCE', 'ASSET', data.assetId, `Reported issue: ${data.issueType}`);
            return { success: true, data: record };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // Get All Records
    electron_1.ipcMain.handle('maintenance:get-all', async () => {
        try {
            const records = await db_1.prisma.maintenanceRecord.findMany({
                orderBy: { createdAt: 'desc' },
                include: { asset: { include: { subCategory: { include: { category: true } } } } }
            });
            return { success: true, data: records };
        }
        catch (e) {
            return { success: false, error: "Failed to fetch maintenance records" };
        }
    });
    // Resolve Record
    electron_1.ipcMain.handle('maintenance:resolve', async (_, { id, cost }) => {
        try {
            const record = await db_1.prisma.maintenanceRecord.update({
                where: { id },
                data: { status: "CLOSED", resolvedDate: new Date(), cost: cost || 0 }
            });
            // Restore asset status
            await db_1.prisma.asset.update({ where: { id: record.assetId }, data: { status: "ACTIVE" } });
            await logAction('MAINTENANCE', 'ASSET', record.assetId, `Resolved issue: ${record.issueType}. Cost: ${cost}`);
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // ==========================================
    // 6. SYSTEM HANDLERS
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
    electron_1.ipcMain.handle('system:delete-asset', async (_, id) => {
        try {
            await db_1.prisma.asset.delete({ where: { id } });
            await logAction('DELETE', 'ASSET', id, 'Deleted asset manually');
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('system:delete-subcategory', async (_, id) => {
        try {
            const sub = await db_1.prisma.subCategory.findUnique({ where: { id }, include: { _count: { select: { assets: true } } } });
            if (sub && sub._count.assets > 0)
                return { success: false, error: "Cannot delete: Sub-Category is not empty." };
            await db_1.prisma.subCategory.delete({ where: { id } });
            await logAction('DELETE', 'SUBCATEGORY', id, 'Deleted sub-category');
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('system:delete-category', async (_, id) => {
        try {
            const cat = await db_1.prisma.category.findUnique({ where: { id }, include: { subCategories: true } });
            if (cat && cat.subCategories.length > 0)
                return { success: false, error: "Cannot delete: Category has sub-categories." };
            await db_1.prisma.category.delete({ where: { id } });
            await logAction('DELETE', 'CATEGORY', id, 'Deleted category');
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    console.log('✅ IPC Handlers Registered');
}
