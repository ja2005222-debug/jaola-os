import { groq, smartChat } from './baseAgent.js';

// ============================================================
// 🔍 كلمات مفتاحية تُشير أن المشروع يحتاج خادماً
// ============================================================
const BACKEND_KEYWORDS = [
    // عربي
    'تسجيل دخول', 'حساب', 'مستخدم', 'مستخدمين', 'دفع', 'دفع إلكتروني',
    'حجز', 'حجوزات', 'لوحة تحكم', 'لوحة إدارة', 'قاعدة بيانات',
    'إدارة', 'admin', 'تخزين', 'رفع', 'بيانات', 'سلة', 'طلبات',
    'منتجات', 'مخزون', 'فاتورة', 'اشتراك', 'عضوية', 'تسجيل',
    // إنجليزي
    'login', 'signup', 'register', 'auth', 'authentication',
    'payment', 'checkout', 'cart', 'order', 'orders',
    'dashboard', 'admin', 'database', 'booking', 'reservation',
    'upload', 'inventory', 'subscription', 'members', 'users',
    'api', 'backend', 'server', 'crud', 'store'
];

/**
 * 🔍 يكشف هل المشروع يحتاج خادماً بناءً على وصف المستخدم
 */
export function needsBackend(userGoal) {
    const goal = (userGoal || '').toLowerCase();
    return BACKEND_KEYWORDS.some(kw => goal.includes(kw));
}

// ============================================================
// 🤖 System Prompt لكتابة Vercel Functions
// ============================================================
const BACKEND_SYSTEM_PROMPT = `أنت مهندس Backend متخصص في كتابة Vercel Serverless Functions بـ Node.js.

## قواعد الإخراج الصارمة:

١. استخدم هذا التنسيق الحرفي:
// FILE: api/[اسم].js
[كود الـ function]
// FILE: vercel.json
[إعدادات التوجيه]

٢. كل Function يجب أن:
- تصدّر دالة افتراضية: export default function handler(req, res)
- تتعامل مع CORS: res.setHeader('Access-Control-Allow-Origin', '*')
- تدعم GET وPOST في نفس الـ handler
- تُعيد JSON دائماً

٣. استخدم بيانات وهمية (Mock Data) مدمجة في الكود للبداية
   - لا تستخدم قواعد بيانات خارجية في هذه المرحلة
   - البيانات تُخزَّن في متغيرات داخل الـ function (in-memory)

٤. vercel.json يجب أن يحتوي rewrites لتوجيه /api/* للـ functions

## مثال على Function صحيحة:
// FILE: api/products.js
const products = [
  { id: 1, name: "منتج 1", price: 100 },
];
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, data: products });
  }
  res.status(405).json({ error: 'Method not allowed' });
}`;

// ============================================================
// 🚀 الدالة الرئيسية
// ============================================================
export async function generateBackend(userGoal, frontendContext) {
    const userMessage = `## المشروع:
${userGoal}

## الواجهة الأمامية المبنية (لتعرف ما تحتاجه من APIs):
${frontendContext ? frontendContext.substring(0, 3000) : 'موقع ويب عام'}

## المطلوب:
١. حدد APIs التي يحتاجها هذا الموقع (مثل: /api/products, /api/bookings, /api/auth)
٢. اكتب كل API كـ Vercel Serverless Function منفصلة
٣. أضف بيانات وهمية واقعية ومناسبة للمشروع
٤. اكتب vercel.json لتوجيه الطلبات بشكل صحيح

تذكر: استخدم التنسيق // FILE: api/name.js لكل ملف`;

    try {
        const responseText = await smartChat([
            { role: 'system', content: BACKEND_SYSTEM_PROMPT },
            { role: 'user', content: userMessage }
        ], { max_tokens: 6000, temperature: 0.2 });

        const files = parseBackendFiles(responseText);

        return { success: true, files };
    } catch (error) {
        console.error('[BackendAgent] Error:', error.message);
        return { success: false, error: error.message, files: [] };
    }
}

// ============================================================
// 🔧 Parse ملفات الـ Backend
// ============================================================
function parseBackendFiles(responseText) {
    const files = [];
    const fileRegex = /\/\/\s*FILE:\s*([^\n\r]+)\s*[\n\r]+([\s\S]*?)(?=\/\/\s*FILE:|$)/gi;
    let match;

    while ((match = fileRegex.exec(responseText)) !== null) {
        const name = match[1].trim();
        const content = match[2].trim();
        if (name && content.length > 10) {
            files.push({ name, content });
        }
    }

    // إذا لم يُنتج vercel.json، أضفه تلقائياً
    if (!files.find(f => f.name === 'vercel.json')) {
        const apiFiles = files.filter(f => f.name.startsWith('api/'));
        if (apiFiles.length > 0) {
            files.push({
                name: 'vercel.json',
                content: JSON.stringify({
                    rewrites: [
                        { source: '/api/(.*)', destination: '/api/$1' },
                        { source: '/(.*)', destination: '/index.html' }
                    ]
                }, null, 2)
            });
        }
    }

    return files;
}

// ============================================================
// 📝 تحديث script.js ليستدعي الـ APIs الجديدة
// ============================================================
export async function generateFrontendAPIIntegration(userGoal, apiFiles, currentScript) {
    if (!apiFiles || apiFiles.length === 0) return null;

    const apiList = apiFiles
        .filter(f => f.name.startsWith('api/') && f.name !== 'vercel.json')
        .map(f => `- /${f.name} : ${f.content.substring(0, 200)}`)
        .join('\n');

    const userMessage = `لديك هذه الـ APIs:
${apiList}

الكود الحالي للـ script.js:
${(currentScript || '').substring(0, 2000)}

المطلوب: اكتب كود JavaScript يستدعي هذه الـ APIs ويعرض البيانات في الصفحة.
استخدم fetch() وأضف loading states وmessages للأخطاء.
أخرج الكود مباشرة بدون تنسيق // FILE:`;

    try {
        return await smartChat([
            { role: 'system', content: 'أنت مطور Frontend متخصص في استدعاء APIs بـ JavaScript. اكتب كوداً نظيفاً يستدعي الـ APIs المعطاة.' },
            { role: 'user', content: userMessage }
        ], { max_tokens: 3000, temperature: 0.2 });
    } catch (e) {
        return null;
    }
}
