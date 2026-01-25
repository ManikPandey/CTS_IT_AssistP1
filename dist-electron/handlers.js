"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandlers = registerHandlers;
const electron_1 = require("electron");
const db_1 = require("./db");
function registerHandlers() {
    // 1. GET Dashboard Stats
    // Returns counts for the dashboard cards
    electron_1.ipcMain.handle('dashboard:get-stats', async () => {
        try {
            const [assetCount, poCount, categoryCount] = await Promise.all([
                db_1.prisma.asset.count(),
                db_1.prisma.purchaseOrder.count(),
                db_1.prisma.category.count()
            ]);
            return { success: true, data: { assetCount, poCount, categoryCount } };
        }
        catch (error) {
            console.error("Error fetching stats:", error);
            return { success: false, error: "Failed to fetch stats" };
        }
    });
    // 2. GET All Categories
    // Fetches categories for the sidebar navigation
    electron_1.ipcMain.handle('inventory:get-categories', async () => {
        try {
            const categories = await db_1.prisma.category.findMany({
                orderBy: { name: 'asc' },
                include: { subCategories: true }
            });
            return { success: true, data: categories };
        }
        catch (error) {
            console.error("Error fetching categories:", error);
            return { success: false, error: "Failed to fetch categories" };
        }
    });
    // 3. GET Assets
    // Fetches asset list, optionally filtered by a specific category
    electron_1.ipcMain.handle('inventory:get-assets', async (_, categoryId) => {
        try {
            const whereClause = categoryId
                ? { subCategory: { categoryId: categoryId } }
                : {};
            const assets = await db_1.prisma.asset.findMany({
                where: whereClause,
                include: { subCategory: true },
                orderBy: { updatedAt: 'desc' },
                take: 100 // Limit to 100 for performance
            });
            return { success: true, data: assets };
        }
        catch (error) {
            console.error("Error fetching assets:", error);
            return { success: false, error: "Failed to fetch assets" };
        }
    });
    // 4. CREATE Category (New Logic)
    // Adds a new category to the database
    electron_1.ipcMain.handle('inventory:create-category', async (_, data) => {
        try {
            // Auto-generate slug (e.g., "Network Switch" -> "network-switch")
            const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const category = await db_1.prisma.category.create({
                data: { ...data, slug }
            });
            return { success: true, data: category };
        }
        catch (error) {
            console.error("Error creating category:", error);
            return { success: false, error: "Failed to create category. Name might be duplicate." };
        }
    });
    // 5. UPDATE Category (New Logic)
    // Renames or updates description of an existing category
    electron_1.ipcMain.handle('inventory:update-category', async (_, { id, data }) => {
        try {
            // If name changes, we must update the slug too to keep data clean
            if (data.name) {
                data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            }
            const category = await db_1.prisma.category.update({
                where: { id },
                data
            });
            return { success: true, data: category };
        }
        catch (error) {
            console.error("Error updating category:", error);
            return { success: false, error: "Failed to update category" };
        }
    });
    console.log('✅ IPC Handlers Registered');
}
