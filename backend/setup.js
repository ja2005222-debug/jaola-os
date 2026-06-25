import Database from 'better-sqlite3';
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
   console.log("الجدول تم إنشاؤه بنجاح!");
   db.close();
