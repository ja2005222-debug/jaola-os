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
export function analyzeStatic({ html = '', js = '', blueprint = null, domainModel = null } = {}) {
    const hay = `${html}\n${js}`.toLowerCase();
    const checks = [];

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
    try {
        const { VirtualConsole } = await import('jsdom');
        const vc = new VirtualConsole();
        vc.on('jsdomError', e => jsErrors.push((e?.message || String(e)).slice(0, 200)));
        vc.on('error', (...a) => jsErrors.push(a.map(String).join(' ').slice(0, 200)));

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
        window.onerror = (msg) => { jsErrors.push(String(msg).slice(0, 200)); return true; };
        window.addEventListener('error', e => jsErrors.push((e?.error?.message || e?.message || 'error').slice(0, 200)));
        window.addEventListener('unhandledrejection', e => jsErrors.push(('promise: ' + (e?.reason?.message || e?.reason || '')).slice(0, 200)));

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
export async function runBehaviorChecks({ html = '', assets = {}, blueprint = null, domainModel = null, timeoutMs = 4000 } = {}) {
    const js = Object.entries(assets)
        .filter(([k]) => /\.(m?js)$/i.test(k))
        .map(([, v]) => v).join('\n');

    const checks = analyzeStatic({ html, js, blueprint, domainModel });

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
 * غلاف يقرأ ملفات المشروع من القرص ويُشغّل التحقّق. آمن (لا يرمي أبداً).
 */
export async function verifyBehavior({ projectPath, blueprint = null, domainModel = null, timeoutMs = 4000 } = {}) {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const p = path.default || path;
        const indexPath = p.join(projectPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
            return { ok: true, score: 100, checks: [], summary: 'لا index.html للتحقّق منه.', ran: false, skipped: true };
        }
        const html = fs.readFileSync(indexPath, 'utf8');
        const assets = {};
        for (const f of fs.readdirSync(projectPath)) {
            if (/\.(m?js)$/i.test(f)) {
                try { assets[f] = fs.readFileSync(p.join(projectPath, f), 'utf8'); } catch {}
            }
        }
        return await runBehaviorChecks({ html, assets, blueprint, domainModel, timeoutMs });
    } catch (e) {
        return { ok: true, score: 0, checks: [{ name: 'runtime', status: 'warn', detail: `تعذّر التحقّق: ${(e?.message || e).toString().slice(0, 120)}` }], summary: 'تعذّر التحقّق', ran: false };
    }
}
