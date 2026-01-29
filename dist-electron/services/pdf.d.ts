export declare function parsePurchaseOrderPDF(filePath: string): Promise<{
    success: boolean;
    error: string;
    data?: undefined;
} | {
    success: boolean;
    data: {
        poNumber: string;
        date: string;
        vendorName: string;
        gstin: string;
        lineItems: any[];
        properties: any;
    };
    error?: undefined;
}>;
