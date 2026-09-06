// ➕ JCR/متابعة-ج — احتياطُ `_addPageNow`: بلا `lib/content.js` كان السجلُّ يعد بـ«عودة للبناء» ثمّ يرمي
// `ReferenceError: ctx is not defined` (المتغيّرُ ليس من وسائط الطريقة الستّ)، فتموت المهمّةُ في الصفّ
// (`[MissionQueue] … انتهت بخطأ`) بلا ردٍّ للمستخدم. الآن يصل الاحتياطُ إلى `_runMissionNow` بسياقٍ من الوسائط.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

test('بلا lib/content.js: الاحتياطُ يصل إلى _runMissionNow بالأمر نفسِه وسياقٍ كاملٍ من الوسائط — لا ReferenceError', async () => {
    const s = scenario('addfb'); const dir = emptyProject(); const calls = [];
    s.rt._runMissionNow = async (goal, ctx) => { calls.push({ goal, ctx }); return { success: true, via: 'rebuild' }; };
    const r = await s.rt._addPageNow('أضف صفحة الأسعار', dir, s.ctx.username, s.ctx.activeProject, s.ctx.roomName, 'ar');
    assert.deepEqual(r, { success: true, via: 'rebuild' });
    assert.equal(calls.length, 1); assert.equal(calls[0].goal, 'أضف صفحة الأسعار');
    assert.deepEqual(calls[0].ctx, { username: s.ctx.username, activeProject: s.ctx.activeProject, projectPath: dir, roomName: s.ctx.roomName, agents: {}, dbStatus: null });
    assert.ok(Object.isFrozen(calls[0].ctx), 'سياقُ تنفيذٍ حقيقيّ (createExecutionContext)');
    assert.ok(s.logs().includes('⚠️ تعذّر قراءة المحتوى — عودة للبناء:'), 'سطرُ الوعد يبقى — والوعدُ يُنجَز');
});

test('المشروعُ القائم لا يمسّه الاحتياط: بمحتوىً مقروء تُضاف الصفحةُ ولا يُستدعى _runMissionNow', async () => {
    const s = scenario('addok'); const dir = emptyProject(); let rebuilds = 0;
    s.rt._runMissionNow = async () => { rebuilds++; return { success: true }; };
    const fs = await import('fs'); const path = await import('path');
    fs.mkdirSync(path.join(dir, 'lib')); fs.mkdirSync(path.join(dir, 'components')); fs.mkdirSync(path.join(dir, 'app'));
    fs.writeFileSync(path.join(dir, 'lib/content.js'), `export const content = ${JSON.stringify({ brand: 'x', sections: {}, routes: [{ label: 'الرئيسية', href: '/' }] })};\n`);
    const r = await s.rt._addPageNow('أضف صفحة الأسعار', dir, s.ctx.username, s.ctx.activeProject, s.ctx.roomName, 'ar');
    assert.equal(r.success, true); assert.equal(r.label, 'الأسعار'); assert.equal(rebuilds, 0);
});
