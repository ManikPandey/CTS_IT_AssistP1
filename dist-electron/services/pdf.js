"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePurchaseOrderPDF = parsePurchaseOrderPDF;
const fs_1 = __importDefault(require("fs"));
// Legacy build is safer for Node environments
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
async function parsePurchaseOrderPDF(filePath) {
    console.log(`[PDF] Reading file: ${filePath}`);
    try {
        // Read file as Uint8Array
        const dataBuffer = new Uint8Array(fs_1.default.readFileSync(filePath));
        // Load Document
        const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
        const pdfDocument = await loadingTask.promise;
        let fullText = "";
        // Extract text page by page
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            // Sort items by Y (top->bottom) then X (left->right)
            // This is crucial to keep table columns in order
            const items = textContent.items.sort((a, b) => {
                const yDiff = b.transform[5] - a.transform[5];
                return Math.abs(yDiff) < 5 ? a.transform[4] - b.transform[4] : yDiff;
            });
            let lastY = -1;
            for (const item of items) {
                const y = item.transform[5];
                // If Y changed significantly, add newline
                if (lastY !== -1 && Math.abs(y - lastY) > 5) {
                    fullText += "\n";
                }
                // Add text content
                fullText += item.str;
                lastY = y;
            }
            fullText += "\n";
        }
        console.log(`[PDF] Extracted ${fullText.length} characters.`);
        // --- PARSING LOGIC (Official PO) ---
        const result = {
            poNumber: "",
            date: new Date().toISOString().split('T')[0],
            vendorName: "",
            gstin: "",
            lineItems: [],
            properties: {}
        };
        const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const flattenedText = lines.join(' ');
        // 1. METADATA
        // PO Number
        const poMatch = flattenedText.match(/PO\s*[#\.]?\s*(VIT-B-PO-[\d\.]+)/i);
        if (poMatch)
            result.poNumber = poMatch[1];
        // Vendor ("PO For: ...")
        const vendorMatch = flattenedText.match(/PO\s*For\s*[:\.]?\s*([^,:\n]+)/i);
        if (vendorMatch)
            result.vendorName = vendorMatch[1].trim();
        // GSTIN
        const gstMatch = flattenedText.match(/GSTIN\s*[:\.]*\s*([A-Z0-9]{15})/i);
        if (gstMatch)
            result.gstin = gstMatch[1];
        // Date
        const dateMatch = flattenedText.match(/Date\s*:\s*(\d{1,2}-[A-Za-z]{3}-\d{4})/i);
        if (dateMatch) {
            const d = new Date(dateMatch[1]);
            if (!isNaN(d.getTime()))
                result.date = d.toISOString().split('T')[0];
        }
        // Dynamic Fields
        const reqRef = flattenedText.match(/Request\s*Ref\s*[:\.]?\s*([A-Z0-9\.-]+)/i);
        if (reqRef)
            result.properties['Request Ref'] = reqRef[1];
        const dept = flattenedText.match(/Dept\s*Name\s*[:\.]?\s*([A-Za-z\s]+)/i);
        if (dept)
            result.properties['Dept Name'] = dept[1].trim();
        const approved = flattenedText.match(/Approved\s*By\s*[:\.]?\s*([A-Za-z\s]+)/i);
        if (approved)
            result.properties['Approved By'] = approved[1].trim();
        // 2. LINE ITEMS (Strict CSV Pattern)
        let currentSrNo = 1;
        for (const line of lines) {
            // Regex for CSV row: "1","Name"...
            if (line.match(new RegExp(`^["']?${currentSrNo}["']?,`))) {
                // Split by ","
                const cols = line.split(/",\s*"/);
                if (cols.length >= 4) {
                    // Index 1: Name
                    const name = cols[1]?.replace(/^["']|["']$/g, '').trim();
                    // Index 2: Qty
                    const qty = parseFloat(cols[2]?.replace(/[",]/g, ''));
                    // Index 4: Price
                    const price = parseFloat(cols[4]?.replace(/[",\s₹]/g, ''));
                    if (!isNaN(qty)) {
                        result.lineItems.push({
                            srNo: currentSrNo,
                            productName: name || "Item",
                            quantity: qty,
                            uom: cols[3]?.replace(/["']/g, '') || "Nos",
                            unitPrice: isNaN(price) ? 0 : price,
                            gst: 18,
                            totalAmount: (qty * (isNaN(price) ? 0 : price)) * 1.18
                        });
                        currentSrNo++;
                    }
                }
            }
        }
        return { success: true, data: result };
    }
    catch (error) {
        console.error("[PDF] Error:", error);
        return { success: false, error: "Scan Failed: " + error.message };
    }
}
