// 🧠 دماغ المشروع: الملخّص يجب أن يكون صادقاً — لا نسبة مخترعة حين يكشف
// الكود أن التطبيق لا يعمل (سجل مستخدم: «67% حسب الخطة» رغم app.js مفقود).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectBrain, summarizeBrain } from '../services/projectBrain.js';

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
