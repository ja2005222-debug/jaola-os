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

/** مزوّد الصور الفعّال: Gemini (صور Gemini/Nano Banana) أولاً إن وُجد مفتاحه، ثم OpenAI. */
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

/** سلّم نماذج Gemini للصور — يُجرَّب بالترتيب حتى ينجح أحدها (أسماء Google تتغير). */
export const GEMINI_IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image', 'imagen-4.0-generate-001'];
const MODEL_GONE_RE = /not found|not supported|does not exist|unknown model|deprecated|NOT_FOUND/i;
const KEY_BAD_RE = /api.?key|invalid authentication|unauthorized|PERMISSION_DENIED|UNAUTHENTICATED/i;

/** استدعاء نموذج Gemini واحد — imagen عبر :predict والبقية عبر :generateContent. */
async function callGeminiImageModel(model, prompt, env, fetchImpl) {
    const key = encodeURIComponent(env.GEMINI_API_KEY);
    if (/^imagen/i.test(model)) {
        const r = await fetchImpl(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: { sampleCount: 1, aspectRatio: '1:1' },
                }),
            });
        const d = await r.json().catch(() => ({}));
        const b64 = d?.predictions?.[0]?.bytesBase64Encoded;
        if (!r.ok || !b64) return { error: `فشل توليد الصورة عبر ${model} (${d?.error?.message || r.status}).` };
        return { ok: true, buf: Buffer.from(b64, 'base64'), ext: 'png' };
    }
    const r = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseModalities: ['IMAGE'] },
            }),
        });
    const d = await r.json().catch(() => ({}));
    const part = d?.candidates?.[0]?.content?.parts?.find(p => p?.inlineData?.data);
    if (!r.ok || !part) {
        const why = d?.error?.message || d?.candidates?.[0]?.finishReason || r.status;
        return { error: `فشل توليد الصورة عبر ${model} (${why}).` };
    }
    const ext = /jpe?g/i.test(part.inlineData.mimeType || '') ? 'jpg' : 'png';
    return { ok: true, buf: Buffer.from(part.inlineData.data, 'base64'), ext };
}

/**
 * يولّد صورة واحدة عبر مزوّد الصور المتاح. يعيد {ok,buf,ext} أو {error}.
 * - Gemini: يجرّب سلّم النماذج بالترتيب (نفس مفتاح GEMINI_API_KEY)؛ اسم غير
 *   موجود → التالي، مفتاح مرفوض → توقّف فوري برسالة إرشادية، وأي خطأ آخر
 *   (حصة/حجب أمان) يُعاد كما هو. فرض IMAGE_MODEL_GEMINI يقصر السلّم على اسمه.
 * - OpenAI: images/generations
 */
export async function generateProductImage(prompt, deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    const provider = imageProviderOf(env);
    if (!provider) {
        return { error: 'مزوّد الصور غير مُفعّل — اضبط GEMINI_API_KEY (يفتح صور Gemini) أو OPENAI_API_KEY.', notConfigured: true };
    }
    const cleanPrompt = String(prompt || '').slice(0, 900);
    try {
        if (provider === 'gemini') {
            const candidates = env.IMAGE_MODEL_GEMINI ? [env.IMAGE_MODEL_GEMINI] : GEMINI_IMAGE_MODELS;
            let last = null;
            for (const model of candidates) {
                const r = await callGeminiImageModel(model, cleanPrompt, env, fetchImpl);
                if (r.ok) return r;
                last = r;
                if (KEY_BAD_RE.test(r.error)) {
                    return { error: `مفتاح GEMINI_API_KEY نفسه مرفوض من Google — جدّده من aistudio.google.com/apikey وحدّثه في بيئة الخادم. (${r.error})` };
                }
                if (!MODEL_GONE_RE.test(r.error)) return r; // خطأ لا علاقة له باسم النموذج — تبديل الاسم لن يفيد
            }
            return last;
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
 * يثبّت صورة بنر مولّدة كخلفية لقسم الـ hero في index.html.
 * يستهدف أول عنصر فئته تحتوي hero/banner، وإلا أول <section>.
 * خلفية سابقة (لون/تدرّج/صورة) داخل style تُستبدل؛ بقية الأنماط تبقى.
 */
export function applyHeroImage(html, imgPath) {
    const src = String(html || '');
    const m = src.match(/<(section|div|header)\b([^>]*class=["'][^"']*(?:hero|banner)[^"']*["'][^>]*)>/i)
        || src.match(/<(section)\b((?:\s[^>]*)?)>/i);
    if (!m) return { changed: false, reason: 'لا قسم بنر (hero) في الصفحة' };
    const [full, tag, attrs] = m;
    const bg = `background-image:url('${imgPath}');background-size:cover;background-position:center;`;
    const newAttrs = /style\s*=\s*["']/i.test(attrs)
        ? attrs.replace(/style\s*=\s*(["'])(.*?)\1/i, (s, q, css) => {
            const kept = css.replace(/background(?:-image)?\s*:[^;]*;?/gi, '').replace(/;?\s*$/, '');
            return `style=${q}${kept ? kept + ';' : ''}${bg}${q}`;
        })
        : `${attrs} style="${bg}"`;
    return { changed: true, html: src.replace(full, `<${tag}${newAttrs}>`) };
}

/**
 * يستبدل صور العناصر الحتمية (SVG المولّدة أو الفارغة) بصور AI في مصفوفة
 * البيانات الرئيسية. genFn قابلة للحقن للاختبار. الصور الحقيقية الموجودة
 * (روابط/ملفات المستخدم) لا تُمسّ أبداً. بنفس حارس بنية البصمة.
 *
 * يعيد {changed, count, appJs, images:[{name, buf}]} — الكتابة للقرص مسؤولية المستدعي.
 */
export async function applyAiImages(files = [], { goal = '', maxCount = MAX_PER_CALL, targetLabel = '' } = {}, genFn = generateProductImage) {
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

    // العناصر المؤهّلة: img فارغ أو SVG مولّد — صور المستخدم الحقيقية لا تُمسّ.
    // استثناء: تسمية عنصر صراحةً («غير صورة مؤتمرات») = موافقة على استبدال
    // صورته أيّاً كانت — لكن العنصر المسمّى وحده، لا غيره.
    const wanted = String(targetLabel || '').replace(/^ال/, '');
    const targets = [];
    const collect = (obj, key) => {
        if (!('img' in obj)) return;
        const label = obj.name || obj.title || obj.city || '';
        if (wanted) {
            const l = String(label).replace(/^ال/, '');
            if (l && (l.includes(wanted) || wanted.includes(l))) targets.push({ obj, key, label });
        } else if (obj.img === '' || GEN_SVG_RE.test(String(obj.img))) {
            targets.push({ obj, key, label });
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
    if (!targets.length) {
        return { changed: false, reason: wanted ? `لم أجد عنصراً باسم «${targetLabel}» في بيانات الموقع` : 'لا عناصر مؤهّلة' };
    }

    const images = [];
    let count = 0;
    let lastError = '';
    for (const t of targets.slice(0, Math.max(0, Math.min(maxCount, MAX_PER_CALL)))) {
        const prompt = `${t.label} — ${goal}. Professional product photo, clean simple background, no text or watermark.`;
        const r = await genFn(prompt);
        if (r?.notConfigured) return { changed: false, notConfigured: true, reason: r.error };
        if (!r?.ok || !r.buf) { if (r?.error) lastError = r.error; continue; } // فشل صورة واحدة لا يفشل الدفعة
        const fileName = `images/ai-${t.key}.${r.ext || 'png'}`;
        images.push({ name: fileName, buf: r.buf });
        t.obj.img = fileName;
        count++;
    }
    if (!count) return { changed: false, reason: lastError || 'لم تُولَّد أي صورة' };

    const newLit = '[\n  ' + items.map(o => JSON.stringify(o)).join(',\n  ') + '\n]';
    if (!validateSeedLiteral(newLit, seedArr.literal)) return { changed: false, reason: 'حارس البنية رفض التعديل' };

    let js = spliceSeed(app.content, seedArr, newLit);
    js = patchImgUrlPassthrough(js).js;
    return { changed: true, count, appJs: js, images };
}
