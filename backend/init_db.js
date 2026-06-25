import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('jaola_os.db');

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

console.log("Database table 'projects' created successfully.");
db.close();
```

### 3. التنفيذ
تأكد أن لديك `better-sqlite3` مثبتة، ثم قم بتشغيل السكربت:
```bash
node init_db.js
```

**بعد تشغيل هذا السكربت:**
1. إذا طبع لك `Database table 'projects' created successfully.`، فهذا يعني أن الجدول أصبح موجوداً الآن.
2. جرب الآن أمر الاستعلام (أو جرب تشغيل السيرفر):
   ```bash
   sqlite3 jaola_os.db ".tables"
   ```
   *يجب أن يظهر لك كلمة `projects`.*

### 4. ملاحظة هامة جداً لملف `services/db.js`
يجب أن يكون ملفك في `backend/services/db.js` **خالياً تماماً** من أي كود لسيرفر الـ Express. تأكد أنه يبدو هكذا فقط:

```javascript:Clean Database Service:backend/services/db.js
import Database from 'better-sqlite3';
import path from 'path';

// نستخدم مسار مطلق لضمان الوصول دائماً لنفس الملف
const dbPath = path.join(process.cwd(), 'jaola_os.db');

export function getDb() {
    const db = new Database(dbPath);
    return db;
}

export function saveProject(data) {
    const db = getDb();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO projects (id, userId, mission, plan, status, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(data.id, data.userId || 'system', data.mission, JSON.stringify(data.plan), data.status, data.updatedAt || new Date().toISOString());
}
```

قم بتنفيذ هذه الخطوات وأخبرني: **هل ظهرت كلمة `projects` بعد تنفيذ أمر `sqlite3 jaola_os.db ".tables"`؟** هذا سيؤكد لنا أن القاعدة جاهزة للاستقبال.
