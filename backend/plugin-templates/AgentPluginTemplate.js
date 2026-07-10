/**
 * 🧩 Agent Plugin Template — قالب إضافة وكيل
 *
 * انسخ هذا الملف إلى backend/plugins/ وعدّله لبناء إضافة جديدة.
 * الملفات داخل plugin-templates/ لا تُحمّل (تبدأ الأسماء التي تُحمّل بحرف عادي
 * في مجلد plugins/ فقط).
 *
 * الإضافة تُصدّر manifest افتراضياً. أنواعها: 'agent' | 'hook' | 'service'.
 */

export default {
    name: 'example-agent',              // اسم فريد — إلزامي
    version: '1.0.0',
    type: 'agent',                      // 'agent' يسجّل وكيلاً قابلاً للاستدعاء
    description: 'إضافة مثال توضّح واجهة الوكلاء',
    enabled: true,

    hooks: {
        // يُستدعى مرة عند تحميل الإضافة
        async onLoad({ orchestrator }) {
            // تهيئة اختيارية (تحميل موارد، تسجيل إعدادات...)
            // console.log(`[example-agent] loaded, siblings: ${orchestrator.plugins.size}`);
        },

        // إضافات النوع 'agent' تُرجع { name, handler } ليُسجَّل الوكيل
        async registerAgent() {
            return {
                name: 'exampleAgent',
                // handler يُستدعى عبر orchestrator.getAgent('exampleAgent')(input)
                handler: async (input = {}) => {
                    return { ok: true, echo: input, agent: 'example-agent' };
                },
            };
        },

        // hooks اختيارية حول دورة البناء — تُستدعى تلقائياً إن وُجدت
        async beforeBuild({ goal, username, project } = {}) {
            // عدّل السياق أو سجّل قبل البناء. أرجع كائناً ليُجمع في النتائج.
            return { note: `example-agent saw build for ${project}` };
        },

        async afterBuild({ success, project } = {}) {
            // تنظيف/إشعار بعد البناء
            return { acknowledged: success };
        },
    },
};
