/**
 * 🎨 صور حقيقية بالذكاء — طبقة اختيارية فوق عقد imageForge.
 *
 * imageForge يضمن صورة SVG حتمية دائماً؛ هذه الطبقة تستبدلها بصور AI حقيقية
 * حين يتوفر مفتاح مزوّد الصور (OPENAI_API_KEY). غير مُفعّلة → لا شيء ينكسر:
 * الموقع يبقى بصوره الحتمية، والمستخدم يرى سبب عدم التفعيل بوضوح.
 */

import { primarySeedArray, spliceSeed, validateSeedLiteral } from '../agents/seedStamp.js';
import { patchImgUrlPassthrough } from '../agents/imageForge.js';

const MAX_PER_CALL = 8;
const GEN_SVG_RE = /^images\/gen-[\w-]+\.svg$/;

/** مزوّد الصور الفعّال: Gemini (Imagen) أولاً إن وُجد مفتاحه، ثم OpenAI. */
export function imageProviderOf(env = process.env) {
    const forced = (env.IMAGE_PROVIDER || '').toLowerCase();
    if (forced === 'gemini' || forced === 'openai') return env[forced === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'] ? forced : null;
    if (env.GEMINI_API_KEY) return 'gemini';
    if (env.OPENAI_API_KEY) return 'openai';
    return null;
}

export function aiImagesReady(env = process.env) {
    return !!imageProviderOf(env);
}

/**
 * يولّد صورة واحدة عبر مزوّد الصور المتاح. يعيد {ok,buf,ext} أو {error}.
 * - Gemini: Imagen عبر :predict (يتطلب Tier مدفوعاً — نفس مفتاح GEMINI_API_KEY)
 * - OpenAI: images/generations
 */
export async function generateProductImage(prompt, deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    const provider = imageProviderOf(env);
    if (!provider) {
        return { error: 'مزوّد الصور غير مُفعّل — اضبط GEMINI_API_KEY (يفتح Imagen) أو OPENAI_API_KEY.', notConfigured: true };
    }
    const cleanPrompt = String(prompt || '').slice(0, 900);
    try {
        if (provider === 'gemini') {
            const model = env.IMAGE_MODEL_GEMINI || 'imagen-3.0-generate-002';
            const r = await fetchImpl(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [{ prompt: cleanPrompt }],
                        parameters: { sampleCount: 1, aspectRatio: '1:1' },
                    }),
                });
            const d = await r.json().catch(() => ({}));
            const b64 = d?.predictions?.[0]?.bytesBase64Encoded;
            if (!r.ok || !b64) return { error: `فشل توليد الصورة عبر Imagen (${d?.error?.message || r.status}).` };
            return { ok: true, buf: Buffer.from(b64, 'base64'), ext: 'png' };
        }
        const r = await fetchImpl('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: env.IMAGE_MODEL || 'gpt-image-1',
                prompt: cleanPrompt,
                size: '1024x1024',
                n: 1,
            }),
        });
        const d = await r.json().catch(() => ({}));
        const b64 = d?.data?.[0]?.b64_json;
        if (!r.ok || !b64) return { error: `فشل توليد الصورة (${d?.error?.message || r.status}).` };
        return { ok: true, buf: Buffer.from(b64, 'base64'), ext: 'png' };
    } catch (e) {
        return { error: 'تعذّر الوصول لمزوّد الصور: ' + e.message };
    }
}

/**
 * يستبدل صور العناصر الحتمية (SVG المولّدة أو الفارغة) بصور AI في مصفوفة
 * البيانات الرئيسية. genFn قابلة للحقن للاختبار. الصور الحقيقية الموجودة
 * (روابط/ملفات المستخدم) لا تُمسّ أبداً. بنفس حارس بنية البصمة.
 *
 * يعيد {changed, count, appJs, images:[{name, buf}]} — الكتابة للقرص مسؤولية المستدعي.
 */
export async function applyAiImages(files = [], { goal = '', maxCount = MAX_PER_CALL } = {}, genFn = generateProductImage) {
    const app = files.find(f => f.name === 'app.js');
    if (!app) return { changed: false, reason: 'لا app.js' };
    const seedArr = primarySeedArray(app.content);
    if (!seedArr) return { changed: false, reason: 'لا مصفوفة بيانات' };

    let items;
    try {
        // eslint-disable-next-line no-new-func
        items = Function('"use strict";return (' + seedArr.literal + ');')();
    } catch { return { changed: false, reason: 'تعذّر قراءة البيانات' }; }
    if (!Array.isArray(items) || !items.length) return { changed: false, reason: 'بيانات فارغة' };

    // العناصر المؤهّلة: img فارغ أو SVG مولّد — صور المستخدم الحقيقية لا تُمسّ
    const targets = [];
    const collect = (obj, key) => {
        if ('img' in obj && (obj.img === '' || GEN_SVG_RE.test(String(obj.img)))) {
            targets.push({ obj, key, label: obj.name || obj.title || obj.city || '' });
        }
    };
    items.forEach((item, i) => {
        if (!item || typeof item !== 'object') return;
        const id = String(item.id || i);
        collect(item, id);
        for (const [k, v] of Object.entries(item)) {
            if (!Array.isArray(v)) continue;
            v.forEach((sub, j) => { if (sub && typeof sub === 'object') collect(sub, `${id}-${k}-${String(sub.id || j)}`); });
        }
    });
    if (!targets.length) return { changed: false, reason: 'لا عناصر مؤهّلة' };

    const images = [];
    let count = 0;
    for (const t of targets.slice(0, Math.max(0, Math.min(maxCount, MAX_PER_CALL)))) {
        const prompt = `${t.label} — ${goal}. Professional product photo, clean simple background, no text or watermark.`;
        const r = await genFn(prompt);
        if (r?.notConfigured) return { changed: false, notConfigured: true, reason: r.error };
        if (!r?.ok || !r.buf) continue; // فشل صورة واحدة لا يفشل الدفعة
        const fileName = `images/ai-${t.key}.${r.ext || 'png'}`;
        images.push({ name: fileName, buf: r.buf });
        t.obj.img = fileName;
        count++;
    }
    if (!count) return { changed: false, reason: 'لم تُولَّد أي صورة' };

    const newLit = '[\n  ' + items.map(o => JSON.stringify(o)).join(',\n  ') + '\n]';
    if (!validateSeedLiteral(newLit, seedArr.literal)) return { changed: false, reason: 'حارس البنية رفض التعديل' };

    let js = spliceSeed(app.content, seedArr, newLit);
    js = patchImgUrlPassthrough(js).js;
    return { changed: true, count, appJs: js, images };
}
