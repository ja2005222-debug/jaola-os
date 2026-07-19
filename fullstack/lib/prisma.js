import { PrismaClient } from '@prisma/client';

// نسخة مفردة تنجو من إعادة التحميل الساخن في التطوير
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
