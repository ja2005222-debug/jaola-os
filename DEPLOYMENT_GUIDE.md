# دليل النشر

## متغيرات البيئة المطلوبة
- `DATABASE_URL`: رابط قاعدة البيانات (SQLite أو PostgreSQL)
- `JWT_SECRET`: مفتاح JWT السري
- `STRIPE_SECRET_KEY`: مفتاح Stripe السري للدفع
- `NODE_ENV`: يضبط إلى `production` في الإنتاج

## النشر على Render
1. ارفع الكود إلى GitHub.
2. في Render، أنشئ خدمة جديدة من مستودع GitHub.
3. اضبط أمر البناء: `docker build -t myapp .`
4. اضبط أمر التشغيل: `docker run -p 3000:3000 myapp`
5. أضف متغيرات البيئة أعلاه.
6. أنشئ مفتاح API في Render وأضفه إلى GitHub Secrets (`RENDER_API_KEY`, `RENDER_SERVICE_ID`).
7. سيتم النشر تلقائياً عند الدفع إلى main.

## النشر على Railway
1. اربط مستودع GitHub بمشروع Railway.
2. Railway سيكتشف Dockerfile تلقائياً.
3. أضف متغيرات البيئة في لوحة التحكم.
4. سيتم النشر تلقائياً.

## النشر على VPS
1. انسخ الملفات إلى الخادم.
2. شغّل `docker-compose up -d`.
3. تأكد من أن المنفذ 3000 مفتوح.
4. استخدم reverse proxy (مثل Nginx) لتوجيه النطاق.

## فحص الصحة
- بعد النشر، اختبر `https://yourdomain.com/health` — يجب أن يعيد `{"status":"ok"}`.