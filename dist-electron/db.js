"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.seedDatabase = seedDatabase;
const client_1 = require("@prisma/client");
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ==========================================
// DATABASE PATH RESOLUTION
// ==========================================
let prisma;
// 1. Define where the DB should live
function getDatabasePath() {
    // If in Dev, standard node resolution works fine
    if (!electron_1.app.isPackaged) {
        return path_1.default.join(__dirname, '../../prisma/dev.db');
    }
    // If in Prod (Installed .exe), we must use AppData (Writable)
    // Path: C:\Users\Name\AppData\Roaming\IT Asset Manager\database.db
    return path_1.default.join(electron_1.app.getPath('userData'), 'database.db');
}
const dbPath = getDatabasePath();
// 2. Production "First Run" Logic
// Copy the empty DB from the installer resources to AppData
if (electron_1.app.isPackaged) {
    try {
        // Only copy if it doesn't exist (preserve user data on updates)
        if (!fs_1.default.existsSync(dbPath)) {
            // "extraResources" puts files in process.resourcesPath
            const sourcePath = path_1.default.join(process.resourcesPath, 'prisma', 'dev.db');
            console.log(`[DB Init] First run detected. Copying DB from ${sourcePath} to ${dbPath}`);
            fs_1.default.copyFileSync(sourcePath, dbPath);
        }
    }
    catch (e) {
        console.error('[DB Init] Failed to copy database file:', e);
    }
    // Initialize Prisma with the custom path
    exports.prisma = prisma = new client_1.PrismaClient({
        datasources: {
            db: {
                url: `file:${dbPath}`,
            },
        },
    });
}
else {
    // Development Mode (Standard)
    // @ts-ignore
    exports.prisma = prisma = global.prisma || new client_1.PrismaClient();
    if (process.env.NODE_ENV !== 'production') {
        // @ts-ignore
        global.prisma = prisma;
    }
}
// ==========================================
// SEEDING LOGIC
// ==========================================
async function seedDatabase() {
    try {
        const count = await prisma.category.count();
        if (count > 0)
            return; // Already seeded
        console.log('Database empty. Seeding initial categories...');
        const initialCategories = [
            { name: 'Computers', slug: 'computers', description: 'Desktops, Workstations, Servers' },
            { name: 'Laptops', slug: 'laptops', description: 'Portable computers' },
            { name: 'Printers', slug: 'printers', description: 'Network and Local Printers' },
            { name: 'Access Points', slug: 'access-points', description: 'HPE Aruba, Extreme, etc.' },
            { name: 'Network Switches', slug: 'network-switches', description: 'L2/L3 Switches' },
            { name: 'FRTs', slug: 'frts', description: 'Face Recognition Terminals' },
            { name: 'Turnstiles', slug: 'turnstiles', description: 'Physical security barriers' },
            { name: 'Projectors', slug: 'projectors', description: 'Classroom and Auditórium projectors' },
            { name: 'AV Systems', slug: 'av-systems', description: 'Audio/Video equipment' },
            { name: 'Cabling Items', slug: 'cabling', description: 'Patch cords, rolls, connectors' },
            { name: 'UPS', slug: 'ups', description: 'Uninterruptible Power Supplies' },
            { name: 'ID Cards', slug: 'id-cards', description: 'Employee/Student ID stock' },
            { name: 'Licenses', slug: 'licenses', description: 'Software Licenses' },
        ];
        for (const cat of initialCategories) {
            await prisma.category.create({ data: cat });
        }
        console.log(`✅ Seeded ${initialCategories.length} categories.`);
    }
    catch (error) {
        console.error("Seeding failed:", error);
    }
}
