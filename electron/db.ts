import { PrismaClient } from '@prisma/client';
import path from 'path';

// Prevent multiple instances in development
// @ts-ignore
export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.prisma = prisma;
}

// --- SEEDING LOGIC ---
// This runs every time the app starts. 
// If the DB is empty, it populates your specific categories.
export async function seedDatabase() {
  const count = await prisma.category.count();
  if (count > 0) return; // Already seeded

  console.log('Database empty. Seeding initial categories...');

  // Your specific requirements
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
    await prisma.category.create({
      data: cat,
    });
  }

  console.log(`✅ Seeded ${initialCategories.length} categories.`);
}