/**
 * 🛡️ Security Layer — JAOLA OS
 *
 * - sanitizePath: حارس Path Traversal يدعم المسارات المتداخلة (css/styles.css)
 * - schemas: مخططات Zod للتحقق من مدخلات المسارات الحساسة
 * - validate: middleware عام يطبق أي مخطط Zod على req.body
 *
 * ملاحظة: الـ Rate Limiters معرّفة في server.js (aiLimit / generalLimit)
 * لأنها تعتمد على req.user — لا حاجة لتكرارها هنا.
 */

import { z } from 'zod';
import path from 'path';

// ─── Path Traversal Guard ───────────────────────────────────────────
// يُرجع المسار المطلق الآمن داخل projectRoot أو يرمي خطأ.
// يدعم المسارات الفرعية (مثل assets/logo.svg) بعكس path.basename.
export const sanitizePath = (filePath, projectRoot) => {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid path: Path must be a non-empty string');
    }

    // رفض المسارات المطلقة و null bytes مبكراً
    if (filePath.includes('\0') || path.isAbsolute(filePath)) {
        throw new Error('Path traversal detected');
    }

    const root = path.resolve(projectRoot);
    const resolved = path.resolve(root, filePath);

    // المقارنة مع فاصل المسار — تمنع تجاوز البادئة (مثل /project-evil مقابل /project)
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error('Access denied: Path outside project scope');
    }

    return resolved;
};

// ─── Zod Validation Schemas ─────────────────────────────────────────
// ملاحظة: حقل project يبقى ضمن المخططات لأن validateProjectOwnership
// في server.js يقرأه من req.body بعد التحقق.
const projectField = z.string().max(100).optional();

export const schemas = {
    sendMessage: z.object({
        message: z.string().min(1, 'الرسالة فارغة.').max(10000, 'الرسالة أطول من المسموح.'),
        project: projectField,
        uiLang: z.string().max(5).optional(),   // لغة الواجهة — بذرة لكشف لغة الرد
    }),

    saveFile: z.object({
        fileName: z.string().min(1).max(500),
        content: z.string().max(2_000_000, 'حجم الملف أكبر من المسموح.'),
        project: projectField,
    }),

    githubConnect: z.object({
        pat: z.string().min(10, 'التوكن قصير جداً.').max(400).optional(),
        repoUrl: z.string().url('رابط المستودع غير صالح.')
            .refine(u => u.startsWith('https://'), 'يجب أن يبدأ الرابط بـ https://')
            .optional(),
        branch: z.string().max(100).regex(/^[\w\-\/\.]+$/, 'اسم الفرع غير صالح.').default('main'),
        autoCommit: z.boolean().default(true),
        project: projectField,
    }),

    githubPush: z.object({
        repoUrl: z.string().url().optional(),
        branch: z.string().max(100).regex(/^[\w\-\/\.]+$/).optional(),
        project: projectField,
    }),

    abortMission: z.object({
        project: projectField,
    }),
};

// ─── Validate Middleware ────────────────────────────────────────────
export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.issues.map(i => ({
                path: i.path.join('.'),
                message: i.message,
            })),
        });
    }
    req.body = result.data;
    next();
};
