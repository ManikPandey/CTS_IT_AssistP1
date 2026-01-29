"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePurchaseOrderPDF = parsePurchaseOrderPDF;
const fs_1 = __importDefault(require("fs"));
// ==========================================
// 1. POLYFILLS FOR PDF-PARSE / PDF.JS
// ==========================================
// Critical: The underlying pdf.js library expects these Browser APIs to exist.
// We must mock them in the Node.js environment to prevent crashes (ReferenceError: DOMMatrix is not defined).
// @ts-ignore
if (typeof global.DOMMatrix === 'undefined') {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
        constructor() { }
        multiply() { return this; }
        translate() { return this; }
        scale() { return this; }
        transformPoint(p) { return p; }
    };
}
// @ts-ignore
if (typeof global.Path2D === 'undefined') {
    // @ts-ignore
    global.Path2D = class Path2D {
        constructor() { }
    };
}
// @ts-ignore
if (typeof global.ImageData === 'undefined') {
    // @ts-ignore
    global.ImageData = class ImageData {
        width = 0;
        height = 0;
        data = null;
        constructor() { }
    };
}
// @ts-ignore
if (typeof global.document === 'undefined') {
    // @ts-ignore
    global.document = {
        // We cast the function itself to 'any' to bypass argument and return type checks
        createElement: (() => ({
            getContext: () => ({})
        }))
    };
}
// ==========================================
// 2. MAIN PARSING FUNCTION
// ==========================================
async function parsePurchaseOrderPDF(filePath) {
    const dataBuffer = fs_1.default.readFileSync(filePath);
    try {
        // --- ROBUST LIBRARY LOADING ---
        // We require inside the function to ensure correct runtime resolution.
        let pdfLib = require('pdf-parse');
        // 1. Handle ESM Default Export wrapper (common in Vite/Webpack builds)
        if (typeof pdfLib !== 'function' && pdfLib.default) {
            pdfLib = pdfLib.default;
        }
        // 2. Handle Named export 'PDFParse'
        if (typeof pdfLib !== 'function' && pdfLib.PDFParse) {
            pdfLib = pdfLib.PDFParse;
        }
        // 3. Final sanity check
        if (typeof pdfLib !== 'function') {
            throw new Error(`pdf-parse library loaded as ${typeof pdfLib}, expected function. Keys: ${Object.keys(pdfLib).join(', ')}`);
        }
        // --- EXECUTE PARSING ---
        let data;
        try {
            // Try calling as standard function
            // We use the default render method as it preserves the structure best for CSV-like PDFs
            data = await pdfLib(dataBuffer);
        }
        catch (e) {
            // Case 4: It's a Class/Constructor (fix for "Class constructors cannot be invoked without 'new'")
            if (e.message && e.message.includes("Class constructors cannot be invoked without 'new'")) {
                // @ts-ignore
                data = await new pdfLib(dataBuffer);
            }
            else {
                throw e;
            }
        }
        // --- TEXT VALIDATION ---
        const text = (data && typeof data.text === 'string') ? data.text : "";
        if (!text || text.trim().length === 0) {
            return { success: false, error: "No text found in PDF. This document appears to be a scanned image without a text layer. Please use an OCR-searchable PDF." };
        }
        // --- DATA EXTRACTION HEURISTICS ---
        const result = {
            poNumber: "",
            date: new Date().toISOString().split('T')[0],
            vendorName: "",
            gstin: "",
            lineItems: [],
            properties: {} // For capturing extra key-value pairs
        };
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        // A. Header Parsing (Meta Data)
        for (const line of lines) {
            const lower = line.toLowerCase();
            // PO Number (Matches "PO#:", "PO No")
            if (!result.poNumber && (lower.includes('po#') || lower.includes('po no'))) {
                const parts = line.split(/[:#]/);
                if (parts.length > 1) {
                    result.poNumber = parts[parts.length - 1].replace(/po\s*no\.?/i, '').trim();
                }
            }
            // Vendor Strategy (Matches "PO For:", "To:")
            if (!result.vendorName) {
                if (lower.includes('po for:')) {
                    const parts = line.split(/:/);
                    if (parts.length > 1)
                        result.vendorName = parts[1].trim();
                }
                else if (lower.startsWith('to:')) {
                    result.vendorName = line.substring(3).trim();
                }
            }
            // GSTIN Strategy
            if (!result.gstin && (lower.includes('gstin') || lower.includes('gst'))) {
                const parts = line.split(/[:.]/); // Split by : or .
                if (parts.length > 1) {
                    const potentialGst = parts[parts.length - 1].trim();
                    if (potentialGst.length > 5)
                        result.gstin = potentialGst;
                }
            }
            // Date Strategy
            if (lower.includes('date:')) {
                const parts = line.split(/date:/i);
                if (parts.length > 1) {
                    // Try to find a date-like string (e.g. 12-Aug-2025)
                    const dateStr = parts[1].trim();
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        result.date = d.toISOString().split('T')[0];
                    }
                }
            }
        }
        // B. Line Item Table Parsing (Dual Strategy)
        let currentSrNo = 1;
        for (const line of lines) {
            // Strategy 1: CSV/Quoted Style (Specific to your PDF: "1","Product"...)
            // Regex detects: "1" followed by ,"
            if (line.includes(`"${currentSrNo}"`)) {
                // Split by the CSV delimiter "," found in the PDF text layer
                const cols = line.split(`","`);
                if (cols.length >= 5) {
                    // Based on your sample:
                    // Index 0: "SrNo" (contains "1)
                    // Index 1: "Product Name"
                    // Index 2: "Qty"
                    // Index 3: "UOM"
                    // Index 4: "Unit Price"
                    // Index 6: "GST" (maybe)
                    // Last: "Total"
                    const qty = parseFloat(cols[2].replace(/[",]/g, ''));
                    const price = parseFloat(cols[4].replace(/[",\s₹]/g, '')); // Remove currency symbols
                    if (!isNaN(qty) && !isNaN(price)) {
                        // Clean up product name (remove trailing quote/newlines)
                        const rawName = cols[1].replace(/[\n\r]+/g, ' ').trim();
                        result.lineItems.push({
                            srNo: currentSrNo,
                            productName: rawName,
                            quantity: qty,
                            uom: cols[3].replace(/["]/g, '').trim(),
                            unitPrice: price,
                            gst: 18,
                            totalAmount: (qty * price) * 1.18 // Estimate total if parsing fails
                        });
                        currentSrNo++;
                        continue; // Skip Strategy 2 if this matched
                    }
                }
            }
            // Strategy 2: Whitespace Standard (Fallback)
            if (line.match(new RegExp(`^0?${currentSrNo}[ .]`))) {
                let parts = line.split(/\s{2,}/);
                if (parts.length < 3)
                    parts = line.split(/\s+/);
                const lastPart = parts[parts.length - 1].replace(/,/g, '');
                const secondLastPart = parts[parts.length - 2]?.replace(/,/g, '');
                const thirdLastPart = parts[parts.length - 3]?.replace(/,/g, '');
                let price = parseFloat(lastPart);
                let qty = 1;
                let unitPrice = price;
                const possibleQty = parseFloat(thirdLastPart);
                const possibleUnitPrice = parseFloat(secondLastPart);
                if (!isNaN(possibleQty) && !isNaN(possibleUnitPrice)) {
                    qty = possibleQty;
                    unitPrice = possibleUnitPrice;
                }
                else if (!isNaN(possibleUnitPrice)) {
                    if (possibleUnitPrice < 1000 && possibleUnitPrice % 1 === 0) {
                        qty = possibleUnitPrice;
                        unitPrice = price / qty;
                    }
                    else {
                        unitPrice = possibleUnitPrice;
                        qty = Math.round(price / unitPrice) || 1;
                    }
                }
                if (!isNaN(price)) {
                    const endSliceIndex = parts.length - (isNaN(possibleQty) && isNaN(possibleUnitPrice) ? 1 : (isNaN(possibleQty) ? 2 : 3));
                    const safeEndSlice = Math.max(1, endSliceIndex);
                    const description = parts.slice(1, safeEndSlice).join(' ');
                    result.lineItems.push({
                        srNo: currentSrNo,
                        productName: description || "Parsed Item " + currentSrNo,
                        quantity: qty || 1,
                        uom: "Nos",
                        unitPrice: unitPrice || price,
                        gst: 18,
                        totalAmount: price
                    });
                    currentSrNo++;
                }
            }
        }
        return { success: true, data: result };
    }
    catch (error) {
        console.error("PDF Parse Error:", error);
        return { success: false, error: "Failed to parse PDF. " + error.message };
    }
}
