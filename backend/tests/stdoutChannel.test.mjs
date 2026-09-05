// ═══════════════════════════════════════════════════════════════════
// حارسُ القناة (Sprint 3a) — أثرُ #486.
//
// مُشغّلُ اختبارات Node يُشغّل كلَّ ملفِ اختبارٍ في عمليةٍ ابنة، ويرسل نتائجه
// إلى الأب **مُسلسَلةً بترميز V8 على المخرَج القياسيّ**. فالمخرَجُ القياسيّ
// هناك ليس شاشةً بل قناةُ بيانات. وأيُّ كتابةٍ أخرى عليه تُقحِم بايتاتٍ وسط
// الدفق فيسقط فكُّ التسلسل بخطأٍ لا يذكر سببَه ولا الوحدةَ التي طبعت:
//     ERR_TEST_FAILURE: Unable to deserialize cloned data …
//
// وقع هذا مرّتين: بيانُ PluginOrchestrator (#486) — ظهر تذبذباً عشوائياً
// كلّف تشخيصَه ساعةً — ولافتةُ dotenv@17 الترويجية التي كُشفت أثناء بناء هذا
// الحارس نفسه. كلاهما «طباعةٌ للإنسان» على قناةٍ ليست للإنسان.
//
// فالعقدُ المحروس هنا: **ما تستورده الاختبارات لا يكتب على المخرَج القياسيّ.**
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { testImports } from './helpers/stdoutProbe.mjs';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(BACKEND, '..');
const PROBE = path.join(BACKEND, 'tests/helpers/stdoutProbe.mjs');

// حارسٌ يمسح صفراً من الوحدات ينجح دائماً — وهو أسوأ من لا حارس، لأنّه
// يمنح طمأنينةً لا يقابلها قياس. فيُقاس سطحُ المِجَسّ قبل الاعتماد عليه.
test('مِجَسُّ القناة يغطّي سطحاً حقيقياً لا فراغاً', () => {
    const mods = testImports();
    assert.ok(mods.length >= 100, `سطحُ المِجَسّ انهار إلى ${mods.length} وحدة — النمطُ الذي يستنبط الاستيرادات كُسر على الأرجح`);
    for (const m of mods) {
        assert.ok(fs.existsSync(path.join(BACKEND, m)), `المِجَسّ يعِد باستيراد ملفٍ غير موجود: ${m}`);
    }
});

test('لا وحدةٌ تستوردها الاختبارات تكتب على المخرَج القياسيّ', () => {
    const expected = testImports().length;
    const r = spawnSync(process.execPath, [PROBE], {
        cwd: BACKEND,
        // NODE_TEST_CONTEXT هو ما يُعيّنه Node في أبناء الاختبار وحدهم، وعليه
        // تتوقّف الحراساتُ الصامتة داخل الوحدات. فيُحاكى هنا كي يقيس المِجَسّ
        // الحالةَ التي تقع فعلاً، لا حالةً أهدأ منها.
        env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8' },
        encoding: 'utf8',
        timeout: 120000,
    });

    assert.equal(r.status, 0, `سقط المِجَسّ قبل أن يُكمل الاستيراد:\n${r.stderr}`);
    assert.equal(r.stdout, '', `كُتبت بايتاتٌ على المخرَج القياسيّ أثناء تشغيلٍ اختباريّ — وهي قناةُ نتائج المُشغّل، فستُفسدها:\n${JSON.stringify(r.stdout)}`);

    // وتقريرُ المِجَسّ (على مَخرَج الأخطاء) دليلٌ على أنّه أكمل الشوط: عددُ ما
    // استورده يطابق ما استنبطه الاختبار استقلالاً. فصمتٌ ناتجٌ عن خروجٍ مبكر
    // لا يُقرأ نجاحاً.
    assert.equal(JSON.parse(r.stderr).count, expected);
});

// dotenv@17 يطبع لافتتَه على المخرَج القياسيّ عند كلّ تحميل. الحارسُ أعلاه
// يمسك ما تستورده الاختباراتُ اليوم؛ وهذا يمسك الصنفَ كلَّه — أيّ موضعِ
// تحميلٍ في المستودع، حتى في وحدةٍ لا اختبارَ لها بعد.
test('كلُّ تحميلٍ لـdotenv في المستودع صامتٌ', () => {
    // نواتجُ البناء نسخٌ مُجمَّعة من مصادرَ مفحوصةٍ أصلاً، فمسحُها يُكرّر
    // البلاغ ويقيس ما لا يُحرَّر.
    const SKIP = new Set(['node_modules', 'dist', 'build', 'workspace', 'workspaces']);
    const sites = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!/\.(m|c)?js$/.test(e.name)) continue;
            const src = fs.readFileSync(p, 'utf8');
            for (const m of src.matchAll(/dotenv\s*\.\s*config\s*\(([^)]*)\)/g)) {
                sites.push({ file: path.relative(ROOT, p), args: m[1] });
            }
        }
    })(ROOT);

    assert.ok(sites.length > 0, 'لم يُعثر على أيّ تحميلٍ لـdotenv — الحارسُ يقيس فراغاً');
    for (const s of sites) {
        assert.match(s.args, /quiet\s*:\s*true/, `${s.file}: تحميلُ dotenv بالوسائط «${s.args}» يطبع لافتةً على المخرَج القياسيّ — يلزمه { quiet: true }`);
    }
});

// ═══════════════════════════════════════════════════════
// 🔇 صمتُ التشغيل لا صمتُ الاستيراد وحده — Sprint 3j
//
// حرّاسُ هذا الملفّ أعلاه تضمن أن **الاستيراد** صامت (عطب #486). وبقيت ثغرةٌ
// كشفها #495: ما يطبعه الكودُ **أثناء** الاختبار يمرّره مشغّلُ Node عبر قناة
// التقرير نفسها، فتنكسر أُطُرُها عند المحارف متعددة البايت تحت الحِمل ويسقط
// الملفّ كلُّه. تجربةٌ ضابطة (بنيةٌ وحجمٌ واحد، ٢٤ تشغيلاً متزامناً):
//   لاتينيٌّ بحت ٠/٢٤   —   إيموجي وعربية ١٢/٢٤
// ═══════════════════════════════════════════════════════
test('كاتمُ السجلّ يكتم فعلاً ويحتفظ بما كُتم', async () => {
    const { quietConsole } = await import('./helpers/quietConsole.mjs');
    const q = quietConsole();
    let escaped = false;
    const realWrite = process.stdout.write;
    process.stdout.write = (...a) => { escaped = true; return realWrite.apply(process.stdout, a); };
    try {
        console.log('💳 [Billing] تحديث اشتراك omar → pro (active)');
        console.warn('🗄️ [WorkspaceStore] استُعيد 2 من 3 ملف');
        console.error('خطأ');
    } finally {
        process.stdout.write = realWrite;
        q.restore();
    }
    assert.equal(escaped, false, 'سطرٌ تسرّب إلى القناة رغم الكتم');
    assert.equal(q.lines.length, 3, 'الكتمُ يحتفظ بالسطور فلا يُخفي شيئاً');
    assert.match(q.lines[0], /تحديث اشتراك omar/);

    console.log = console.log;   // بعد `restore` تعود الطباعة كما كانت
    assert.equal(typeof console.log, 'function');
});
