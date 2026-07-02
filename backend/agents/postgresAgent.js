/**
 * 🐘 PostgreSQL + Prisma Agent — JAOLA OS
 *
 * يُولّد:
 * - prisma/schema.prisma كامل
 * - Migration instructions
 * - Seed data
 * - API routes تستخدم Prisma Client
 */

import { smartChat } from './baseAgent.js';

// ═══════════════════════════════════════════════════════
// 📊 Schemas جاهزة لأشهر أنواع المشاريع
// ═══════════════════════════════════════════════════════
const PRISMA_SCHEMAS = {
    ecommerce: `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String
  role      Role     @default(USER)
  orders    Order[]
  reviews   Review[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Product {
  id          String     @id @default(cuid())
  name        String
  description String?
  price       Float
  stock       Int        @default(0)
  category    String
  images      String[]
  rating      Float      @default(0)
  reviews     Review[]
  orderItems  OrderItem[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model Order {
  id         String      @id @default(cuid())
  user       User        @relation(fields: [userId], references: [id])
  userId     String
  items      OrderItem[]
  total      Float
  status     OrderStatus @default(PENDING)
  address    Json
  paymentId  String?
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model OrderItem {
  id        String  @id @default(cuid())
  order     Order   @relation(fields: [orderId], references: [id])
  orderId   String
  product   Product @relation(fields: [productId], references: [id])
  productId String
  quantity  Int
  price     Float
}

model Review {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  product   Product  @relation(fields: [productId], references: [id])
  productId String
  rating    Int
  comment   String?
  createdAt DateTime @default(now())
}

enum Role {
  USER
  ADMIN
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}`,

    hotel: `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Room {
  id          String    @id @default(cuid())
  number      String    @unique
  type        RoomType
  price       Float
  capacity    Int
  amenities   String[]
  images      String[]
  isAvailable Boolean   @default(true)
  bookings    Booking[]
  createdAt   DateTime  @default(now())
}

model Booking {
  id            String        @id @default(cuid())
  room          Room          @relation(fields: [roomId], references: [id])
  roomId        String
  guestName     String
  guestEmail    String
  guestPhone    String
  checkIn       DateTime
  checkOut      DateTime
  totalPrice    Float
  status        BookingStatus @default(PENDING)
  paymentStatus PaymentStatus @default(PENDING)
  paymentId     String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

enum RoomType {
  STANDARD
  DELUXE
  SUITE
  PENTHOUSE
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  REFUNDED
}`,

    medical: `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Doctor {
  id           String        @id @default(cuid())
  name         String
  specialty    String
  bio          String?
  image        String?
  experience   Int
  rating       Float         @default(0)
  appointments Appointment[]
  schedule     Json
  createdAt    DateTime      @default(now())
}

model Appointment {
  id        String            @id @default(cuid())
  doctor    Doctor            @relation(fields: [doctorId], references: [id])
  doctorId  String
  patient   Patient           @relation(fields: [patientId], references: [id])
  patientId String
  date      DateTime
  time      String
  type      AppointmentType
  notes     String?
  status    AppointmentStatus @default(PENDING)
  createdAt DateTime          @default(now())
}

model Patient {
  id           String        @id @default(cuid())
  name         String
  email        String        @unique
  phone        String
  age          Int?
  appointments Appointment[]
  createdAt    DateTime      @default(now())
}

enum AppointmentType {
  CONSULTATION
  FOLLOWUP
  CHECKUP
  EMERGENCY
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}`,
};

// ═══════════════════════════════════════════════════════
// 🌱 Seed Data لكل نوع
// ═══════════════════════════════════════════════════════
const PRISMA_SEEDS = {
    ecommerce: `
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Admin user
    await prisma.user.upsert({
        where: { email: 'admin@store.com' },
        update: {},
        create: {
            email: 'admin@store.com',
            name: 'مدير المتجر',
            password: await bcrypt.hash('admin123', 12),
            role: 'ADMIN',
        },
    });

    // Sample products
    const products = [
        { name: 'قميص كلاسيكي', price: 89, category: 'ملابس', stock: 50 },
        { name: 'بنطال جينز', price: 149, category: 'ملابس', stock: 30 },
        { name: 'حذاء رياضي', price: 250, category: 'أحذية', stock: 20 },
        { name: 'حقيبة جلدية', price: 380, category: 'إكسسوارات', stock: 15 },
    ];

    for (const product of products) {
        await prisma.product.create({ data: product });
    }

    console.log('✅ Seed data created');
}

main().catch(console.error).finally(() => prisma.$disconnect());`,
};

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function generatePrismaSetup(userGoal, projectType) {
    const schema = PRISMA_SCHEMAS[projectType] || await generateDynamicSchema(userGoal, projectType);
    const seed = PRISMA_SEEDS[projectType] || '';

    const files = [];

    // prisma/schema.prisma
    files.push({
        name: 'prisma/schema.prisma',
        content: schema.trim()
    });

    // prisma/seed.js
    if (seed) {
        files.push({
            name: 'prisma/seed.js',
            content: seed.trim()
        });
    }

    // API route باستخدام Prisma
    files.push({
        name: 'api/db.js',
        content: `
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;`.trim()
    });

    // .env.example
    files.push({
        name: '.env.example',
        content: `DATABASE_URL="postgresql://username:password@localhost:5432/jaola_db?schema=public"\nJWT_SECRET=your-super-secret-key`
    });

    // README
    files.push({
        name: 'PRISMA_README.md',
        content: `# PostgreSQL + Prisma Setup

## التثبيت
\`\`\`bash
npm install @prisma/client prisma
npx prisma generate
npx prisma db push
npx prisma db seed
\`\`\`

## قاعدة بيانات مجانية
- [Supabase](https://supabase.com) — PostgreSQL مجاني
- [Neon](https://neon.tech) — Serverless PostgreSQL

## الاستخدام
\`\`\`javascript
import { prisma } from './api/db.js';
const products = await prisma.product.findMany();
\`\`\``
    });

    return {
        success: true,
        files,
        summary: `PostgreSQL + Prisma — ${files.length} ملف (schema, seed, client, readme)`
    };
}

// توليد Schema ديناميكي بـ AI
async function generateDynamicSchema(userGoal, projectType) {
    try {
        const response = await smartChat([{
            role: 'system',
            content: 'أنت مهندس قواعد بيانات. اكتب Prisma Schema لـ PostgreSQL. كود فقط بدون شرح.'
        }, {
            role: 'user',
            content: `المشروع: ${userGoal}\nالنوع: ${projectType}\nاكتب Prisma Schema مناسباً.`
        }], { max_tokens: 800, temperature: 0.2 });
        return response;
    } catch (e) {
        return PRISMA_SCHEMAS.ecommerce; // fallback
    }
}

// كشف هل المشروع يحتاج PostgreSQL
export function needsPostgres(userGoal) {
    return /postgres|postgresql|prisma|relational|علاقية|مالي|محاسبة|finance|accounting/i.test(userGoal);
}
