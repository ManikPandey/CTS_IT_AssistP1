import { PrismaClient } from '@prisma/client';
declare let prisma: PrismaClient;
export { prisma };
export declare function seedDatabase(): Promise<void>;
