import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحديد مسار قاعدة البيانات ليكون ثابتاً داخل مجلد backend
const dbPath = path.resolve(__dirname, '../jaola_os.db');

/**
 * الحصول على اتصال نشط بقاعدة البيانات
 */
export function getDb() {
    return new Database(dbPath);
}

/**
 * تهيئة قاعدة البيانات وإنشاء الجداول الأساسية
 */
export function initDb() {
    const db = getDb();
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            userId TEXT DEFAULT 'system',
            mission TEXT,
            plan TEXT,
            status TEXT,
            updatedAt DATETIME
        )
    `);
    console.log(`[Database] Table 'projects' verified and initialized successfully at: ${dbPath}`);
}

/**
 * حفظ أو تحديث بيانات مشروع داخل قاعدة البيانات
 * @param {Object} data - بيانات المشروع الأساسية
 */
export function saveProject(data) {
    const db = getDb();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO projects (id, userId, mission, plan, status, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
        data.id, 
        data.userId || 'system', 
        data.mission, 
        JSON.stringify(data.plan), 
        data.status, 
        data.updatedAt || new Date().toISOString()
    );
}

// تصدير افتراضي لدعم نمط الاستيراد المباشر في server.js
export default initDb;
