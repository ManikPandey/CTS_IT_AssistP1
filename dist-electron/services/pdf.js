"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePurchaseOrderPDF = parsePurchaseOrderPDF;
const fs_1 = __importDefault(require("fs"));
// ===========================================================================
// 🛠️ 1. GLOBAL POLYFILLS (CRITICAL FOR ELECTRON)
// ===========================================================================
if (typeof global.DOMMatrix === 'undefined') {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
        a;
        b;
        c;
        d;
        e;
        f;
        constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
        multiply() { return this; }
        translate() { return this; }
        scale() { return this; }
        transformPoint(p) { return p; }
    };
}
if (typeof global.Path2D === 'undefined') {
    // @ts-ignore
    global.Path2D = class Path2D {
        constructor() { }
    };
}
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
async function parsePurchaseOrderPDF(filePath) {
    console.log(`[PDF Parser] Reading file: ${filePath}`);
    try {
        const dataBuffer = new Uint8Array(fs_1.default.readFileSync(filePath));
        // 1. CONFIGURATION
        const loadingTask = pdfjsLib.getDocument({
            data: dataBuffer,
            isEvalSupported: false,
            useSystemFonts: false,
            disableFontFace: true,
            verbosity: 0
        });
        const pdfDocument = await loadingTask.promise;
        let rawLines = [];
        // 2. TEXT EXTRACTION
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            // Sort items: Top-to-Bottom (Y), then Left-to-Right (X)
            const items = textContent.items.sort((a, b) => {
                const yDiff = b.transform[5] - a.transform[5];
                return Math.abs(yDiff) < 5 ? a.transform[4] - b.transform[4] : yDiff;
            });
            let lastY = -9999;
            let currentLine = "";
            for (const item of items) {
                const y = item.transform[5];
                const str = item.str;
                // New Line Detection
                if (lastY !== -9999 && Math.abs(y - lastY) > 5) {
                    if (currentLine.trim())
                        rawLines.push(currentLine.trim());
                    currentLine = "";
                }
                // Add space if separate items
                if (currentLine && !currentLine.endsWith(" ") && !str.startsWith(" ")) {
                    currentLine += " ";
                }
                currentLine += str;
                lastY = y;
            }
            if (currentLine.trim())
                rawLines.push(currentLine.trim());
        }
        // 3. INITIALIZE RESULT
        const result = {
            poNumber: "",
            date: new Date().toISOString().split('T')[0],
            vendorName: "",
            gstin: "",
            billingAddress: "",
            deliveryAddress: "",
            termsAndConditions: "",
            requestRef: "",
            deptName: "",
            approvedBy: "",
            requestType: "",
            prfRef: "",
            requestDate: "",
            actionDate: "",
            lineItems: [],
            properties: {}
        };
        const flatText = rawLines.join(" || ");
        // Helper: Safe Extract
        const extract = (pattern, source = flatText) => {
            const match = source.match(pattern);
            return (match && match[1]) ? match[1].trim() : "";
        };
        // 4. METADATA (Top Header)
        result.poNumber = extract(/PO#\s*[:\.]?\s*(VIT-B-PO-[\d\.]+)/i);
        result.vendorName = extract(/PO\s*For\s*[:\.]?\s*([^,:\n\|]+?)(?=\s*(?:GSTIN|Billing|\|))/i);
        result.gstin = extract(/\b(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/);
        const dateStr = extract(/Date\s*:\s*(\d{1,2}-[A-Za-z]{3}-\d{4})/i);
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime()))
                result.date = d.toISOString().split('T')[0];
        }
        // 5. FOOTER FIELDS (Positional Logic)
        // Log [28]: "Request Ref: Dept Name:..." -> [29] "IT-25... CTS..."
        const footerHeaderIdx = rawLines.findIndex(l => l.includes("Request Ref:") && l.includes("Dept Name:"));
        if (footerHeaderIdx !== -1 && rawLines[footerHeaderIdx + 1]) {
            const valuesLine = rawLines[footerHeaderIdx + 1].trim();
            const parts = valuesLine.split(/\s+/);
            if (parts.length >= 4) {
                result.requestRef = parts[0];
                result.deptName = parts[1];
                result.requestType = parts[2];
                result.prfRef = parts[3];
                result.approvedBy = parts.slice(4).join(" ");
                // Map to Properties for Frontend
                result.properties['Reference No'] = result.requestRef;
                result.properties['Department'] = result.deptName;
                result.properties['Request Type'] = result.requestType;
                result.properties['PRF Ref'] = result.prfRef;
                result.properties['Approved By'] = result.approvedBy;
            }
        }
        else {
            // Fallback
            if (flatText.includes("Gen Admin")) {
                result.approvedBy = "Gen Admin";
                result.properties['Approved By'] = "Gen Admin";
            }
        }
        // 6. TIMESTAMPS (Specific Names)
        // Log [26]: "Request Date: Actioned On:..." -> [27] "2025-08-12..."
        const timestampHeaderIdx = rawLines.findIndex(l => l.includes("Request Date:") && l.includes("Actioned On:"));
        if (timestampHeaderIdx !== -1 && rawLines[timestampHeaderIdx + 1]) {
            const valuesLine = rawLines[timestampHeaderIdx + 1];
            // Capture YYYY-MM-DD HH:MM:SS
            const dates = valuesLine.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/g);
            if (dates && dates.length >= 1) {
                result.requestDate = dates[0];
                result.properties['Request Date (PRF)'] = dates[0]; // Exact match for your request
            }
            if (dates && dates.length >= 2) {
                result.actionDate = dates[1];
                result.properties['Action Date (Approval)'] = dates[1]; // Exact match for your request
            }
        }
        else {
            // Fallback: Global Date Search
            const allDates = flatText.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/g) || [];
            if (allDates.length > 0) {
                result.requestDate = allDates[0] || "";
                result.properties['Request Date (PRF)'] = allDates[0];
            }
            if (allDates.length > 1) {
                result.actionDate = allDates[1];
                result.properties['Action Date (Approval)'] = allDates[1];
            }
        }
        // 7. ADDRESS BLOCKS (Split Logic)
        const getAddress = (isBilling) => {
            const startIdx = rawLines.findIndex(l => l.includes("Billing/Institution Address"));
            if (startIdx === -1)
                return "";
            let buffer = [];
            for (let i = startIdx + 1; i < startIdx + 7; i++) {
                const line = rawLines[i];
                if (!line)
                    break;
                if (line.includes("Sr.") || line.includes("Product Name") || line.includes("Discount"))
                    break;
                // Split long lines (>30 chars)
                if (line.length > 30) {
                    const midpoint = Math.floor(line.length / 2);
                    const splitIdx = line.indexOf(" ", midpoint);
                    if (splitIdx !== -1) {
                        const left = line.substring(0, splitIdx).trim();
                        const right = line.substring(splitIdx).trim();
                        buffer.push(isBilling ? left : right);
                    }
                    else {
                        buffer.push(line);
                    }
                }
                else {
                    buffer.push(line);
                }
            }
            return buffer.join("\n");
        };
        result.billingAddress = getAddress(true);
        result.deliveryAddress = getAddress(false);
        // Explicit Property Mapping
        result.properties['Billing Address'] = result.billingAddress;
        result.properties['Delivery Address'] = result.deliveryAddress;
        result.properties['GSTIN'] = result.gstin;
        // 8. LINE ITEM TABLE (Right-to-Left Logic)
        for (const line of rawLines) {
            if (line.includes("Product Name") || line.includes("Unit Price"))
                continue;
            if (/\d{4}-\d{2}-\d{2}/.test(line))
                continue;
            const cleanLine = line.replace(/",\s*"/g, " ").replace(/"/g, "");
            const rowMatch = cleanLine.match(/(\d+)\s+(.+?)\s*[-]?\s*(\d+)\s+([A-Za-z]+)\s+([₹]?\s*[\d,]+\.\d{2})\s+([₹]?\s*[\d,]+\.\d{2})\s+(\d+%)\s+([₹]?\s*[\d,]+\.\d{2})/);
            const simpleMatch = cleanLine.match(/(\d+)\s+(.+?)\s*[-]?\s*(\d+)\s+([A-Za-z]+)\s+([₹]?\s*[\d,.]+)/);
            if (rowMatch) {
                const qty = parseFloat(rowMatch[3]);
                const price = parseFloat(rowMatch[5].replace(/[₹,]/g, ''));
                const total = parseFloat(rowMatch[8].replace(/[₹,]/g, ''));
                if (qty > 0) {
                    result.lineItems.push({
                        srNo: rowMatch[1],
                        description: rowMatch[2].trim().replace(/-$/, ''),
                        qty: qty,
                        uom: rowMatch[4],
                        unitPrice: price,
                        gstPercent: parseFloat(rowMatch[7]),
                        totalAmount: total
                    });
                }
            }
            else if (simpleMatch) {
                const qty = parseFloat(simpleMatch[3]);
                const price = parseFloat(simpleMatch[5].replace(/[₹,]/g, ''));
                const desc = simpleMatch[2].trim();
                if (qty > 0 && !desc.includes(":")) {
                    result.lineItems.push({
                        srNo: simpleMatch[1],
                        description: desc.replace(/-$/, ''),
                        qty: qty,
                        uom: simpleMatch[4],
                        unitPrice: price,
                        gstPercent: 18,
                        totalAmount: (qty * price) * 1.18
                    });
                }
            }
        }
        // 9. TERMS
        const terms = rawLines.filter(l => /^\d+\.\s/.test(l));
        result.termsAndConditions = terms.join("\n");
        return { success: true, data: result };
    }
    catch (error) {
        console.error("[PDF Error]", error);
        return { success: false, error: "Parsing Error: " + error.message };
    }
}
