/**
 * 🔌 فاحص مزوّدي الذكاء الحيّ — يحوّل «ما عارف ليه ما يشتغل» إلى لوحة واضحة.
 *
 * لكل مزوّد: هل مفتاحه مضبوط؟ (بذيله المقنّع فتعرف أيّ مفتاح يقرأه الخادم
 * فعلاً) وهل يقبل الاستدعاء الآن؟ وما رصيد DeepSeek الفعلي (نقطة /user/balance
 * الرسمية). لا يُعاد أي مفتاح خاماً أبداً — الذيل الأخير فقط.
 */

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

    // ── DeepSeek: صلاحية + الرصيد الفعلي ──
    if (!env.DEEPSEEK_API_KEY) out.deepseek = { configured: false };
    else {
        const p = await probe(fetchImpl, 'https://api.deepseek.com/user/balance', { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` });
        if (p.ok) {
            const b = (p.body?.balance_infos || [])[0];
            out.deepseek = {
                configured: true, keyTail: mask(env.DEEPSEEK_API_KEY), ok: p.body?.is_available !== false,
                balance: b ? `${b.total_balance} ${b.currency}` : null,
                detail: p.body?.is_available === false
                    ? 'المفتاح صحيح لكن الرصيد غير كافٍ للاستدعاءات'
                    : `يعمل — الرصيد: ${b ? `${b.total_balance} ${b.currency}` : 'غير معروف'}`,
            };
        } else {
            out.deepseek = { configured: true, keyTail: mask(env.DEEPSEEK_API_KEY), ok: false, detail: fail(p, 'DeepSeek') };
        }
    }

    // ── Gemini ──
    if (!env.GEMINI_API_KEY) out.gemini = { configured: false };
    else {
        const p = await probe(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.GEMINI_API_KEY)}`);
        out.gemini = { configured: true, keyTail: mask(env.GEMINI_API_KEY), ok: p.ok, detail: p.ok ? 'يعمل' : fail(p, 'Google AI Studio') };
    }

    // ── OpenAI ──
    if (!env.OPENAI_API_KEY) out.openai = { configured: false };
    else {
        const p = await probe(fetchImpl, 'https://api.openai.com/v1/models', { Authorization: `Bearer ${env.OPENAI_API_KEY}` });
        out.openai = { configured: true, keyTail: mask(env.OPENAI_API_KEY), ok: p.ok, detail: p.ok ? 'يعمل' : fail(p, 'OpenAI') };
    }

    return out;
}
