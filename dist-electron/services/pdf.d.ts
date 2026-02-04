export interface POData {
    poNumber: string;
    date: string;
    vendorName: string;
    gstin: string;
    billingAddress: string;
    deliveryAddress: string;
    termsAndConditions: string;
    requestRef: string;
    deptName: string;
    approvedBy: string;
    requestType: string;
    prfRef: string;
    requestDate: string;
    actionDate: string;
    lineItems: LineItem[];
    properties: any;
}
export interface LineItem {
    srNo: string;
    description: string;
    qty: number;
    uom: string;
    unitPrice: number;
    gstPercent: number;
    totalAmount: number;
}
export declare function parsePurchaseOrderPDF(filePath: string): Promise<{
    success: boolean;
    data?: POData;
    error?: string;
}>;
