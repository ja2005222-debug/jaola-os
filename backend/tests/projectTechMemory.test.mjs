// 🧠 نيّةُ المشروع ودليلُه — حقلان كانا يُقرآن ولا يُكتبان
//
// `tech.hasBackend` و`tech.apis` في ذاكرة المشروع لهما **ثلاثةُ قرّاء**:
//   • `projectMemory.buildMemoryContext` — يطبع «APIs موجودة: …» للنموذج.
//   • `projectBrain` (سطران) — «المُنجَز» و«المتبقّي».
// و**صفرُ كُتّاب** في الكود الإنتاجيّ: `updateTech` لم يستدعِها إلا اختبار.
// فبقي الحقلان على `false` و`[]` أبداً، وسقطت الفروعُ الثلاثة كلُّها صامتة.
//
// وحين وُصلا، ظهر خلطٌ أعمق: **النيّةُ ليست الدليل**.
//   - `hasBackend` نيّةٌ مشتقّةٌ من نصّ الهدف (`needsBackend`).
//   - `apis` دليلٌ مجرودٌ من القرص.
// فوضعُ النيّة في «المُنجَز» يجعل المشروعَ يدّعي خادماً لم يُكتب بعد.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
import { listApiModules, isFullStackProject } from '../agents/deployAgent.js';
import { buildProjectBrain } from '../services/projectBrain.js';

divertConsoleToStderr();

function withProject(files, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-tech-'));
    try {
        for (const [rel, body] of Object.entries(files)) {
            const p = path.join(dir, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body);
        }
        return fn(dir);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('جردُ الدوالّ يستثني ملفّات البيانات — والحارسُ يتبعه لا ينسخه', () => {
    withProject({ 'api/db.js': '1', 'api/schema.js': '1', 'api/seed.js': '1' }, (d) => {
        assert.deepEqual(listApiModules(d), [], 'ملفّاتُ بياناتٍ وحدها ليست دوالّ');
        assert.equal(isFullStackProject(d), false, 'الحارسُ يجب أن يوافق الجرد');
    });
    withProject({ 'api/db.js': '1', 'api/auth.js': '1', 'api/stripe.js': '1' }, (d) => {
        assert.deepEqual(listApiModules(d), ['auth.js', 'stripe.js'], 'مرتّبةً وبلا db.js');
        assert.equal(isFullStackProject(d), true);
    });
});

test('مشروعٌ بلا `api/` — جردٌ فارغ لا انهيار', () => {
    withProject({ 'index.html': '<html>' }, (d) => {
        assert.deepEqual(listApiModules(d), []);
        assert.equal(isFullStackProject(d), false);
    });
    assert.deepEqual(listApiModules('/no/such/path/ever'), [], 'مسارٌ غائب: فارغٌ لا رمي');
});

test('«المُنجَز» دليلٌ من القرص لا نيّةٌ مخزَّنة', () => {
    // نيّةٌ بلا ملفّات: يجب ألّا يُعلَن خادمٌ منجَزاً.
    const brain = buildProjectBrain({ tech: { hasBackend: true, apis: [] } }, [{ path: 'index.html' }]);
    const text = JSON.stringify(brain);
    assert.doesNotMatch(text, /خادم \/ واجهات API/,
        'أُعلن خادمٌ مُنجَزاً بناءً على النيّة وحدها — الخلطُ عاد');
    // والدليلُ وحده يكفي.
    const brain2 = buildProjectBrain({ tech: {} }, [{ path: 'api/auth.js' }]);
    assert.match(JSON.stringify(brain2), /خادم \/ واجهات API/, 'دليلٌ حقيقيّ لم يُعَدّ منجَزاً');
});

test('«المتبقّي» يقرأ النيّة — وهو موضعُها الصحيح', () => {
    const brain = buildProjectBrain({ tech: { hasBackend: true } }, [{ path: 'index.html' }]);
    assert.match(JSON.stringify(brain), /قاعدة بيانات للخادم/,
        'نيّةُ خادمٍ بلا قاعدةِ بيانات يجب أن تظهر في المتبقّي — الفرعُ ميّتٌ من جديد');
    const brain2 = buildProjectBrain({ tech: { hasBackend: false } }, [{ path: 'index.html' }]);
    assert.doesNotMatch(JSON.stringify(brain2), /قاعدة بيانات للخادم/, 'بلا نيّةٍ لا مطالبة');
});

test('سياقُ الذاكرة يُشترط بما يطبعه — لا سطرَ APIs خاوياً', async () => {
    const { updateTech, buildMemoryContext, clearProjectMemory } = await import('../agents/projectMemory.js');
    const u = `t_${process.pid}`, p = 'proj';
    try {
        updateTech(u, p, { hasBackend: true, apis: [] });
        assert.doesNotMatch(buildMemoryContext(u, p) || '', /APIs موجودة/,
            'طُبع سطرُ APIs بقائمةٍ فارغة — الشرطُ يسأل عن غير ما يطبع');
        updateTech(u, p, { hasBackend: true, apis: ['auth.js'] });
        assert.match(buildMemoryContext(u, p) || '', /APIs موجودة: auth\.js/);
    } finally { try { clearProjectMemory(u, p); } catch { /* تنظيفٌ اختياريّ */ } }
});
