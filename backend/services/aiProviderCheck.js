/**
 * 🔌 فاحص مزوّدي الذكاء الحيّ — يحوّل «ما عارف ليه ما يشتغل» إلى لوحة واضحة.
 *
 * لكل مزوّد: هل مفتاحه مضبوط؟ (بذيله المقنّع فتعرف أيّ مفتاح يقرأه الخادم
 * فعلاً) وهل يقبل الاستدعاء الآن؟ وما رصيد DeepSeek الفعلي (نقطة /user/balance
 * الرسمية). لا يُعاد أي مفتاح خاماً أبداً — الذيل الأخير فقط.
 */

import { DEEPSEEK_MODEL } from '../core/providers/llm.js';
import { GEMINI_IMAGE_MODELS } from './aiImages.js';

const mask = (key) => (key ? `…${String(key).slice(-4)}` : null);

async function probe(fetchImpl, url, headers = {}) {
    try {
        const r = await fetchImpl(url, { headers });
        const body = await r.json().catch(() => ({}));
        return { status: r.status, ok: r.ok, body };
    } catch (e) {
        return { status: 0, ok: false, body: {}, netError: e.message };
    }
}

const fail = (p, name) =>
    p.netError ? `تعذّر الوصول (${p.netError})`
        : p.status === 401 || p.status === 403 ? `المفتاح مرفوض (${p.status}) — تحقق من صحته في لوحة ${name}`
        : p.status === 429 ? 'المفتاح صحيح لكن بضغط/حصة (429)'
        : `فشل الفحص (${p.status})`;

export async function checkAiProviders(deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    const out = {};

    // ── Groq ──
    if (!env.GROQ_API_KEY) out.groq = { configured: false };
    else {
        const p = await probe(fetchImpl, 'https://api.groq.com/openai/v1/models', { Authorization: `Bearer ${env.GROQ_API_KEY}` });
        out.groq = { configured: true, keyTail: mask(env.GROQ_API_KEY), ok: p.ok, detail: p.ok ? `يعمل (${p.body?.data?.length || 0} موديلاً)` : fail(p, 'Groq') };
    }

    // ── DeepSeek: صلاحية + الرصيد الفعلي + صحّة الموديل المضبوط ──
    // (درس مدفوع الثمن: أسماء موديلاتهم تتغيّر — coder ثم chat ثم v4 —
    //  والفحص هنا يكشف الموديل الملغى فوراً بدل فشل صامت في البناء)
    if (!env.DEEPSEEK_API_KEY) out.deepseek = { configured: false };
    else {
        const auth = { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` };
        const p = await probe(fetchImpl, 'https://api.deepseek.com/user/balance', auth);
        if (p.ok) {
            const b = (p.body?.balance_infos || [])[0];
            const balance = b ? `${b.total_balance} ${b.currency}` : null;
            // تحقق الموديل من قائمة موديلاتهم الرسمية
            const models = await probe(fetchImpl, 'https://api.deepseek.com/models', auth);
            const ids = (models.body?.data || []).map(m => m.id);
            const modelOk = !models.ok || ids.length === 0 ? null : ids.includes(DEEPSEEK_MODEL);
            out.deepseek = {
                configured: true, keyTail: mask(env.DEEPSEEK_API_KEY),
                ok: p.body?.is_available !== false && modelOk !== false,
                balance, model: DEEPSEEK_MODEL,
                detail: p.body?.is_available === false
                    ? 'المفتاح صحيح لكن الرصيد غير كافٍ للاستدعاءات'
                    : modelOk === false
                        ? `المفتاح والرصيد سليمان لكن الموديل «${DEEPSEEK_MODEL}» غير مدعوم — المدعوم: ${ids.join('، ')}. اضبط DEEPSEEK_MODEL.`
                        : `يعمل (${DEEPSEEK_MODEL}) — الرصيد: ${balance || 'غير معروف'}`,
            };
        } else {
            out.deepseek = { configured: true, keyTail: mask(env.DEEPSEEK_API_KEY), ok: false, detail: fail(p, 'DeepSeek') };
        }
    }

    // ── Gemini: صلاحية المفتاح + أيّ نماذج صور متاحة عليه فعلاً ──
    if (!env.GEMINI_API_KEY) out.gemini = { configured: false };
    else {
        const p = await probe(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(env.GEMINI_API_KEY)}`);
        if (p.ok) {
            const names = (p.body?.models || []).map(m => String(m.name || '').replace(/^models\//, ''));
            const ladder = env.IMAGE_MODEL_GEMINI ? [env.IMAGE_MODEL_GEMINI] : GEMINI_IMAGE_MODELS;
            const imageModels = ladder.filter(m => names.includes(m));
            out.gemini = {
                configured: true, keyTail: mask(env.GEMINI_API_KEY), ok: true, imageModels,
                detail: `يعمل (${names.length} موديلاً)` + (names.length === 0 ? ''
                    : imageModels.length
                        ? ` — نماذج الصور المتاحة: ${imageModels.join('، ')}`
                        : ` — ⚠️ لا يظهر أي نموذج صور من سلّمنا (${ladder.join('، ')}) على هذا المفتاح`),
            };
        } else {
            out.gemini = { configured: true, keyTail: mask(env.GEMINI_API_KEY), ok: false, detail: fail(p, 'Google AI Studio') };
        }
    }

    // ── OpenAI ──
    if (!env.OPENAI_API_KEY) out.openai = { configured: false };
    else {
        const p = await probe(fetchImpl, 'https://api.openai.com/v1/models', { Authorization: `Bearer ${env.OPENAI_API_KEY}` });
        out.openai = { configured: true, keyTail: mask(env.OPENAI_API_KEY), ok: p.ok, detail: p.ok ? 'يعمل' : fail(p, 'OpenAI') };
    }

    return out;
}
