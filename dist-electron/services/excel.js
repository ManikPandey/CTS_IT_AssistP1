"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importExcelData = importExcelData;
exports.exportExcelData = exportExcelData;
exports.importPurchaseOrders = importPurchaseOrders;
const exceljs_1 = __importDefault(require("exceljs"));
const db_1 = require("../db");
// --- 1. IMPORT INVENTORY ASSETS ---
async function importExcelData(filePath) {
    const workbook = new exceljs_1.default.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1); // Read first sheet
    if (!worksheet)
        return { success: false, error: "Excel file is empty or has no sheets." };
    // Scan Headers (Row 1)
    const headers = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text?.toString().trim().toLowerCase() || '';
    });
    // Validate required headers
    const catIndex = headers.indexOf('category');
    if (catIndex === -1) {
        return { success: false, error: "Missing required column: 'Category'. Please check the Excel file." };
    }
    const report = {
        total: 0,
        success: 0,
        errors: []
    };
    // Iterate Rows (Starting from Row 2)
    const rows = worksheet.getRows(2, worksheet.rowCount) || [];
    for (const row of rows) {
        if (!row.hasValues)
            continue; // Skip empty rows
        try {
            report.total++;
            // A. Extract Core Data
            const categoryName = row.getCell(catIndex).text?.toString().trim();
            if (!categoryName) {
                report.errors.push(`Row ${row.number}: Missing Category`);
                continue;
            }
            // B. Find or Create Category
            let category = await db_1.prisma.category.findFirst({ where: { name: categoryName } });
            if (!category) {
                const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                category = await db_1.prisma.category.create({ data: { name: categoryName, slug } });
            }
            // C. Find or Create SubCategory
            let subCategoryId = "";
            const subCatIndex = headers.indexOf('subcategory');
            const subCatName = subCatIndex !== -1 ? row.getCell(subCatIndex).text?.toString().trim() : "General";
            const subCatSlug = (category.slug + '-' + subCatName).toLowerCase().replace(/[^a-z0-9]+/g, '-');
            let subCategory = await db_1.prisma.subCategory.findFirst({
                where: { categoryId: category.id, slug: subCatSlug }
            });
            if (!subCategory) {
                subCategory = await db_1.prisma.subCategory.create({
                    data: {
                        name: subCatName,
                        slug: subCatSlug,
                        categoryId: category.id
                    }
                });
            }
            subCategoryId = subCategory.id;
            // D. Extract Dynamic Properties
            const properties = {};
            headers.forEach((header, index) => {
                if (!header)
                    return;
                if (['category', 'subcategory'].includes(header))
                    return;
                // Save the value
                const val = row.getCell(index).value;
                if (val)
                    properties[header] = val.toString();
            });
            // E. Save the Asset
            await db_1.prisma.asset.create({
                data: {
                    subCategoryId: subCategoryId,
                    properties: JSON.stringify(properties),
                    status: "ACTIVE"
                }
            });
            report.success++;
        }
        catch (err) {
            console.error(`Row ${row.number} Error:`, err);
            report.errors.push(`Row ${row.number}: ${err.message}`);
        }
    }
    return { success: true, report };
}
// --- 2. ADVANCED EXPORT INVENTORY ---
async function exportExcelData(filePath) {
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = 'IT Asset Manager';
    workbook.created = new Date();
    // Fetch all categories with full depth
    const categories = await db_1.prisma.category.findMany({
        include: {
            subCategories: {
                include: {
                    assets: true
                }
            }
        }
    });
    // --- SHEET 1: DASHBOARD SUMMARY ---
    const summarySheet = workbook.addWorksheet('Dashboard', {
        views: [{ showGridLines: false }]
    });
    // Title
    summarySheet.mergeCells('A1:E1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'IT Asset Inventory Report';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 900
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;
    // Calculate Stats
    const categoryCounts = {};
    const allAssetsFlat = [];
    categories.forEach((cat) => {
        let count = 0;
        cat.subCategories.forEach((sub) => {
            count += sub.assets.length;
            // Flatten for the "All Assets" sheet
            sub.assets.forEach((a) => {
                allAssetsFlat.push({
                    ...a,
                    categoryName: cat.name,
                    subCategoryName: sub.name
                });
            });
        });
        categoryCounts[cat.name] = count;
    });
    // Write Summary Table
    let rowIdx = 3;
    summarySheet.getCell(`A${rowIdx}`).value = "Category Summary";
    summarySheet.getCell(`A${rowIdx}`).font = { bold: true, size: 12 };
    rowIdx++;
    summarySheet.getCell(`A${rowIdx}`).value = "Category";
    summarySheet.getCell(`B${rowIdx}`).value = "Total Assets";
    summarySheet.getRow(rowIdx).font = { bold: true };
    summarySheet.getRow(rowIdx).border = { bottom: { style: 'thin' } };
    rowIdx++;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
        summarySheet.getCell(`A${rowIdx}`).value = cat;
        summarySheet.getCell(`B${rowIdx}`).value = count;
        rowIdx++;
    });
    // --- SHEET 2: ALL ASSETS (Master List) ---
    const allSheet = workbook.addWorksheet('All Assets');
    populateSheetWithAssets(allSheet, allAssetsFlat);
    // --- SHEET 3+: PER CATEGORY SHEETS ---
    categories.forEach((cat) => {
        const catAssets = [];
        cat.subCategories.forEach((sub) => {
            sub.assets.forEach((a) => {
                catAssets.push({
                    ...a,
                    categoryName: cat.name,
                    subCategoryName: sub.name
                });
            });
        });
        if (catAssets.length > 0) {
            // Sanitize sheet name (max 31 chars, no special chars)
            const safeName = cat.name.replace(/[\[\]\:\*\?\/\\\']/g, '').substring(0, 30) || "Sheet";
            const catSheet = workbook.addWorksheet(safeName);
            populateSheetWithAssets(catSheet, catAssets);
        }
    });
    await workbook.xlsx.writeFile(filePath);
    return { success: true };
}
// Helper to fill data into a sheet dynamically
function populateSheetWithAssets(sheet, assets) {
    if (assets.length === 0)
        return;
    // 1. Identify all dynamic keys across these assets
    const dynamicKeys = new Set();
    assets.forEach(asset => {
        try {
            const props = JSON.parse(asset.properties);
            Object.keys(props).forEach(k => dynamicKeys.add(k));
        }
        catch (e) { }
    });
    // Sort keys (prioritize Name, Serial, Model)
    const sortedKeys = Array.from(dynamicKeys).sort((a, b) => {
        const priority = ['name', 'serial', 'serial no', 'model'];
        const ia = priority.indexOf(a.toLowerCase());
        const ib = priority.indexOf(b.toLowerCase());
        if (ia !== -1 && ib !== -1)
            return ia - ib;
        if (ia !== -1)
            return -1;
        if (ib !== -1)
            return 1;
        return a.localeCompare(b);
    });
    // 2. Define Headers
    const columns = [
        { header: 'Asset ID', key: 'id', width: 15 },
        { header: 'Category', key: 'categoryName', width: 20 },
        { header: 'SubCategory', key: 'subCategoryName', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Last Updated', key: 'updated', width: 15 },
        ...sortedKeys.map(k => ({ header: k.toUpperCase(), key: k, width: 20 }))
    ];
    sheet.columns = columns;
    // 3. Style Header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    // 4. Add Rows
    assets.forEach(asset => {
        let props = {};
        try {
            props = JSON.parse(asset.properties);
        }
        catch (e) { }
        sheet.addRow({
            id: asset.id.slice(0, 8), // Short ID
            categoryName: asset.categoryName,
            subCategoryName: asset.subCategoryName,
            status: asset.status,
            updated: asset.updatedAt ? new Date(asset.updatedAt).toISOString().split('T')[0] : '',
            ...props
        });
    });
    // 5. Auto Filter
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length }
    };
}
// --- 3. IMPORT PURCHASE ORDERS ---
async function importPurchaseOrders(filePath) {
    const workbook = new exceljs_1.default.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet)
        return { success: false, error: "Excel file empty" };
    // 1. Map Headers
    const headers = [];
    worksheet.getRow(1).eachCell((cell, col) => {
        headers[col] = cell.text?.toString().trim().toLowerCase() || '';
    });
    // Required columns
    const poIdx = headers.indexOf('po number');
    const dateIdx = headers.indexOf('date');
    const vendorIdx = headers.indexOf('vendor');
    const prodIdx = headers.indexOf('product');
    const qtyIdx = headers.indexOf('qty');
    const priceIdx = headers.indexOf('price');
    if (poIdx === -1 || vendorIdx === -1 || prodIdx === -1) {
        return { success: false, error: "Missing columns: 'PO Number', 'Vendor', 'Product' are required." };
    }
    // 2. Group Rows by PO Number
    const groupedPOs = {};
    const rows = worksheet.getRows(2, worksheet.rowCount) || [];
    for (const row of rows) {
        if (!row.hasValues)
            continue;
        const poNumber = row.getCell(poIdx).text?.toString().trim();
        if (!poNumber)
            continue;
        if (!groupedPOs[poNumber]) {
            // Create PO Header
            groupedPOs[poNumber] = {
                poNumber,
                date: row.getCell(dateIdx).value ? new Date(row.getCell(dateIdx).text) : new Date(),
                vendorNameSnap: row.getCell(vendorIdx).text?.toString().trim(),
                gstin: headers.indexOf('gstin') !== -1 ? row.getCell(headers.indexOf('gstin')).text : '',
                status: "ISSUED",
                lineItems: []
            };
        }
        // Add Line Item
        const qty = parseFloat(row.getCell(qtyIdx).text) || 1;
        const price = parseFloat(row.getCell(priceIdx).text) || 0;
        const gst = headers.indexOf('gst') !== -1 ? (parseFloat(row.getCell(headers.indexOf('gst')).text) || 18) : 18;
        const total = (qty * price) + ((qty * price) * (gst / 100));
        groupedPOs[poNumber].lineItems.push({
            srNo: groupedPOs[poNumber].lineItems.length + 1,
            productName: row.getCell(prodIdx).text?.toString().trim(),
            quantity: qty,
            uom: headers.indexOf('uom') !== -1 ? row.getCell(headers.indexOf('uom')).text : 'Nos',
            unitPrice: price,
            gst: gst,
            totalAmount: total
        });
    }
    // 3. Save to DB
    let createdCount = 0;
    for (const poKey in groupedPOs) {
        const poData = groupedPOs[poKey];
        // Check if PO exists
        const existing = await db_1.prisma.purchaseOrder.findUnique({ where: { poNumber: poData.poNumber } });
        if (existing)
            continue; // Skip duplicates
        // Calculate Grand Total
        const grandTotal = poData.lineItems.reduce((acc, item) => acc + item.totalAmount, 0);
        await db_1.prisma.purchaseOrder.create({
            data: {
                poNumber: poData.poNumber,
                date: poData.date,
                vendorNameSnap: poData.vendorNameSnap,
                gstin: poData.gstin,
                totalAmount: grandTotal,
                status: "ISSUED",
                lineItems: {
                    create: poData.lineItems
                }
            }
        });
        createdCount++;
    }
    return { success: true, count: createdCount };
}
