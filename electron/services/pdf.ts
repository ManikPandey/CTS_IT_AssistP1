import fs from 'fs';
import PDFParser from 'pdf2json';

// ==========================================
// PDF PARSING SERVICE (pdf2json)
// ==========================================

export async function parsePurchaseOrderPDF(filePath: string) {
  console.log(`[PDF] Reading file: ${filePath}`);

  return new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("[PDF] Parse Error:", errData.parserError);
      resolve({ success: false, error: "Failed to parse PDF: " + errData.parserError });
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        // 1. RAW TEXT EXTRACTION
        // We accumulate text while trying to preserve lines based on Y-position
        let rawText = "";
        
        // Simple extraction: Join all text items. 
        // Note: pdf2json outputs URI encoded strings.
        pdfData.Pages.forEach((page: any) => {
          page.Texts.forEach((textItem: any) => {
            textItem.R.forEach((t: any) => {
              let str = t.T;
              try { str = decodeURIComponent(t.T); } 
              catch (e) { try { str = unescape(t.T); } catch (e2) {} }
              rawText += str;
            });
            // Approximate separation
            rawText += "\n"; 
          });
        });

        // 2. PARSE WITH ADVANCED LOGIC
        const result = parseAdvancedPO(rawText);
        resolve({ success: true, data: result });

      } catch (e: any) {
        console.error("[PDF] Processing Error:", e);
        resolve({ success: false, error: "Error processing PDF text: " + e.message });
      }
    });

    try {
      pdfParser.loadPDF(filePath);
    } catch (e: any) {
      resolve({ success: false, error: "Load Error: " + e.message });
    }
  });
}

function parseAdvancedPO(text: string) {
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
      lineItems: [] as any[],
      properties: {} as any
    };

    // Normalize: Split into lines, trim
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const fullText = lines.join(' '); // Flat text for regex searching

    // --- 1. TOKEN SEARCH STRATEGY (Regex) ---
    // Helper to extract regex match
    const find = (pattern: RegExp, group = 1) => {
        const match = fullText.match(pattern);
        return match ? match[group].trim() : "";
    };

    // A. Header Info
    result.poNumber = find(/(?:PO\s*[#\.]?|Order\s*No\.?)\s*[:\.-]*\s*([A-Z0-9\.-]+)/i) || find(/VIT-B-PO-[\d\.]+/);
    result.vendorName = find(/PO\s*FOR\s*[:\.-]*\s*([^,:\n]+)/i) || find(/Vendor\s*[:\.-]*\s*([^,:\n]+)/i);
    result.gstin = find(/GSTIN\s*[:\.-]*\s*([A-Z0-9]{15})/i) || find(/GST\s*[:\.-]*\s*([A-Z0-9]{15})/i);
    
    // Date: Try specific labels first, then generic date pattern
    let dateStr = find(/Date\s*:\s*(\d{1,2}-\w{3}-\d{4})/i) || find(/Date\s*:\s*(\d{2,4}[-\/]\d{1,2}[-\/]\d{2,4})/i);
    if (!dateStr) dateStr = find(/(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})/i);
    
    if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) result.date = d.toISOString().split('T')[0];
    }

    // B. Metadata (Request details)
    result.requestRef = find(/Request\s*Ref\s*[:\.-]*\s*([A-Z0-9\.-]+)/i);
    result.deptName = find(/Dept\s*Name\s*[:\.-]*\s*([A-Za-z\s]+)/i);
    result.requestType = find(/Request\s*Type\s*[:\.-]*\s*([A-Za-z]+)/i);
    result.prfRef = find(/PRF\s*Ref\s*[:\.-]*\s*([A-Z0-9]+)/i);
    result.approvedBy = find(/Approved\s*By\s*[:\.-]*\s*([A-Za-z\s\.]+)/i) || find(/Authorised\s*Signatory\s*[:\.-]*\s*([A-Za-z\s\.]+)/i);

    // Timestamps
    const reqDate = find(/Request\s*Date\s*[:\.-]*\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
    if (reqDate) result.requestDate = new Date(reqDate).toISOString();
    
    const actDate = find(/Actioned\s*On\s*[:\.-]*\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
    if (actDate) result.actionDate = new Date(actDate).toISOString();

    // Extra Stats into Properties
    const processDelay = find(/Process\s*Delay\s*[:\.-]*\s*(\d+\s*days)/i);
    if (processDelay) result.properties['Process Delay'] = processDelay;
    
    const daysLeft = find(/Days\s*Left\s*[:\.-]*\s*(\d+\s*days)/i);
    if (daysLeft) result.properties['Days Left'] = daysLeft;


    // --- 2. ADDRESS BLOCK EXTRACTION ---
    // We scan lines to find the "Billing" or "Delivery" headers and capture lines until we hit a stop-word
    let captureMode: 'NONE' | 'BILLING' | 'DELIVERY' = 'NONE';
    let billingBuffer = [];
    let deliveryBuffer = [];
    
    const stopWords = ['Date:', 'Sr.', 'No', 'PO#', 'Contact:', 'Mobile'];

    for (const line of lines) {
        const lower = line.toLowerCase();
        
        // Start Capturing
        if (lower.includes('billing') && lower.includes('address')) { captureMode = 'BILLING'; continue; }
        if ((lower.includes('site') || lower.includes('delivery')) && lower.includes('address')) { captureMode = 'DELIVERY'; continue; }
        
        // Stop Capturing
        if (stopWords.some(w => line.includes(w))) { captureMode = 'NONE'; }
        if (captureMode !== 'NONE' && (line.includes('____________') || line.length < 2)) { captureMode = 'NONE'; }

        // Accumulate
        if (captureMode === 'BILLING') billingBuffer.push(line);
        if (captureMode === 'DELIVERY') deliveryBuffer.push(line);
    }
    result.billingAddress = billingBuffer.slice(0, 5).join('\n'); // Limit to 5 lines
    result.deliveryAddress = deliveryBuffer.slice(0, 5).join('\n');


    // --- 3. TERMS & CONDITIONS EXTRACTION ---
    // Look for lines starting with "1. ", "2. ", etc.
    const termsBuffer = [];
    for (const line of lines) {
        if (line.match(/^\d+\.\s+[A-Z]/)) {
            termsBuffer.push(line);
        }
    }
    result.termsAndConditions = termsBuffer.join('\n');


    // --- 4. LINE ITEM TABLE PARSING ---
    // Handles specific CSV-style formatting found in your PDF: "1","Product"...
    
    let currentSrNo = 1;
    
    for (const line of lines) {
        // Strategy A: Quoted CSV (Specific to your file)
        // Regex looks for: "1","...
        if (line.includes(`"${currentSrNo}"`) || line.includes(`'${currentSrNo}'`)) {
            
            // Split carefully by quote-comma-quote
            const cols = line.split(/["'],["']/);
            
            // Expected: 0=Sr, 1=Name, 2=Qty, 3=UOM, 4=Price, 6=GST, 7=Total (Indices approx)
            if (cols.length >= 4) {
                 const rawQty = cols[2].replace(/[",]/g, '');
                 const rawPrice = cols[4].replace(/[",\s₹]/g, ''); // Index 4 based on your snippet
                 
                 const qty = parseFloat(rawQty);
                 const price = parseFloat(rawPrice);

                 if (!isNaN(qty)) {
                     const name = cols[1].replace(/^["']|["']$/g, '').replace(/[\r\n]+/g, ' ').trim();
                     const uom = cols[3]?.replace(/["']/g, '') || "Nos";
                     const gstStr = cols[6]?.replace(/%/g, '') || "18"; // Guessing index 6 for GST based on snippet
                     
                     result.lineItems.push({
                         srNo: currentSrNo,
                         productName: name,
                         quantity: qty,
                         uom: uom,
                         unitPrice: isNaN(price) ? 0 : price,
                         gst: parseFloat(gstStr) || 18,
                         totalAmount: (qty * (isNaN(price)?0:price)) * 1.18 // Auto-calc total
                     });
                     currentSrNo++;
                     continue; 
                 }
            }
        }
        
        // Strategy B: Whitespace/Tabular Fallback
        if (line.match(new RegExp(`^${currentSrNo}\\s+`)) || line.match(new RegExp(`^${currentSrNo}\\.`))) {
             const parts = line.split(/\s{2,}/); // Split by 2+ spaces
             if (parts.length >= 3) {
                 const last = parts[parts.length-1].replace(/,/g,'');
                 const price = parseFloat(last);
                 
                 // Guess Qty is 3rd from last
                 const qtyStr = parts[parts.length-3]?.replace(/,/g,'');
                 let qty = parseFloat(qtyStr);
                 if (isNaN(qty)) qty = 1;

                 if (!isNaN(price)) {
                     const descEnd = parts.length - 3;
                     const name = parts.slice(1, Math.max(1, descEnd)).join(' ');
                     
                     result.lineItems.push({
                         srNo: currentSrNo,
                         productName: name,
                         quantity: qty,
                         uom: "Nos",
                         unitPrice: price,
                         gst: 18,
                         totalAmount: price
                     });
                     currentSrNo++;
                 }
             }
        }
    }

    return result;
}