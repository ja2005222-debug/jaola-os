# دليل النشر

## متغيرات البيئة المطلوبة
- `NODE_ENV`: production
- `PORT`: 3000
- `DATABASE_URL`: مسار قاعدة البيانات (مثال: sqlite:///data/tasks.db)
- `JWT_SECRET`: مفتاح سري لـ JWT
- `SESSION_SECRET`: مفتاح سري للجلسات

## النشر على Render
1. ارفع الكود إلى GitHub.
2. في Render، أنشئ خدمة Web Service جديدة واربط المستودع.
3. اضبط أمر البناء: `npm ci` وأمر البدء: `node server.js`.
4. أضف متغيرات البيئة أعلاه.
5. أنشئ مفتاح API من Render وأضفه إلى GitHub Secrets.

## النشر على Railway
1. ارفع الكود إلى GitHub.
2. في Railway، أنشئ مشروع جديد واربط المستودع.
3. أضف متغيرات البيئة.
4. سيتم النشر تلقائياً.

## النشر على VPS
1. انسخ الملفات إلى الخادم.
2. ثبت Docker و Docker Compose.
3. أنشئ ملف `.env` بالمتغيرات.
4. شغل: `docker-compose up -d`.

## فحص الصحة
بعد النشر، تأكد من أن نقطة `/health` تعيد 200.