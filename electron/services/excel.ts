import ExcelJS from 'exceljs';
import { prisma } from '../db';

// ... existing importExcelData function ...
// KEEP the previous importExcelData function here! 
// Just ADD this new function below it.

export async function importExcelData(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1); // Read first sheet
  if (!worksheet) return { success: false, error: "Excel file is empty or has no sheets." };

  // 1. Scan Headers (Row 1)
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.text?.toString().trim().toLowerCase() || '';
  });

  // Validate required headers
  // We need at least "Category" and "Name" (or "Model") to know what we are saving.
  const catIndex = headers.indexOf('category');
  const nameIndex = headers.indexOf('name'); // or 'product', 'item'
  
  if (catIndex === -1) {
    return { success: false, error: "Missing required column: 'Category'. Please check the Excel file." };
  }

  const report = {
    total: 0,
    success: 0,
    errors: [] as string[]
  };

  // 2. Iterate Rows (Starting from Row 2)
  // We use a transaction to ensure database integrity is slightly faster, 
  // but for "robustness" we will process row-by-row so one bad row doesn't kill the batch.
  
  const rows = worksheet.getRows(2, worksheet.rowCount) || [];

  for (const row of rows) {
    if (!row.hasValues) continue; // Skip empty rows

    try {
      report.total++;
      
      // A. Extract Core Data
      // cell indices in ExcelJS are 1-based, but our header array is 1-based mapped manually above
      const categoryName = row.getCell(catIndex).text?.toString().trim();
      const assetName = nameIndex !== -1 ? row.getCell(nameIndex).text?.toString().trim() : "Unknown Asset";
      
      if (!categoryName) {
        report.errors.push(`Row ${row.number}: Missing Category`);
        continue;
      }

      // B. Find or Create Category
      // We check if the category exists. If not, we skip (Strict Mode) or Create (Flexible Mode).
      // Let's use Flexible Mode: Create category if missing.
      let category = await prisma.category.findFirst({ where: { name: categoryName } });
      
      if (!category) {
        const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        category = await prisma.category.create({ data: { name: categoryName, slug } });
      }

      // C. Handle SubCategory (Optional Column)
      let subCategoryId = "";
      const subCatIndex = headers.indexOf('subcategory');
      const subCatName = subCatIndex !== -1 ? row.getCell(subCatIndex).text?.toString().trim() : "General";
      
      const subCatSlug = (category.slug + '-' + subCatName).toLowerCase().replace(/[^a-z0-9]+/g, '-');

      let subCategory = await prisma.subCategory.findFirst({
        where: { categoryId: category.id, slug: subCatSlug }
      });

      if (!subCategory) {
        subCategory = await prisma.subCategory.create({
          data: {
            name: subCatName,
            slug: subCatSlug,
            categoryId: category.id
          }
        });
      }
      subCategoryId = subCategory.id;

      // D. Extract Dynamic Properties
      // Any column that isn't Category/SubCategory/Name gets saved into JSON
      const properties: any = {};
      headers.forEach((header, index) => {
        if (!header) return;
        if (['category', 'subcategory'].includes(header)) return;
        
        // Save the value
        const val = row.getCell(index).value;
        if (val) properties[header] = val.toString();
      });

      // E. Save the Asset
      await prisma.asset.create({
        data: {
          subCategoryId: subCategoryId,
          properties: JSON.stringify(properties),
          status: "ACTIVE"
        }
      });

      report.success++;

    } catch (err: any) {
      console.error(`Row ${row.number} Error:`, err);
      report.errors.push(`Row ${row.number}: ${err.message}`);
    }
  }

  return { success: true, report };
}

export async function exportExcelData(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IT Asset Manager';
  workbook.created = new Date();

  // 1. Fetch ALL Data
  // Explicitly type asset as any to resolve implicit any error
  const assets: any[] = await prisma.asset.findMany({
    include: { subCategory: { include: { category: true } } }
  });

  // --- SHEET 1: EXECUTIVE SUMMARY ---
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

  // Stats Calculation
  const categoryCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  assets.forEach((asset: any) => {
    const cat = asset.subCategory?.category?.name || 'Unknown';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    statusCounts[asset.status] = (statusCounts[asset.status] || 0) + 1;
  });

  // Write Category Table
  summarySheet.getCell('A3').value = "Asset Breakdown by Category";
  summarySheet.getCell('A3').font = { bold: true, size: 12 };
  
  summarySheet.getCell('A4').value = "Category";
  summarySheet.getCell('B4').value = "Count";
  summarySheet.getRow(4).font = { bold: true };
  summarySheet.getRow(4).border = { bottom: { style: 'thin' } };

  let rowIdx = 5;
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    summarySheet.getCell(`A${rowIdx}`).value = cat;
    summarySheet.getCell(`B${rowIdx}`).value = count;
    rowIdx++;
  });

  // Write Status Table
  summarySheet.getCell('D3').value = "Asset Status Overview";
  summarySheet.getCell('D3').font = { bold: true, size: 12 };

  summarySheet.getCell('D4').value = "Status";
  summarySheet.getCell('E4').value = "Count";
  
  rowIdx = 5;
  Object.entries(statusCounts).forEach(([status, count]) => {
    summarySheet.getCell(`D${rowIdx}`).value = status;
    summarySheet.getCell(`E${rowIdx}`).value = count;
    rowIdx++;
  });

  // --- SHEET 2: RAW DATA ---
  const dataSheet = workbook.addWorksheet('All Assets');
  
  // Identify all dynamic keys across all assets
  const dynamicKeys = new Set<string>();
  assets.forEach((asset: any) => {
    try {
      const props = JSON.parse(asset.properties);
      Object.keys(props).forEach(k => dynamicKeys.add(k));
    } catch(e) {}
  });

  // Sort keys for consistency (put Name/Serial first if they exist)
  const sortedKeys = Array.from(dynamicKeys).sort((a, b) => {
    const priority = ['name', 'serial', 'serial no', 'model'];
    const ia = priority.indexOf(a.toLowerCase());
    const ib = priority.indexOf(b.toLowerCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  // Setup Columns
  const columns = [
    { header: 'Asset ID', key: 'id', width: 25 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'SubCategory', key: 'subcategory', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Last Updated', key: 'updated', width: 15 },
    ...sortedKeys.map(k => ({ header: k.toUpperCase(), key: k, width: 20 }))
  ];

  dataSheet.columns = columns;

  // Style Header Row
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; // Slate 600

  // Add Rows
  assets.forEach((asset: any) => {
    let props = {};
    try { props = JSON.parse(asset.properties); } catch(e) {}
    
    const rowData: any = {
      id: asset.id,
      category: asset.subCategory?.category?.name,
      subcategory: asset.subCategory?.name,
      status: asset.status,
      updated: asset.updatedAt.toISOString().split('T')[0],
      ...props // Spread dynamic properties
    };
    dataSheet.addRow(rowData);
  });

  // Add AutoFilter
  dataSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length }
  };

  await workbook.xlsx.writeFile(filePath);
  return { success: true };
}

// --- NEW: IMPORT PURCHASE ORDERS ---
export async function importPurchaseOrders(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) return { success: false, error: "Excel file empty" };

  // 1. Map Headers
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, col) => {
    headers[col] = cell.text?.toString().trim().toLowerCase() || '';
  });

  // Required: PO Number, Date, Vendor, Product, Qty, Price
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
  const groupedPOs: Record<string, any> = {};
  const rows = worksheet.getRows(2, worksheet.rowCount) || [];

  for (const row of rows) {
    if (!row.hasValues) continue;
    
    const poNumber = row.getCell(poIdx).text?.toString().trim();
    if (!poNumber) continue;

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
    const total = (qty * price) + ((qty * price) * (gst/100));

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
    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber: poData.poNumber } });
    if (existing) continue; // Skip duplicates

    // Calculate Total
    const grandTotal = poData.lineItems.reduce((acc: number, item: any) => acc + item.totalAmount, 0);

    await prisma.purchaseOrder.create({
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