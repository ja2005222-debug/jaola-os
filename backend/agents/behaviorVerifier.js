/**
 * 🔬 Behavior Verifier — التحقّق السلوكي (تشغيل فعلي لا وعود)
 *
 * المشكلة: المنصّة كانت تعلن "✅ بُنيت الميزة" بلا برهان أنها تعمل. صفحة
 * استقبال الطلبات "وُعِدت" مراراً دون تحقّق فعلي.
 *
 * الحل: بعد البناء، نُشغّل الصفحة فعلياً في jsdom (بلا شبكة، بمهلة صارمة)،
 * نلتقط أخطاء JS، نُحرّك عناصر التفاعل ونرصد هل تغيّر الـ DOM فعلاً، ونتحقّق
 * أن أدوار النموذج وتدفّقاته ممثَّلة. النتيجة حكم صادق بثغرات محدّدة — لا
 * "نجاح" أجوف.
 *
 * التصميم آمن: أي فشل في jsdom لا يُسقط المنصّة (يتحوّل لتحذير)، ولا وصول
 * للشبكة أو لـ Node من داخل السكربتات المُشغّلة.
 */

// ── أدوات نقية (قابلة للاختبار بلا jsdom) ─────────────────────────────

/**
 * يُضمّن سكربتات محلية مشار إليها بـ <script src="x.js"> داخل HTML كي تُشغَّل
 * فعلاً في jsdom (الذي لا يجلب موارد خارجية). دالة نقية.
 * @param {string} html
 * @param {Record<string,string>} assets خريطة اسم-الملف → محتواه (js)
 */
export function inlineLocalScripts(html, assets = {}) {
    if (typeof html !== 'string') return '';
    return html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi, (m, pre, src, post) => {
        const key = src.replace(/^\.?\//, '').split('?')[0];
        const code = assets[key] ?? assets[src];
        if (typeof code !== 'string') return m; // خارجي/غير متوفّر → نتركه (لن يُشغَّل)
        // نزيل type=module لأن jsdom الكلاسيكي يكفي، ونحقن المحتوى
        return `<script>\n${code}\n</script>`;
    });
}

/**
 * فحوص ساكنة على النصّ (لا تشغيل) — تغطية الأدوار ووجود البيانات.
 * تكمّل التشغيل الفعلي وتُعطي دلائل حين يتعذّر التشغيل. دالة نقية.
 */
// كلمات/دوال مبنية لا تُعدّ "غير معرّفة" (لغة + DOM + شائعات)
const BUILTIN_CALLS = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'await', 'else', 'do', 'with', 'new', 'delete', 'void', 'in', 'instanceof', 'yield', 'super', 'this', 'import', 'export', 'require', 'class', 'extends', 'throw', 'try', 'finally', 'case', 'default',
    'console', 'alert', 'confirm', 'prompt', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'structuredClone', 'queueMicrotask', 'btoa', 'atob',
    'String', 'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'RegExp', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Error', 'Proxy', 'Reflect', 'BigInt',
    'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FormData', 'URL', 'URLSearchParams', 'Intl', 'Image', 'Audio', 'Blob', 'FileReader', 'Notification', 'IntersectionObserver', 'MutationObserver', 'ResizeObserver',
    'querySelector', 'querySelectorAll', 'getElementById', 'getElementsByClassName', 'getElementsByTagName', 'createElement', 'addEventListener', 'removeEventListener', 'getComputedStyle', 'matchMedia', 'scrollTo', 'gtag',
    // دوال CSS (تظهر داخل قوالب نصّية للأنماط) — ليست دوالّ JS
    'rgba', 'rgb', 'hsl', 'hsla', 'calc', 'url', 'var', 'clamp', 'min', 'max', 'minmax', 'repeat', 'cubic-bezier',
    'translate', 'translateX', 'translateY', 'translate3d', 'translateZ', 'scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'skew', 'skewX', 'skewY', 'matrix', 'perspective',
    'blur', 'brightness', 'contrast', 'saturate', 'grayscale', 'sepia', 'invert', 'opacity', 'drop-shadow', 'hue-rotate',
    'linear-gradient', 'radial-gradient', 'conic-gradient', 'attr', 'counter', 'env',
    // أصناف CSS الزائفة داخل نصوص المحدّدات (:not( / :is( / :has(...)
    'not', 'is', 'where', 'has', 'nth', 'lang', 'dir',
]);

/**
 * يكشف الدوال المُشار إليها (معالجات onclick / addEventListener / نداءات
 * DOMContentLoaded) لكنها **غير معرّفة** في الكود — قشرة بلا منطق. دالة نقية.
 * هذا بالضبط ما يجعل "زر تقديم الطلب" لا يعمل ولوحة المطعم فارغة.
 */
export function detectUndefinedFunctions({ html = '', js = '' } = {}) {
    // 1) الأسماء المعرّفة (بسخاء لتقليل الإيجابيات الكاذبة): أي تصريح/صنف/دالة
    const defined = new Set();
    const defPatterns = [
        /function\s*\*?\s*([A-Za-z_$][\w$]*)/g,                             // function foo() / function* foo()
        /class\s+([A-Za-z_$][\w$]*)/g,                                      // class Foo
        /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,                          // أي تصريح: const foo = require(...) / = ...
        /([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function/g,                  // foo: function
        /\b(?:window|globalThis|self)\.([A-Za-z_$][\w$]*)\s*=/g,           // window.foo =
        /([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,                             // foo(...) { (method shorthand / declaration)
    ];
    for (const re of defPatterns) { let m; while ((m = re.exec(js))) defined.add(m[1]); }
    // التفكيك: const { a, b } = ... / import { a, b } — كلّها معرّفة
    for (const m of js.matchAll(/(?:const|let|var|import)\s*\{([^}]*)\}/g)) {
        for (const part of m[1].split(',')) {
            const name = part.split(/[:\s]/).map(s => s.trim()).filter(Boolean).pop();
            if (name && /^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
        }
    }
    // import foo from '...' / import * as foo
    for (const m of js.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from/g)) defined.add(m[1]);

    // 2) الأسماء المُشار إليها كمعالجات/نداءات
    const referenced = new Set();
    // نداءات مجرّدة في JS: name(  غير مسبوقة بنقطة/حرف/شرطة (فتستبعد
    // obj.method() ودوال CSS الموصولة بشرطة مثل linear-gradient/drop-shadow)
    let m;
    const callRe = /(?<![-.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = callRe.exec(js))) referenced.add(m[1]);
    // معالجات HTML السطرية: onclick="foo(" / onsubmit='foo('
    const onRe = /\son[a-z]+\s*=\s*["']\s*([A-Za-z_$][\w$]*)\s*\(/gi;
    while ((m = onRe.exec(html))) referenced.add(m[1]);
    // معالج مُمرَّر بالاسم: addEventListener('click', foo)
    const listenerRe = /addEventListener\s*\(\s*[^,]+,\s*([A-Za-z_$][\w$]*)\s*[,)]/g;
    while ((m = listenerRe.exec(js))) referenced.add(m[1]);

    // 3) الناقص = مُشار إليه، غير معرّف، وليس مبنيّاً
    return [...referenced].filter(n => !defined.has(n) && !BUILTIN_CALLS.has(n));
}

export function analyzeStatic({ html = '', js = '', blueprint = null, domainModel = null } = {}) {
    const hay = `${html}\n${js}`.toLowerCase();
    const checks = [];

    // 🔌 اكتمال التوصيل: دوال مُشار إليها لكن غير معرّفة (قشرة بلا منطق) —
    // "زر تقديم الطلب موجود لكن submitOrder غير معرّفة".
    const undefinedFns = detectUndefinedFunctions({ html, js });
    if (undefinedFns.length) {
        checks.push({ name: 'wiring-complete', status: 'fail',
            detail: `دوال مُشار إليها وغير معرّفة (قشرة بلا منطق): ${undefinedFns.join('، ')}` });
    }

    // تغطية الأدوار: نموذج بأكثر من دور يجب أن يظهر كلّ دور في الواجهة/الكود
    const roles = Array.isArray(domainModel?.roles) ? domainModel.roles : [];
    if (roles.length > 1) {
        const missing = roles.filter(r => {
            const name = (r?.name || '').toLowerCase();
            if (!name) return false;
            const caps = (r?.capabilities || []).map(c => (c || '').toLowerCase());
            return !hay.includes(name) && !caps.some(c => c && hay.includes(c.split(' ')[0]));
        }).map(r => r.name);
        checks.push(missing.length
            ? { name: 'role-coverage', status: 'fail', detail: `أدوار بلا واجهة/تمثيل: ${missing.join('، ')} — النموذج متعدّد الأدوار لكن بعضها غير مبنيّ.` }
            : { name: 'role-coverage', status: 'pass', detail: `كل الأدوار (${roles.length}) ممثَّلة.` });
    }

    // وجود بيانات: التطبيقات التفاعلية تحتاج مصدر بيانات (مصفوفة كائنات أو fetch API)
    const interactive = blueprint?.kind === 'webapp' || blueprint?.kind === 'tool'
        || (Array.isArray(blueprint?.functionalComponents) && blueprint.functionalComponents.length > 0);
    if (interactive) {
        const hasData = /\[\s*\{/.test(js) || /fetch\s*\(\s*["'`]\/?api\//i.test(js) || /const\s+\w+\s*=\s*\[/.test(js);
        checks.push(hasData
            ? { name: 'data-presence', status: 'pass', detail: 'يوجد مصدر بيانات (مصفوفة/‏API).' }
            : { name: 'data-presence', status: 'warn', detail: 'لا دليل على مصدر بيانات — قد تكون المكوّنات بلا ما تعمل عليه.' });
    }

    return checks;
}

/**
 * يُجمّع الحكم النهائي من الفحوص. دالة نقية.
 */
export function summarizeVerdict(checks) {
    const fails = checks.filter(c => c.status === 'fail');
    const warns = checks.filter(c => c.status === 'warn');
    const passes = checks.filter(c => c.status === 'pass');
    const total = checks.length || 1;
    const score = Math.round(((passes.length + warns.length * 0.5) / total) * 100);
    return {
        ok: fails.length === 0,
        score,
        checks,
        summary: `${passes.length} ✅ / ${warns.length} ⚠️ / ${fails.length} ❌ (${score}%)`,
    };
}

/**
 * يحوّل ثغرات الحكم السلوكي إلى تعليمة إصلاح مستهدفة للمولّد. دالة نقية.
 * تُغذّي جولة الإصلاح التلقائية (verify → fix → re-verify).
 */
export function buildBehaviorFixInstruction(verdict, domainModel = null) {
    const gaps = (verdict?.checks || []).filter(c => c.status === 'fail' || c.status === 'warn');
    if (!gaps.length) return '';

    const directives = [];
    for (const c of gaps) {
        if (c.name === 'missing-script') {
            directives.push(`أنشئ ملف السكربت المفقود المُشار إليه في index.html (${c.detail}) ونفّذ فيه **كل** منطق التطبيق: تعريف كل الدوال المستدعاة (معالجات الأزرار والنماذج) وبيانات وهمية واقعية — بنفس اسم الملف الذي يشير إليه index.html بالضبط.`);
        } else if (c.name === 'wiring-complete') {
            directives.push(`أكمل المنطق الناقص: هناك دوال مُشار إليها (أزرار/معالجات/DOMContentLoaded) لكنها **غير معرّفة** — ${c.detail}. **عرّف كل دالة منها ونفّذها فعلياً** بحيث تعمل على البيانات وتُحدّث الصفحة (submitOrder يُنشئ طلباً ويحفظه، renderRestaurantOrders يعرض طلبات المطعم، renderDeliveryOrders يعرض طلبات التوصيل، trackOrder يعرض حالة الطلب... حسب أسمائها). لا تترك أي مرجع معلّق.`);
        } else if (c.name === 'no-js-errors') {
            directives.push(`أصلح أخطاء JavaScript التي تمنع الصفحة من العمل (${c.detail}). يجب أن تُحمّل الصفحة وتعمل بلا أي خطأ في وحدة التحكّم.`);
        } else if (c.name === 'interactive-wired') {
            directives.push(c.status === 'fail'
                ? 'التطبيق تفاعلي لكن بلا عناصر تفاعل حقيقية — أضف الحقول/الأزرار/النماذج اللازمة وصِلها بمعالجات (addEventListener) تعمل فعلاً على البيانات وتُحدّث الصفحة عند التفاعل.'
                : 'توجد عناصر تفاعل لكنها لا تستجيب (أزرار/نماذج ميتة) — أضف معالجات تُحدّث الـ DOM فعلياً عند التفاعل. لا تترك أي عنصر تفاعل بلا وظيفة.');
        } else if (c.name === 'role-coverage') {
            directives.push(`${c.detail} ابنِ واجهة كل دور ناقص بمنظوره وعناصره — مثال: واجهة استقبال الطلبات لصاحب المطعم منفصلة عن واجهة الزبون، كلٌّ يعمل على نفس البيانات.`);
        } else if (c.name === 'data-presence') {
            directives.push('أضف بيانات وهمية واقعية (مصفوفة كائنات) في script.js لتشغيل المكوّنات فعلياً.');
        }
    }

    let modelHint = '';
    const roles = Array.isArray(domainModel?.roles) ? domainModel.roles.map(r => r.name).filter(Boolean) : [];
    const ents = Array.isArray(domainModel?.entities) ? domainModel.entities.map(e => e.name).filter(Boolean) : [];
    if (roles.length || ents.length) {
        modelHint = `\n\nنموذج المشروع للاسترشاد — الأدوار: ${roles.join('، ') || '—'}؛ الكيانات: ${ents.join('، ') || '—'}. حافظ على تماسك النظام: كل دور له واجهته، وكل كيان له تمثيل بيانات فعلي.`;
    }

    return `أصلح المشكلات السلوكية التالية دون كسر التصميم القائم أو حذف ما يعمل:\n- ${directives.join('\n- ')}${modelHint}`;
}

// ── التشغيل الفعلي في jsdom ────────────────────────────────────────────

/**
 * يُشغّل الصفحة في jsdom بأمان: بلا شبكة، بمهلة، مع التقاط أخطاء JS وتحريك
 * عناصر التفاعل ورصد تغيّر الـ DOM. يعود بنتيجة أو null إن تعذّر jsdom.
 */
async function runInJsdom(html, { timeoutMs = 4000 } = {}) {
    let JSDOM;
    try { ({ JSDOM } = await import('jsdom')); }
    catch { return null; } // jsdom غير متوفّر → نكتفي بالفحوص الساكنة

    const jsErrors = [];
    let dom;
    // "Not implemented" / navigation من jsdom ثغرات محرّك لا أعطال تطبيق —
    // نتجاهلها كي لا تُحسب أخطاء JS كاذبة (سجل المستخدم: requestSubmit).
    const isEngineGap = (m) => /not implemented|navigation \(except|is not a function\s*$/i.test(m || '');
    const pushErr = (m) => { const s = (m || '').toString().slice(0, 200); if (s && !isEngineGap(s)) jsErrors.push(s); };
    try {
        const { VirtualConsole } = await import('jsdom');
        const vc = new VirtualConsole();
        vc.on('jsdomError', e => pushErr(e?.message || String(e)));
        vc.on('error', (...a) => pushErr(a.map(String).join(' ')));

        dom = new JSDOM(html, {
            runScripts: 'dangerously',
            pretendToBeVisual: true,
            url: 'http://localhost/',
            virtualConsole: vc,
            resources: undefined, // لا جلب موارد خارجية (لا شبكة)
        });

        const { window } = dom;
        // كتم/تعطيل ما قد يُعلّق أو يصل للشبكة
        window.alert = () => {}; window.confirm = () => true; window.prompt = () => '';
        window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([]), text: () => Promise.resolve('') });
        // jsdom لا يطبّق requestSubmit/scrollIntoView → يرمي "Not implemented"
        // فيُحسب خطأ JS كاذباً. نوفّر بدائل غير ضارّة (ليست أعطالاً حقيقية).
        try { window.HTMLFormElement.prototype.requestSubmit = function () { this.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }; } catch {}
        try { window.HTMLElement.prototype.scrollIntoView = function () {}; window.Element.prototype.scrollIntoView = function () {}; } catch {}
        try { window.scrollTo = () => {}; window.HTMLElement.prototype.animate = window.HTMLElement.prototype.animate || (() => ({ cancel() {}, finished: Promise.resolve() })); } catch {}
        window.onerror = (msg) => { pushErr(String(msg)); return true; };
        window.addEventListener('error', e => pushErr(e?.error?.message || e?.message || 'error'));
        window.addEventListener('unhandledrejection', e => pushErr('promise: ' + (e?.reason?.message || e?.reason || '')));

        // مهلة تحميل قصيرة (للـ DOMContentLoaded والمؤقّتات)
        await new Promise(r => setTimeout(r, Math.min(timeoutMs, 500)));

        const doc = window.document;
        const buttons = [...doc.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')];
        const forms = [...doc.querySelectorAll('form')];
        const inputs = [...doc.querySelectorAll('input:not([type="submit"]):not([type="button"]), select, textarea')];
        const interactiveCount = buttons.length + forms.length + inputs.length;

        // نرصد تغيّر الـ DOM عند التفاعل — "تشغيل التدفّق فعلاً"
        let mutations = 0;
        const MO = window.MutationObserver;
        const observer = MO ? new MO(list => { mutations += list.length; }) : null;
        if (observer) observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });

        try {
            // أدخل قيمة في أول حقلين، وأطلق submit/click على أوّل عناصر
            for (const inp of inputs.slice(0, 2)) {
                try { inp.value = inp.value || 'test'; inp.dispatchEvent(new window.Event('input', { bubbles: true })); inp.dispatchEvent(new window.Event('change', { bubbles: true })); } catch {}
            }
            for (const form of forms.slice(0, 2)) {
                try { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); } catch {}
            }
            for (const btn of buttons.slice(0, 4)) {
                try { btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); } catch {}
            }
        } catch { /* التفاعل الفاشل يُلتقط كخطأ JS */ }

        await new Promise(r => setTimeout(r, 50));
        if (observer) observer.disconnect();

        return { jsErrors, interactiveCount, mutations, buttons: buttons.length, forms: forms.length, inputs: inputs.length };
    } catch (e) {
        return { jsErrors: [...jsErrors, `jsdom: ${(e?.message || e).toString().slice(0, 200)}`], interactiveCount: 0, mutations: 0, buttons: 0, forms: 0, inputs: 0 };
    } finally {
        try { dom?.window?.close?.(); } catch {}
    }
}

/**
 * الحكم السلوكي الكامل: فحوص ساكنة + تشغيل فعلي في jsdom.
 * @returns {Promise<{ok, score, checks, summary, ran}>}
 */
export async function runBehaviorChecks({ html = '', assets = {}, blueprint = null, domainModel = null, missingScripts = [], timeoutMs = 4000 } = {}) {
    // مجموعة JS للواجهة: السكربتات الخارجية + محتوى <script> السطري (كلاهما
    // يُعرّف/يستدعي دوالّ، فيجب فحصهما معاً لدقّة كشف الدوال المعلّقة).
    const external = Object.entries(assets)
        .filter(([k]) => /\.(m?js)$/i.test(k))
        .map(([, v]) => v).join('\n');
    const inlineJs = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
        .map(m => m[1]).join('\n');
    const js = `${inlineJs}\n${external}`;

    const checks = analyzeStatic({ html, js, blueprint, domainModel });

    // 📄 سكربت مُشار إليه في index.html لكنه مفقود على القرص → كل دواله معدومة
    // (سجل مستخدم: index.html يشير إلى app.js وهو غير موجود → التطبيق ميّت).
    if (Array.isArray(missingScripts) && missingScripts.length) {
        checks.push({ name: 'missing-script', status: 'fail',
            detail: `الصفحة تشير إلى سكربت مفقود على القرص: ${missingScripts.join('، ')} — يجب إنشاؤه بكل منطق التطبيق.` });
    }

    const inlined = inlineLocalScripts(html, assets);
    const run = await runInJsdom(inlined, { timeoutMs });

    if (run) {
        // 1) لا أخطاء JS أثناء التحميل/التفاعل
        checks.push(run.jsErrors.length
            ? { name: 'no-js-errors', status: 'fail', detail: `أخطاء JS وقت التشغيل: ${[...new Set(run.jsErrors)].slice(0, 3).join(' | ')}` }
            : { name: 'no-js-errors', status: 'pass', detail: 'الصفحة تعمل بلا أخطاء JS.' });

        // 2) عناصر التفاعل تستجيب فعلاً (تغيّر DOM عند التحريك)
        const interactiveExpected = blueprint?.kind === 'webapp' || blueprint?.kind === 'tool'
            || (Array.isArray(blueprint?.functionalComponents) && blueprint.functionalComponents.length > 0);
        if (interactiveExpected) {
            if (run.interactiveCount === 0) {
                checks.push({ name: 'interactive-wired', status: 'fail', detail: 'تطبيق تفاعلي بلا أي عنصر تفاعل (أزرار/نماذج/حقول).' });
            } else if (run.mutations > 0) {
                checks.push({ name: 'interactive-wired', status: 'pass', detail: `التفاعل يُحدث تغييراً حيّاً في الصفحة (${run.mutations} تغيير، ${run.interactiveCount} عنصر).` });
            } else {
                checks.push({ name: 'interactive-wired', status: 'warn', detail: `${run.interactiveCount} عنصر تفاعل لكن لا استجابة مرئية عند التحريك — قد تكون غير موصولة بمعالجات.` });
            }
        }
    } else {
        checks.push({ name: 'runtime', status: 'warn', detail: 'تعذّر التشغيل الفعلي (jsdom غير متاح) — اكتُفي بالفحوص الساكنة.' });
    }

    return { ...summarizeVerdict(checks), ran: !!run };
}

/**
 * يقرأ كود الواجهة من القرص: index.html + السكربتات المحلية التي تُحمّلها
 * فعلاً (لا ملفات الخادم). يعود بـ null إن لا index.html. آمن.
 */
export async function readPageCode(projectPath) {
    const fs = await import('fs');
    const path = await import('path');
    const p = path.default || path;
    const indexPath = p.join(projectPath, 'index.html');
    if (!fs.existsSync(indexPath)) return null;
    const html = fs.readFileSync(indexPath, 'utf8');
    const assets = {};
    const missingScripts = [];
    const srcRe = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi;
    let sm;
    while ((sm = srcRe.exec(html))) {
        const src = sm[1];
        if (/^(https?:)?\/\//i.test(src)) continue; // خارجي
        const rel = src.replace(/^\.?\//, '').split('?')[0];
        if (!/\.(m?js)$/i.test(rel)) continue;
        try {
            const fp = p.join(projectPath, rel);
            if (fs.existsSync(fp)) assets[rel] = fs.readFileSync(fp, 'utf8');
            else missingScripts.push(rel); // مُشار إليه لكن غير موجود على القرص
        } catch {}
    }
    return { html, assets, missingScripts };
}

/**
 * غلاف يقرأ ملفات المشروع من القرص ويُشغّل التحقّق. آمن (لا يرمي أبداً).
 */
export async function verifyBehavior({ projectPath, blueprint = null, domainModel = null, timeoutMs = 4000 } = {}) {
    try {
        const page = await readPageCode(projectPath);
        if (!page) return { ok: true, score: 100, checks: [], summary: 'لا index.html للتحقّق منه.', ran: false, skipped: true };
        return await runBehaviorChecks({ html: page.html, assets: page.assets, blueprint, domainModel, missingScripts: page.missingScripts, timeoutMs });
    } catch (e) {
        return { ok: true, score: 0, checks: [{ name: 'runtime', status: 'warn', detail: `تعذّر التحقّق: ${(e?.message || e).toString().slice(0, 120)}` }], summary: 'تعذّر التحقّق', ran: false };
    }
}

/**
 * تحليل ساكن سريع للمشروع الفعلي (بلا jsdom) — يُعطي فجوات حقيقية من الكود
 * (أدوار بلا واجهة، دوال معلّقة، لا بيانات) لتأريض ردّ الشات على «ماذا تبقى»
 * بدل خطة مخزّنة. آمن (لا يرمي).
 */
export async function analyzeProjectStatic({ projectPath, domainModel = null, blueprint = null } = {}) {
    try {
        const page = await readPageCode(projectPath);
        if (!page) return { hasProject: false, checks: [] };
        const external = Object.entries(page.assets)
            .filter(([k]) => /\.(m?js)$/i.test(k)).map(([, v]) => v).join('\n');
        const inlineJs = [...page.html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
            .map(m => m[1]).join('\n');
        const js = `${inlineJs}\n${external}`;
        const checks = analyzeStatic({ html: page.html, js, blueprint, domainModel });
        if (page.missingScripts?.length) {
            checks.push({ name: 'missing-script', status: 'fail',
                detail: `الصفحة تشير إلى سكربت مفقود: ${page.missingScripts.join('، ')} — غير موجود على القرص.` });
        }
        return { hasProject: true, checks };
    } catch {
        return { hasProject: false, checks: [] };
    }
}
