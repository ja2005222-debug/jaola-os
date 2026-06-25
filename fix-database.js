import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data/jaola.db');

// التأكد من وجود مجلد data
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// فتح قاعدة البيانات (أو إنشائها)
const db = new Database(DB_PATH);

console.log('✅ Database opened');

// قراءة هيكل جدول projects
const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
console.log('\n📋 Current columns in "projects":');
console.table(tableInfo.map(col => ({ name: col.name, type: col.type })));

// التحقق من وجود عمود userId
const hasUserId = tableInfo.some(col => col.name === 'userId');

if (!hasUserId) {
    console.log('\n⚠️ Column "userId" is missing. Adding it now...');
    db.exec("ALTER TABLE projects ADD COLUMN userId TEXT;");
    console.log('✅ Column "userId" added successfully.');
} else {
    console.log('\n✅ Column "userId" already exists.');
}

// التحقق من جدول tasks
const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all();
console.log('\n📋 Current columns in "tasks":');
console.table(tasksInfo.map(col => ({ name: col.name, type: col.type })));

// التحقق من وجود أي مشاريع حالياً
const projects = db.prepare("SELECT * FROM projects").all();
console.log(`\n📁 Projects in database: ${projects.length}`);
if (projects.length > 0) {
    console.log('Projects:', projects.map(p => ({ id: p.id, name: p.name, active: p.active, userId: p.userId })));
}

console.log('\n✅ Database fix completed.');
db.close();
