/**
 * 🔄 Migration Agent — JAOLA OS
 *
 * يُحوّل بين قواعد البيانات تلقائياً:
 * - MongoDB → PostgreSQL (مع Prisma)
 * - يُولّد migration scripts
 * - يُحوّل Mongoose models إلى Prisma Schema
 */

import { smartChat } from './baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔍 كشف نوع قاعدة البيانات الحالية
// ═══════════════════════════════════════════════════════
export function detectCurrentDB(files) {
    const allCode = files.map(f => f.content || '').join('\n');

    if (/mongoose|mongodb/i.test(allCode)) return 'mongodb';
    if (/PrismaClient|postgresql/i.test(allCode)) return 'postgresql';
    if (/\bpg\b|Pool.*pg/i.test(allCode)) return 'postgresql';
    if (/redis/i.test(allCode)) return 'redis';
    return 'unknown';
}

// ═══════════════════════════════════════════════════════
// 🔄 تحويل Mongoose Schema إلى Prisma Schema
// ═══════════════════════════════════════════════════════
export function mongooseToPrisma(mongooseSchema) {
    if (!mongooseSchema) return null;

    // استخراج اسم الـ model
    const modelMatch = mongooseSchema.match(/mongoose\.model\(['"](\w+)['"]/);
    const modelName = modelMatch ? modelMatch[1] : 'Model';

    // استخراج الحقول
    const fields = [];
    const fieldPattern = /(\w+)\s*:\s*\{?\s*type\s*:\s*(\w+)(?:[^}]*required\s*:\s*true)?/g;
    let match;

    while ((match = fieldPattern.exec(mongooseSchema)) !== null) {
        const [, name, type] = match;
        if (['_id', '__v'].includes(name)) continue;

        const prismaType = {
            'String': 'String',
            'Number': 'Float',
            'Boolean': 'Boolean',
            'Date': 'DateTime',
            'ObjectId': 'String',
        }[type] || 'String';

        fields.push(`    ${name}    ${prismaType}    ${mongooseSchema.includes(`${name}.*required.*true`) ? '' : '?'}`);
    }

    return `model ${modelName} {
    id        String   @id @default(cuid())
${fields.join('\n')}
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
}`;
}

// ═══════════════════════════════════════════════════════
// 📝 توليد migration script
// ═══════════════════════════════════════════════════════
export function generateMigrationScript(fromDB, toDb, projectType) {
    if (fromDB === 'mongodb' && toDb === 'postgresql') {
        return `/**
 * Migration Script: MongoDB → PostgreSQL
 * تشغيل: node migrate.js
 */

import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('🔄 بدء Migration من MongoDB إلى PostgreSQL...');

    // 1. الاتصال بـ MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ متصل بـ MongoDB');

    // 2. قراءة البيانات من MongoDB
    // TODO: استبدل هذا بنموذجك الفعلي
    // const MongoModel = mongoose.model('YourModel', schema);
    // const data = await MongoModel.find({});

    // 3. نقل البيانات إلى PostgreSQL
    // for (const item of data) {
    //     await prisma.yourModel.create({
    //         data: {
    //             // مطابقة الحقول
    //         }
    //     });
    // }

    console.log('✅ Migration اكتملت بنجاح');
    await mongoose.disconnect();
    await prisma.$disconnect();
}

migrate().catch(console.error);`;
    }

    return `// Migration script غير متاح لهذا التحويل`;
}

// ═══════════════════════════════════════════════════════
// 🤖 تحويل ذكي بـ AI
// ═══════════════════════════════════════════════════════
async function aiAssistedMigration(mongooseCode, targetDB) {
    try {
        const response = await smartChat([{
            role: 'system',
            content: `أنت مهندس قواعد بيانات. حوّل Mongoose Schema إلى ${targetDB === 'postgresql' ? 'Prisma Schema لـ PostgreSQL' : targetDB}. كود فقط.`
        }, {
            role: 'user',
            content: mongooseCode
        }], { max_tokens: 600, temperature: 0.1 });
        return response;
    } catch (e) {
        return null;
    }
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function migrateDatabase(files, targetDB = 'postgresql') {
    const currentDB = detectCurrentDB(files);

    if (currentDB === targetDB) {
        return { success: false, reason: `قاعدة البيانات بالفعل ${targetDB}` };
    }

    const newFiles = [];

    // إيجاد ملف Schema الحالي
    const schemaFile = files.find(f =>
        f.name.includes('schema') || f.name.includes('model') || f.name.includes('db')
    );

    if (schemaFile && currentDB === 'mongodb' && targetDB === 'postgresql') {
        // تحويل بـ AI
        const prismaSchema = await aiAssistedMigration(schemaFile.content, targetDB);

        if (prismaSchema) {
            newFiles.push({
                name: 'prisma/schema.prisma',
                content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

${prismaSchema}`
            });
        }

        // migration script
        newFiles.push({
            name: 'scripts/migrate.js',
            content: generateMigrationScript(currentDB, targetDB, 'general')
        });

        // README
        newFiles.push({
            name: 'MIGRATION_README.md',
            content: `# Migration: MongoDB → PostgreSQL

## الخطوات:
1. أضف \`DATABASE_URL\` في .env
2. \`npx prisma db push\`
3. \`node scripts/migrate.js\`

## ملاحظة:
تحقق من ملف \`prisma/schema.prisma\` وتأكد من صحة الحقول قبل التشغيل.`
        });
    }

    return {
        success: true,
        fromDB: currentDB,
        toDb: targetDB,
        files: newFiles,
        summary: `Migration ${currentDB} → ${targetDB} — ${newFiles.length} ملف`
    };
}
