import fs from 'fs';

  // --- POLYFILLS FOR PDF-PARSE ---
  // Critical: The underlying pdf.js library expects these Browser APIs.
  // We must mock them before requiring 'pdf-parse' to prevent crashes.

  // @ts-ignore
  if (typeof global.DOMMatrix === 'undefined') {
      // @ts-ignore
      global.DOMMatrix = class DOMMatrix {
          constructor() {}
          multiply() { return this; }
          translate() { return this; }
          scale() { return this; }
          transformPoint(p: any) { return p; }
      };
  }

  // @ts-ignore
  if (typeof global.Path2D === 'undefined') {
      // @ts-ignore
      global.Path2D = class Path2D { constructor() {} };
  }

  // @ts-ignore
  if (typeof global.ImageData === 'undefined') {
      // @ts-ignore
      global.ImageData = class ImageData {
          width = 0; height = 0; data = null;
          constructor() {}
      };
  }

  // @ts-ignore
  if (typeof global.document === 'undefined') {
      // @ts-ignore
      global.document = {
          // We cast the function itself to 'any' to bypass argument and return type checks
          createElement: (() => ({
              getContext: () => ({}) 
          })) as any
      };
  }

  export async function parsePurchaseOrderPDF(filePath: string) {
    const dataBuffer = fs.readFileSync(filePath);
    
    try {
      // --- ROBUST LIBRARY LOADING ---
      // We require inside the function to ensure correct runtime resolution.
      // We check for different export styles (CommonJS vs ESM interop).
      let pdfLib = require('pdf-parse');

      // If it loaded as an object (ESM default export wrapper), extract .default
      if (typeof pdfLib !== 'function' && pdfLib.default) {
          pdfLib = pdfLib.default;
      }

      // Fix for environment where the function is a named export 'PDFParse'
      if (typeof pdfLib !== 'function' && pdfLib.PDFParse) {
          pdfLib = pdfLib.PDFParse;
      }

      // Final sanity check
      if (typeof pdfLib !== 'function') {
          throw new Error(`pdf-parse library loaded as ${typeof pdfLib}, expected function. Keys: ${Object.keys(pdfLib).join(', ')}`);
      }

      // Call the library function safely
      // Fix for "Class constructors cannot be invoked without 'new'"
      let data;
      try {
          data = await pdfLib(dataBuffer);
      } catch (e: any) {
          if (e.message && e.message.includes("Class constructors cannot be invoked without 'new'")) {
              // @ts-ignore
              data = await new pdfLib(dataBuffer);
          } else {
              throw e;
          }
      }
      
      // Fix for "Cannot read properties of undefined (reading 'split')"
      // Ensure data exists and has text property. Default to empty string if missing.
      const text = (data && typeof data.text === 'string') ? data.text : "";
      
      // Validation: If no text found, it might be an image-only PDF
      if (!text.trim()) {
          return { success: false, error: "No text found in PDF. This might be a scanned image without OCR." };
      }
      
      // --- HEURISTIC PARSING LOGIC ---
      // Matches text patterns for PO Number, Date, Vendor, and Table Items.

      const result = {
        poNumber: "",
        date: new Date().toISOString().split('T')[0],
        vendorName: "",
        gstin: "",
        lineItems: [] as any[]
      };

      const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

      // 1. Header Extraction
      for (const line of lines) {
        const lower = line.toLowerCase();
        
        // PO Number Strategy
        if (!result.poNumber && (lower.includes('po no') || lower.includes('order no') || lower.includes('ref no'))) {
          const parts = line.split(/[:#]/);
          if (parts.length > 1) result.poNumber = parts[parts.length - 1].trim();
        }

        // Vendor Strategy
        if (!result.vendorName && lower.startsWith('to:')) {
          result.vendorName = line.substring(3).trim();
        }
        
        // GSTIN
        if (!result.gstin && (lower.includes('gst') || lower.includes('gstin'))) {
          const parts = line.split(/[:#]/);
          if (parts.length > 1) result.gstin = parts[parts.length - 1].trim();
        }
      }

      // 2. Line Item Extraction Strategy
      let currentSrNo = 1;
      
      for (const line of lines) {
        // Regex to find lines starting with the current SrNo (e.g., "1 ", "1.", "01")
        if (line.match(new RegExp(`^0?${currentSrNo}[ .]`))) {
          
          // Strategy: Split by multiple spaces which usually separate columns in PDF text dumps
          const parts = line.split(/\s{2,}/); 
          // Fallback: Split by single spaces
          const partsFallback = line.split(/\s+/);

          let price = 0, qty = 0;
          let description = "";

          if (parts.length >= 3) {
            // Ideal case: "1   Laptop Dell   2   50000"
            const priceRaw = parts[parts.length - 1].replace(/,/g, '');
            const qtyRaw = parts[parts.length - 2].replace(/,/g, '');
            price = parseFloat(priceRaw);
            qty = parseFloat(qtyRaw);
            description = parts.slice(1, parts.length - 2).join(' ');
          } else if (partsFallback.length >= 4) {
            // Compact case: "1 Laptop Dell 2 50000"
            const priceRaw = partsFallback[partsFallback.length - 1].replace(/,/g, '');
            
            if (!isNaN(parseFloat(priceRaw))) {
                price = parseFloat(priceRaw);
                // Try to find qty (usually small number < 1000)
                const possibleQty = parseFloat(partsFallback[partsFallback.length - 2]);
                if (!isNaN(possibleQty) && possibleQty < 1000) { 
                    qty = possibleQty;
                    description = partsFallback.slice(1, partsFallback.length - 2).join(' ');
                } else {
                    qty = 1; // Default
                    description = partsFallback.slice(1, partsFallback.length - 1).join(' ');
                }
            }
          }

          if (description && !isNaN(price)) {
              result.lineItems.push({
                srNo: currentSrNo,
                productName: description || "Parsed Item",
                quantity: qty || 1,
                uom: "Nos",
                unitPrice: price,
                gst: 18, 
                totalAmount: (qty * price) * 1.18
              });
              currentSrNo++;
          }
        }
      }

      return { success: true, data: result };

    } catch (error: any) {
      console.error("PDF Parse Error:", error);
      return { success: false, error: "Failed to parse PDF. " + error.message };
    }
  }