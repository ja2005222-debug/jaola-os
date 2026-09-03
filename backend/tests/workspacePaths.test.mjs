// 🛡️ حرّاس المسار: أول تغطية اختبارية لهم على الإطلاق (كانوا ثلاثةً بلا اختبار واحد).
// تُثبِّت نواة الاحتواء المشتركة **وكل سياسة على حدة كما هي** — لا دمج أعمى.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isInsideRoot, resolveInside, safeRelPath } from '../core/runtime/workspacePaths.js';
import { sanitizePath } from '../middleware/security.js';
import { writeBackendTeamFiles } from '../agents/backendTeam/index.js';

test('isInsideRoot: الشقيق ذو البادئة المشتركة مرفوض (العطب الذي أصلحته النواة)', () => {
    assert.equal(isInsideRoot('/w/proj', '/w/proj/a.js'), true);
    assert.equal(isInsideRoot('/w/proj', '/w/proj'), true, 'الجذر نفسه داخل نفسه');
    assert.equal(isInsideRoot('/w/proj', '/w/proj-evil/a.js'), false, 'بادئة مشتركة ≠ احتواء');
    assert.equal(isInsideRoot('/w/proj', '/w/other/a.js'), false);
    assert.equal(isInsideRoot('/w/proj', '/w/proj/../proj-evil/x'), false, 'يُطبَّع قبل المقارنة');
    for (const bad of [null, undefined, '', 42]) assert.equal(isInsideRoot('/w/proj', bad), false, String(bad));
});

test('resolveInside: يعيد المطلق داخل الجذر وnull للخارج', () => {
    assert.equal(resolveInside('/w/proj', 'sub/a.js'), path.resolve('/w/proj/sub/a.js'));
    assert.equal(resolveInside('/w/proj', '../evil.js'), null);
    assert.equal(resolveInside('/w/proj', '../proj-evil/x'), null);
    assert.equal(resolveInside('', 'a.js'), null);
});

test('سياسة safeRelPath كما هي: قائمة أحرف بيضاء، حدّ 200، رفض صامت بـnull', () => {
    assert.equal(safeRelPath('api/routes/users.js'), 'api/routes/users.js');
    assert.equal(safeRelPath('\\win\\style.js'), 'win/style.js', 'يوحّد الفواصل');
    assert.equal(safeRelPath('/leading/abs.js'), 'leading/abs.js', 'يُجرَّد الجذر لا يُرفض');
    for (const bad of ['../up.js', 'a/../b.js', 'a<b.js', 'a\0b.js', 'x'.repeat(201), '', 42, null]) {
        assert.equal(safeRelPath(bad), null, JSON.stringify(String(bad)).slice(0, 30));
    }
    // موثَّق لا مُصلَح: \w لاتيني → الأسماء العربية تُرفض بهذه السياسة
    assert.equal(safeRelPath('واجهة/صفحة.js'), null, 'سياسة قائمة الأحرف الحالية');
});

test('سياسة sanitizePath كما هي: ترمي (لا تعيد null) وتُرجع مساراً مطلقاً', () => {
    const root = '/w/proj';
    assert.equal(sanitizePath('assets/logo.svg', root), path.resolve(root, 'assets/logo.svg'));
    for (const bad of ['../escape.js', '/etc/passwd', 'a\0b']) {
        assert.throws(() => sanitizePath(bad, root), /Path traversal|Access denied/, String(bad));
    }
    assert.throws(() => sanitizePath('', root), /non-empty string/);
});

test('writeBackendTeamFiles: يكتب داخل الجذر ويتخطّى الهروب بصمت (سلوك محفوظ)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-wp-'));
    const written = await writeBackendTeamFiles([
        { path: 'api/users.js', content: 'ok' },
        { path: '../escape.js', content: 'BAD' },
        { path: 'a<b.js', content: 'BAD' },
    ], dir);
    assert.deepEqual(written, ['api/users.js'], 'المقبول وحده يُكتب');
    assert.equal(fs.readFileSync(path.join(dir, 'api/users.js'), 'utf-8'), 'ok');
    assert.equal(fs.existsSync(path.join(path.dirname(dir), 'escape.js')), false, 'لا كتابة خارج الجذر');
});
