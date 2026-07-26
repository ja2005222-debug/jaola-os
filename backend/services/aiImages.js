/**
 * 🎨 صور حقيقية بالذكاء — طبقة اختيارية فوق عقد imageForge.
 *
 * imageForge يضمن صورة SVG حتمية دائماً؛ هذه الطبقة تستبدلها بصور AI حقيقية
 * حين يتوفر مفتاح مزوّد الصور (OPENAI_API_KEY). غير مُفعّلة → لا شيء ينكسر:
 * الموقع يبقى بصوره الحتمية، والمستخدم يرى سبب عدم التفعيل بوضوح.
 */

import { primarySeedArray, spliceSeed } from '../agents/seedStamp.js';
import { patchImgUrlPassthrough } from '../agents/imageForge.js';

const MAX_PER_CALL = 8;
const GEN_SVG_RE = /^images\/gen-[\w-]+\.svg$/;
// معرّف Unsplash المزروع من القوالب (مثل 1470229722913-7c0e2dbbafd3) —
// صورة افتراضية من القالب لا صورة مستخدم، فهي مؤهّلة للاستبدال أيضاً.
const UNSPLASH_ID_RE = /^\d{8,}-[0-9a-f]{4,}$/i;
// صورنا المولّدة سابقاً — طلب توليد جديد عليها مشروع (تجديد الصور)
const AI_IMG_RE = /^images\/ai-[\w-]+\.(?:png|jpe?g)$/i;
// تطبيع كلمة عربية للمطابقة: «المؤتمرات» ≈ «مؤتمر» (ال + لواحق الجمع/التأنيث)
const normWord = (s) => String(s || '').replace(/^ال/, '').replace(/(?:ات|ين|ون|ة)$/, '');
const labelMatches = (hay, wanted) => {
    const w = normWord(wanted);
    if (!w) return false;
    return String(hay).split(/\s+/).some(word => {
        const n = normWord(word);
        return n && (n.startsWith(w) || w.startsWith(n));
    });
};

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
 * 🔬 تشخيص ذاتي لحالة الصور في مشروع — يُستدعى من الشات («شخص الصور»)
 * فيكشف من ملفات الإنتاج الفعلية أين تنكسر السلسلة: أي مصفوفة تُقرأ،
 * قيم img الحالية، وهل رقعة التمرير والمزامن حاضران.
 */
export function diagnoseImages(files = []) {
    const app = files.find(f => f.name === 'app.js');
    if (!app) return { ok: false, reason: 'لا app.js في المشروع' };
    const seedArr = primarySeedArray(app.content);
    if (!seedArr) return { ok: false, reason: 'لا مصفوفة بيانات في app.js' };
    let items = null;
    try { items = evalItems(seedArr.literal); } catch { /* تُشخَّص كتعذّر قراءة */ }
    return {
        ok: true,
        seedName: seedArr.name || '(بلا اسم)',
        readable: Array.isArray(items),
        itemCount: Array.isArray(items) ? items.length : 0,
        imgs: Array.isArray(items)
            ? items.slice(0, 10).map(o => (o && typeof o === 'object' && 'img' in o) ? (String(o.img) || '(فارغ)') : '(بلا حقل img)')
            : [],
        passthrough: app.content.includes("v.indexOf('/')"),
        syncBlock: app.content.includes('jaola:img-sync'),
    };
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
    const openTag = `<${tag}${newAttrs}>`;
    let out = src.replace(full, openTag);

    // قوالب تضع صورة <img> داخل الـ hero (hero-bg) فوق الخلفية — تغيير
    // الخلفية وحده يُدفن خلفها («البنر لا يستجيب إطلاقاً»): نستبدل src
    // أول <img> داخل نطاق القسم أيضاً (مع إسقاط srcset كي لا تتغلب).
    const openIdx = out.indexOf(openTag);
    const closeIdx = openIdx !== -1 ? out.indexOf(`</${tag}>`, openIdx) : -1;
    if (openIdx !== -1 && closeIdx !== -1) {
        const segment = out.slice(openIdx, closeIdx);
        const im = segment.match(/<img\b[^>]*>/i);
        if (im) {
            let tagTxt = im[0].replace(/\s(?:srcset|sizes)=["'][^"']*["']/gi, '');
            tagTxt = /\bsrc=["']/i.test(tagTxt)
                ? tagTxt.replace(/\bsrc=["'][^"']*["']/i, `src="${imgPath}"`)
                : tagTxt.replace(/<img\b/i, `<img src="${imgPath}"`);
            out = out.slice(0, openIdx) + segment.replace(im[0], tagTxt) + out.slice(closeIdx);
        }
    }
    return { changed: true, html: out };
}

/**
 * يقرأ مصفوفة البيانات للقراءة فقط — متسامحاً مع استدعاءات دوالّ داخلها
 * (قوالب الاستنساخ تكتب g: grad('#…','#…') فيفشل التقييم الساذج بـ
 * «grad is not defined»). المعرّفات المجهولة تُستبدل بدوالّ صورية.
 */
function evalItems(lit) {
    try {
        // eslint-disable-next-line no-new-func
        return Function('"use strict";return (' + lit + ');')();
    } catch {
        const stub = new Proxy({}, {
            has: () => true,
            get: (t, k) => (k === Symbol.unscopables ? undefined : () => ''),
        });
        // eslint-disable-next-line no-new-func
        return Function('__ctx', 'with (__ctx) { return (' + lit + '); }')(stub);
    }
}

/** مواقع الكائنات العلوية داخل نصّ مصفوفة (يتجاهل الأقواس داخل النصوص). */
function topLevelObjectSpans(lit) {
    const spans = [];
    let depth = 0, start = -1, inStr = null, esc = false;
    for (let i = 0; i < lit.length; i++) {
        const c = lit[i];
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') inStr = c;
        else if (c === '{') { if (depth === 0) start = i; depth++; }
        else if (c === '}') { depth--; if (depth === 0 && start >= 0) { spans.push([start, i + 1]); start = -1; } }
    }
    return spans;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * القوالب التفاعلية ترسم من localStorage (let events = load('events', SEED))
 * لا من البذرة — فأي تعديل على app.js يُحجب خلف النسخة المحفوظة من أول
 * زيارة. نحقن مزامناً يحدّث حقول img للعناصر المولّدة داخل الحالة
 * المحفوظة (بمطابقة id) دون مسّ بقية بيانات المستخدم. يُدمج مع خرائط
 * الحقن السابقة ويُستبدل في مكانه (idempotent عبر علامتي التعليق).
 */
const IMG_SYNC_RE = /\/\* jaola:img-sync \*\/[\s\S]*?\/\* \/jaola:img-sync \*\/\n?/;
export function injectImgSync(js, map = {}) {
    const merged = {};
    const prev = js.match(IMG_SYNC_RE);
    if (prev) {
        const m = prev[0].match(/var seedImgs = (\{[\s\S]*?\});/);
        if (m) { try { Object.assign(merged, JSON.parse(m[1])); } catch { /* خريطة قديمة تالفة — نتجاوز */ } }
    }
    Object.assign(merged, map);
    if (!Object.keys(merged).length) return js;
    const block = '/* jaola:img-sync */\n'
        + '(function () { try {\n'
        + '    var seedImgs = ' + JSON.stringify(merged) + ';\n'
        + '    var syncArr = function (arr) { var hit = false; arr.forEach(function (o) { if (o && o.id != null && Object.prototype.hasOwnProperty.call(seedImgs, String(o.id)) && o.img !== seedImgs[String(o.id)]) { o.img = seedImgs[String(o.id)]; hit = true; } }); return hit; };\n'
        + '    for (var i = 0; i < localStorage.length; i++) {\n'
        + '        var k = localStorage.key(i); var raw = localStorage.getItem(k);\n'
        + '        if (!raw || (raw.charAt(0) !== \'[\' && raw.charAt(0) !== \'{\')) continue;\n'
        + '        try {\n'
        + '            var v = JSON.parse(raw); var hit = false;\n'
        + '            if (Array.isArray(v)) hit = syncArr(v);\n'
        + '            else if (v && typeof v === \'object\') { for (var p in v) { if (Array.isArray(v[p]) && syncArr(v[p])) hit = true; } }\n'
        + '            if (hit) localStorage.setItem(k, JSON.stringify(v));\n'
        + '        } catch (e) { /* ليس JSON حالتنا */ }\n'
        + '    }\n'
        + '} catch (e) {} })();\n'
        + '/* /jaola:img-sync */\n';
    return prev ? js.replace(IMG_SYNC_RE, block) : block + js;
}
/** نمط قيمة img داخل كائن: img: '…' أو "img": "…" — بالقيمة القديمة للتمييز. */
const imgValueRe = (oldImg) => oldImg
    ? new RegExp(`(\\bimg["']?\\s*[:=]\\s*["'])${escRe(oldImg)}(["'])`)
    : /(\bimg["']?\s*[:=]\s*["'])(["'])/;

/**
 * يستبدل صور العناصر الحتمية (الفارغة/المولّدة/بذور Unsplash) بصور AI في
 * مصفوفة البيانات الرئيسية. genFn قابلة للحقن للاختبار. صور المستخدم
 * الفعلية لا تُمسّ إلا بتسمية صريحة. الاستبدال جراحيّ في النصّ (قيمة img
 * وحدها) فلا تُفسَد استدعاءات الدوال داخل البيانات مثل grad(...).
 *
 * يعيد {changed, count, appJs, images:[{name, buf}]} — الكتابة للقرص مسؤولية المستدعي.
 */
export async function applyAiImages(files = [], { goal = '', maxCount = MAX_PER_CALL, targetLabel = '', stamp = Date.now().toString(36) } = {}, genFn = generateProductImage) {
    const app = files.find(f => f.name === 'app.js');
    if (!app) return { changed: false, reason: 'لا app.js' };
    const seedArr = primarySeedArray(app.content);
    if (!seedArr) return { changed: false, reason: 'لا مصفوفة بيانات' };

    let items;
    try {
        items = evalItems(seedArr.literal);
    } catch { return { changed: false, reason: 'تعذّر قراءة البيانات' }; }
    if (!Array.isArray(items) || !items.length) return { changed: false, reason: 'بيانات فارغة' };

    // العناصر المؤهّلة: img فارغ أو SVG مولّد أو معرّف Unsplash من القالب —
    // صور المستخدم الفعلية (مسارات assets/ وروابط كاملة) لا تُمسّ.
    // استثناء: تسمية عنصر صراحةً («غير صورة مؤتمرات») = موافقة على استبدال
    // صورته أيّاً كانت — لكن العنصر المسمّى وحده، لا غيره.
    const wanted = String(targetLabel || '');
    const targets = [];
    const collect = (obj, itemIndex, key) => {
        if (!('img' in obj)) return;
        const label = obj.name || obj.title || obj.city || '';
        const t = {
            itemIndex, key, label: label || wanted, oldImg: String(obj.img),
            oid: obj.id != null ? String(obj.id) : null,
            cat: obj.category || obj.cat || obj.type || '',
        };
        if (wanted) {
            // المطابقة على الاسم/العنوان + التصنيف (بطاقة «مؤتمرات» = category)
            const hay = `${label} ${obj.category || obj.cat || obj.type || ''}`;
            if (labelMatches(hay, wanted)) targets.push(t);
        } else if (obj.img === '' || GEN_SVG_RE.test(String(obj.img)) || UNSPLASH_ID_RE.test(String(obj.img)) || AI_IMG_RE.test(String(obj.img))) {
            targets.push(t);
        }
    };
    items.forEach((item, i) => {
        if (!item || typeof item !== 'object') return;
        const id = String(item.id || i);
        collect(item, i, id);
        for (const [k, v] of Object.entries(item)) {
            if (!Array.isArray(v)) continue;
            v.forEach((sub, j) => { if (sub && typeof sub === 'object') collect(sub, i, `${id}-${k}-${String(sub.id || j)}`); });
        }
    });
    if (!targets.length) {
        return { changed: false, reason: wanted ? `لم أجد عنصراً باسم «${targetLabel}» في بيانات الموقع` : 'لا عناصر مؤهّلة' };
    }

    const generated = [];
    let lastError = '';
    for (const t of targets.slice(0, Math.max(0, Math.min(maxCount, MAX_PER_CALL)))) {
        // البرومبت من هوية العنصر (العنوان + التصنيف) لا من اسم المشروع التقني —
        // «مسرحية الرحلة — photo-test-26-2» كانت تنتج صوراً لا علاقة لها بالحدث
        const subject = `${t.label}${t.cat ? ` (${t.cat})` : ''}`;
        const prompt = `${subject}. Photorealistic professional photo representing this subject, clean composition, no text, no letters, no watermark.`;
        const r = await genFn(prompt);
        if (r?.notConfigured) return { changed: false, notConfigured: true, reason: r.error };
        if (!r?.ok || !r.buf) { if (r?.error) lastError = r.error; continue; } // فشل صورة واحدة لا يفشل الدفعة
        // اسم فريد لكل توليد — الكتابة على نفس الاسم كانت تُري المتصفح
        // النسخة القديمة وميضاً (أو للأبد) قبل الجديدة
        generated.push({ itemIndex: t.itemIndex, oldImg: t.oldImg, oid: t.oid, key: t.key, name: `images/ai-${t.key}-${stamp}.${r.ext || 'png'}`, buf: r.buf });
    }
    if (!generated.length) return { changed: false, reason: lastError || 'لم تُولَّد أي صورة' };

    // استبدال جراحيّ: قيمة img وحدها داخل نطاق كائن العنصر — من الأخير
    // للأول حتى لا تفسد الإزاحات. grad(...) وبقية الحقول تبقى حرفياً.
    let lit = seedArr.literal;
    const spans = topLevelObjectSpans(lit);
    const applied = [];
    for (const job of [...generated].sort((a, b) => b.itemIndex - a.itemIndex)) {
        const span = spans[job.itemIndex];
        if (!span) continue;
        const seg = lit.slice(span[0], span[1]);
        const re = imgValueRe(job.oldImg);
        if (!re.test(seg)) continue;
        lit = lit.slice(0, span[0]) + seg.replace(re, `$1${job.name}$2`) + lit.slice(span[1]);
        applied.push(job);
    }

    // حارس البنية: نفس عدد العناصر ونفس مفاتيح كل عنصر بعد التعديل
    let guardOk = false;
    try {
        const after = evalItems(lit);
        guardOk = Array.isArray(after) && after.length === items.length
            && items.every((o, i) => !o || typeof o !== 'object'
                || Object.keys(o).every(k => after[i] && typeof after[i] === 'object' && k in after[i]));
    } catch { guardOk = false; }
    if (!applied.length || !guardOk) return { changed: false, reason: 'حارس البنية رفض التعديل' };

    let js = spliceSeed(app.content, seedArr, lit);
    js = patchImgUrlPassthrough(js).js;
    // مزامنة الحالة المحفوظة في متصفح الزائر (localStorage) مع الصور الجديدة
    const syncMap = {};
    for (const j of applied) if (j.oid) syncMap[j.oid] = j.name;
    js = injectImgSync(js, syncMap);
    // شبكة أمان: رقعة imgUrl الكلاسيكية مشروطة بتوقيع حرفي — لو عدّل أي
    // إصلاح تلقائي شكل الدالة، نلحق غلافاً يمرّر المسارات المحلية كما هي
    // (وإلا صار images/ai-….png رابط unsplash مكسوراً وonerror يخفي الصورة).
    if (!js.includes("v.indexOf('/')") && js.includes('imgUrl')) {
        js += "\n// jaola: الصور المحلية المولّدة تمرّ كما هي مهما كان شكل imgUrl الأصلي\n"
            + "(function () { try { var _f = typeof imgUrl === 'function' ? imgUrl : null; "
            + "imgUrl = function (id) { var v = String(id == null ? '' : id); "
            + "return (v.indexOf('/') !== -1 || v.indexOf('.') !== -1) ? v : (_f ? _f(id) : v); }; } catch (e) {} })();\n";
    }
    return { changed: true, count: applied.length, appJs: js, images: applied.map(j => ({ name: j.name, buf: j.buf, key: j.key })) };
}
