# delev

تطبيق **Full-Stack** (منصة SaaS) مبني بـ Next.js (App Router) + API Routes + Prisma.

## التشغيل
```bash
npm install
cp .env.example .env      # عدّل DATABASE_URL إن لزم
npx prisma db push        # إنشاء قاعدة البيانات
npm run db:seed           # بيانات أولية
npm run dev               # http://localhost:3000
```

## نقاط الـ API
- `GET/POST /api/accounts` · `GET/PUT/DELETE /api/accounts/[id]`
- `GET/POST /api/subscriptions` · `GET/PUT/DELETE /api/subscriptions/[id]`

## البنية
- `prisma/schema.prisma` — نماذج البيانات
- `app/api/*/route.js` — نقاط الـ API
- `app/page.js` — الصفحة الرئيسية
- `lib/prisma.js` — عميل Prisma

مُولّد بواسطة JAOLA OS.
