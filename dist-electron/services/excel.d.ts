export declare function importExcelData(filePath: string): Promise<{
    success: boolean;
    error: string;
    report?: undefined;
} | {
    success: boolean;
    report: {
        total: number;
        success: number;
        errors: string[];
    };
    error?: undefined;
}>;
export declare function exportExcelData(filePath: string): Promise<{
    success: boolean;
}>;
export declare function importPurchaseOrders(filePath: string): Promise<{
    success: boolean;
    error: string;
    count?: undefined;
} | {
    success: boolean;
    count: number;
    error?: undefined;
}>;
