// ⏪ سادسُ ما يخرج من jcr وأوّلُ معالجِ نيّة: `_handleUndo` → `stages/undo.js#handleUndo(req, reporter)`.
// خطُّ الأساس القائم: jcrRuntimeFlows (تراجع بلا نسخة / مع نسخة عبر handleUserMessage).
// هنا: النصُّ بحروفه باللغتين، ترتيبُ البثّ الكامل عند الاسترجاع، ما لم يُسترجَع يُقال،
// غيرُ التراجع يعيد false بلا أثر، والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { handleUndo } from '../agents/stages/undo.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, tempProject, emptyProject } from './helpers/jcrScenario.mjs';
import { backupProject } from '../agents/fileManager.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p?.message ?? p]) }) }) }; };
const reqOf = (s, dir, message) => ({ message, roomName: s.ctx.roomName, projectPath: dir, username: s.ctx.username, activeProject: s.ctx.activeProject, userLang: 'ar' });

test('غيرُ التراجع: false بلا بثّ — والدالّةُ الحرّة ≡ المفوِّض', async () => {
    const s = scenario('undq'); const dir = emptyProject();
    assert.equal(await s.rt._handleUndo(reqOf(s, dir, 'أضف صفحة تواصل'), {}), false);
    const { events, reporter } = collect();
    assert.equal(await handleUndo(reqOf(s, dir, 'أضف صفحة تواصل'), reporter), false);
    assert.deepEqual(s.events, []); assert.deepEqual(events, []);
});

test('بلا نسخةٍ محفوظة: رسالةٌ واحدة بحروفها — عربيّةً ثمّ إنجليزيّةً بلغة الجلسة', async () => {
    const s = scenario('und0'); const dir = emptyProject(); setUserLanguage(s.ctx.username, 'ar');
    const a = collect();
    assert.equal(await handleUndo(reqOf(s, dir, 'تراجع'), a.reporter), true);
    assert.deepEqual(a.events, [['chat_reply', 'لا توجد نسخة سابقة محفوظة بعد — النسخ تُلتقط تلقائياً قبل كل تعديل قادم، فأمر «تراجع» سيعمل من التعديل التالي فصاعداً.']]);
    setUserLanguage(s.ctx.username, 'en');
    const b = collect();
    assert.equal(await handleUndo(reqOf(s, dir, 'undo'), b.reporter), true);
    assert.deepEqual(b.events, [['chat_reply', 'No saved snapshot yet — snapshots are taken automatically before every upcoming edit, so "undo" will work from the next change onward.']]);
});

test('مع نسخةٍ حقيقيّة: الملفّاتُ تعود، والبثُّ بترتيبه الكامل — سجلّ، معاينة، ملفّات، ردّ', async () => {
    const dir = tempProject('<!DOCTYPE html><html><body><h1>النسخة الأولى</h1><p>' + 'x'.repeat(120) + '</p></body></html>');
    const index = path.join(dir, 'index.html');
    assert.equal((await backupProject(dir, 'test')).success, true);
    fs.writeFileSync(index, '<!DOCTYPE html><html><body><h1>تعديل خاطئ</h1></body></html>');
    const s = scenario('und1'); setUserLanguage(s.ctx.username, 'ar');
    const { events, reporter } = collect();
    assert.equal(await handleUndo(reqOf(s, dir, 'استرجع النسخة السابقة'), reporter), true);
    assert.match(fs.readFileSync(index, 'utf8'), /النسخة الأولى/, 'المحتوى عاد من النسخة');
    assert.deepEqual(events.map(([ev]) => ev), ['log', 'preview_updated', 'workspace_files', 'chat_reply'], 'الترتيبُ كما كان');
    assert.match(events[0][1], /^\[EDIT\] ➔ \[Undo\]: ⏪ استُرجعت النسخة snapshot_[^ ]+ \(1 ملف\)\.$/, 'لا ذيلَ «لم تشملها» حين استُرجع كلُّ شيء');
    assert.deepEqual(events[2][1], ['index.html'], 'قائمةُ الملفّات بلا المخفيّة');
    assert.match(events[3][1], /^⏪ تم — استُرجعت النسخة السابقة \(.+\)، 1 ملفاً\. المعاينة تحدّثت\.$/);
});

test('ما لم يُسترجَع يُقال — ملفٌّ أُضيف بعد النسخة يبقى ويُذكر في السجلّ', async () => {
    const dir = tempProject('<!DOCTYPE html><html><body><h1>الأصل</h1><p>' + 'x'.repeat(120) + '</p></body></html>');
    assert.equal((await backupProject(dir, 'test')).success, true);
    fs.writeFileSync(path.join(dir, 'extra.html'), '<h1>بعد النسخة</h1>');
    const s = scenario('und2'); setUserLanguage(s.ctx.username, 'ar');
    const { events, reporter } = collect();
    await handleUndo(reqOf(s, dir, 'تراجع'), reporter);
    assert.ok(fs.existsSync(path.join(dir, 'extra.html')), 'الاسترجاعُ لا يحذف ما لم تشمله النسخة');
    assert.match(events[0][1], /1 ملفاً لم تشملها النسخة فبقيت كما هي \(extra\.html\)/, 'لا يُقرأ ✅ على استرجاعٍ ناقص');
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد، والأسماءُ الثلاثة رحلت من jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/undo.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /async _handleUndo\(req, agents\) \{\n\s+return handleUndo\(req, this\.reporter\);\n\s+\}/);
    for (const n of ['isUndoCommand', 'listSnapshots', 'restoreSnapshot']) assert.equal((jcr.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length, 0, `${n} لم يعد لـjcr به شأن`);
});
