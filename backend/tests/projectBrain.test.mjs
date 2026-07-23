// 🧠 دماغ المشروع: الملخّص يجب أن يكون صادقاً — لا نسبة مخترعة حين يكشف
// الكود أن التطبيق لا يعمل (سجل مستخدم: «67% حسب الخطة» رغم app.js مفقود).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectBrain, summarizeBrain, projectFacts, summarizeFacts } from '../services/projectBrain.js';

test('projectFacts: يحسب عدد الملفات وصفحات HTML وأكبر ملف', () => {
    const files = [
        { path: 'index.html', size: 5000, kind: 'html' },
        { path: 'about.html', size: 2000, kind: 'html' },
        { path: 'app.js', size: 12000, kind: 'js' },
        { path: 'styles.css', size: 3000, kind: 'css' },
        { path: '.backups/x', size: 999, kind: 'other' },
    ];
    const f = projectFacts(files);
    assert.equal(f.totalFiles, 4, 'تجاهل الملفات المخفيّة');
    assert.deepEqual(f.htmlPages, ['index.html', 'about.html']);
    assert.equal(f.largest.path, 'app.js');
    assert.equal(f.largest.size, 12000);
    assert.equal(f.top[0].path, 'app.js');
});

test('summarizeBrain: percent=null → سطر صادق بلا نسبة مخترعة (لا 67%)', () => {
    const brain = buildProjectBrain({ structure: { features: ['خطة أ', 'خطة ب'] } },
        [{ path: 'app/page.jsx', size: 100, kind: 'jsx' }]);
    brain.progress.percent = null;      // تعذّر التحقّق الساكن
    brain.progress.works = undefined;
    brain.progress.remaining = [];
    const ar = summarizeBrain(brain, 'ar');
    assert.ok(ar.includes('تعذّر التحقّق التلقائي'), 'سطر صادق');
    assert.ok(!/\d+%/.test(ar), 'لا نسبة مئوية مخترعة');
    assert.ok(summarizeBrain(brain, 'en').includes('automatic check unavailable'));
});

test('summarizeFacts: نصّ عربي يحمل الأرقام الفعلية', () => {
    const files = [
        { path: 'index.html', size: 5120, kind: 'html' },
        { path: 'app.js', size: 10240, kind: 'js' },
    ];
    const s = summarizeFacts(files, 'ar');
    assert.ok(s.includes('إجمالي الملفات: 2'), 'عدد الملفات');
    assert.ok(s.includes('صفحات HTML: 1'), 'عدد الصفحات');
    assert.ok(s.includes('app.js'), 'أكبر ملف مذكور');
    // إنجليزي
    assert.ok(summarizeFacts(files, 'en').includes('Total files: 2'));
    // فارغ → لا شيء
    assert.equal(summarizeFacts([], 'ar'), '');
});

test('summarizeBrain: works=false → «لا يعمل بعد» بلا نسبة مطمئنة', () => {
    const brain = buildProjectBrain({ structure: { features: ['سلة', 'تتبّع'] } }, [{ path: 'index.html' }]);
    brain.progress.works = false;
    brain.progress.remaining = ['سكربت مفقود: app.js', 'أدوار بلا واجهة: Customer'];
    const s = summarizeBrain(brain, 'ar');
    assert.match(s, /لا يعمل بعد/);
    assert.doesNotMatch(s, /\d+% مكتمل/, 'لا نسبة مخترعة حين لا يعمل');
    assert.match(s, /app\.js/, 'المتبقّي من الكود الفعلي');
});

test('summarizeBrain: works=true → «يعمل» (اجتاز التحقّق)', () => {
    const brain = buildProjectBrain({}, [{ path: 'index.html' }, { path: 'script.js' }]);
    brain.progress.works = true;
    const s = summarizeBrain(brain, 'ar');
    assert.match(s, /يعمل/);
});

test('summarizeBrain: بلا تحقّق (works غير محدّد) → يُبقي سلوكه القديم (نسبة)', () => {
    const brain = buildProjectBrain({}, [{ path: 'index.html' }]);
    const s = summarizeBrain(brain, 'ar');
    assert.match(s, /% مكتمل/);
});

test('summarizeBrain: مشروع فارغ → «فارغ»', () => {
    assert.match(summarizeBrain(buildProjectBrain({}, []), 'ar'), /فارغ/);
});
