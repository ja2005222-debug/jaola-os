# Architecture Document

## Overview
تطبيق ويب لإدارة المهام الشخصية (To-Do List) مع واجهة أمامية تفاعلية. الخلفية بسيطة لتخزين المهام واسترجاعها.

## Architecture Pattern
**Monolith (Modular)** – تطبيق صغير، لا حاجة لتعقيد microservices. كل الكود في مشروع واحد مع فصل منطقي للوحدات.

## Technology Stack
- **Runtime:** Node.js (LTS) – بيئة جافا سكريبت خفيفة وسريعة.
- **Framework:** Express.js – إطار عمل بسيط ومرن، مناسب للحجم الصغير.
- **Database:** SQLite (via better-sqlite3) – قاعدة بيانات ملفية لا تحتاج خادم، سهلة النشر.
- **Cache:** غير مطلوب حالياً (يمكن إضافة Redis لاحقاً).
- **Queue:** غير مطلوب.
- **Deployment:** Render/Railway – يدعمان Node.js و SQLite بسهولة.

## Modules / Services
1. **Tasks API** – CRUD للمهام.
   - `GET /api/tasks` – قائمة المهام (مع فلترة اختيارية).
   - `POST /api/tasks` – إضافة مهمة.
   - `PUT /api/tasks/:id` – تحديث مهمة (نص، حالة، تاريخ).
   - `DELETE /api/tasks/:id` – حذف مهمة.
2. **Frontend** – ملفات ثابتة (HTML, CSS, JS) تخدم من Express.

## Data Contracts
### Task Object
```json
{
  "id": 1,
  "title": "شراء البقالة",
  "completed": false,
  "dueDate": "2023-12-20",
  "createdAt": "2023-12-19T10:00:00Z"
}
```

### API Responses
- `GET /api/tasks` → `{ tasks: Task[] }`
- `POST /api/tasks` → `{ task: Task }` (201)
- `PUT /api/tasks/:id` → `{ task: Task }`
- `DELETE /api/tasks/:id` → `{ message: "deleted" }` (200)

## Deployment Requirements
- Node.js 18+
- SQLite (ملف db.sqlite ينشأ تلقائياً)
- متغيرات البيئة: `PORT` (افتراضي 3000)
- نشر على Render: خدمة Web Service، build command: `npm install`، start command: `node server.js`

## Scalability
- يمكن ترقية SQLite إلى PostgreSQL عند الحاجة.
- يمكن إضافة Redis للـ cache إذا زاد الحمل.
- يمكن فصل frontend إلى CDN.
