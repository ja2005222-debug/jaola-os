// 📦 جسرُ GitHub — حدودُ مسار `/api/project/import-repo` وسلوكُ حارسِه.
//
// الجلبُ كان مبنيّاً سلفاً (`fetchRepoFiles`) لكنّه يعود بالملفّات في ردِّ HTTP لمُشرِف
// ولا يكتبها إلى مساحة عملٍ قطّ. هذا المسارُ يُنزلها — ولذلك **ترتيبُ حارسِه هو العقد**:
// سؤالُ الوجود يُسأل **قبل** أيّ كتابة، وإلّا عاد العطبُ الذي أُصلح في `isFreshBuild`
// بعينه من بابٍ آخر: مشروعٌ عامرٌ يُدهَس صامتاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { hasProjectSource } from '../agents/projectReader.js';
import { landRepoFiles } from '../core/runtime/workspacePaths.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = fs.readFileSync(path.join(HERE, '../server.js'), 'utf8');

/** جسدُ المسار وحدَه — من سطر التسجيل إلى إغلاقه */
const routeBody = () => {
    const start = SERVER.indexOf("app.post('/api/project/import-repo'");
    assert.ok(start > 0, 'المسارُ مسجَّل');
    const end = SERVER.indexOf("\n});", start);
    assert.ok(end > start, 'وله نهايةٌ');
    return SERVER.slice(start, end);
};

test('الحارسُ قبل الكتابة: `hasProjectSource` يسبق `landRepoFiles` في الجسد — لا بعده', () => {
    const body = routeBody();
    const guard = body.indexOf('hasProjectSource(');
    const write = body.indexOf('landRepoFiles(');
    assert.ok(guard > 0 && write > 0, 'كلاهما حاضر');
    assert.ok(guard < write, 'سؤالُ الوجود أوّلاً — وإلّا كُتب فوقَ مشروعٍ قائمٍ ثمّ سُئل');
    // والردُّ ٤٠٩ يقع بينهما: يُردّ ولا يُكتب حرف
    const refuse = body.indexOf('409');
    assert.ok(refuse > guard && refuse < write, 'الرفضُ بين السؤال والكتابة');
});

test('الحارسُ يُتخطّى بإذنٍ صريحٍ وحدَه (`overwrite`) — لا افتراضاً', () => {
    const body = routeBody();
    assert.match(body, /if \(!overwrite && await hasProjectSource\(/, 'التخطّي بنفيِ `overwrite` لا بغيره');
    assert.match(body, /const \{ repo, ref, overwrite \} = req\.body/);
});

test('العزلُ والمصادقة: المسارُ خلف `verifyToken` و`validateProjectOwnership`، والمسارُ من التوكن لا من الجسم', () => {
    const line = SERVER.slice(SERVER.indexOf("app.post('/api/project/import-repo'")).split('\n')[0];
    for (const mw of ['verifyToken', 'validateProjectOwnership']) assert.ok(line.includes(mw), `${mw} حاضر`);
    const body = routeBody();
    assert.match(body, /const projectPath = req\.projectPath;/, 'المسارُ يُشتقّ من الوسيط لا من `req.body`');
    assert.equal(/req\.body[^\n]*projectPath|projectPath\s*=\s*req\.body/.test(body), false, 'ولا يُقبل مسارٌ من العميل');
});

test('الرابطُ يُحلَّل ولا يُمرَّر خاماً: `parseRepoUrl` قبل `fetchRepoFiles`', () => {
    const body = routeBody();
    const parse = body.indexOf('parseRepoUrl(');
    const fetchAt = body.indexOf('fetchRepoFiles(');
    assert.ok(parse > 0 && parse < fetchAt, 'التحليلُ أوّلاً — فهو الذي يتحقّق من صحّة المالك والاسم');
});

test('صدقُ الردّ: يقول ما رُدّ وما تخطّاه الجالب وأنّ المجلوبَ قصٌّ بحدود', () => {
    const body = routeBody();
    assert.match(body, /rejected: landed\.rejected/, 'ما لم ينزل يُسمّى لا يُبتلع');
    assert.match(body, /bounded: true/, 'ولا يُقال «نزل المستودع» وهو بعضُه');
    for (const k of ['skipped', 'truncated', 'count']) {
        assert.ok(new RegExp(`\\b${k}\\b`).test(body), `${k} في الردّ`);
    }
});

test('لا دعوى تشغيل: الجسدُ لا يشغّل شيئاً ولا يثبّت اعتماديّة', () => {
    const body = routeBody();
    for (const bad of ['exec', 'spawn', 'npm ', 'install']) {
        assert.equal(body.includes(bad), false, `«${bad}» لا يظهر — الإنزالُ إنزال`);
    }
});

// ── سلوكُ الحارس نفسِه، لا شكلُه ────────────────────────────────────────
test('سلوكاً: مشروعٌ عامرٌ يمنع الإنزال، وفارغٌ يقبله — والقرارُ من القرص', async () => {
    const full = fs.mkdtempSync(path.join(os.tmpdir(), 'imp1_'));
    fs.writeFileSync(path.join(full, 'main.php'), '<?php\n'.repeat(40));   // اسمٌ خارج القائمة المغلقة
    assert.equal(await hasProjectSource(full), true, 'مستودعٌ باسمٍ غيرِ الثلاثة يُرى — هذا ما أصلحه البند السابق');

    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'imp2_'));
    assert.equal(await hasProjectSource(empty), false);
    const r = await landRepoFiles(empty, [{ name: 'package.json', content: '{}' }, { name: '.github/workflows/ci.yml', content: 'on: push' }]);
    assert.deepEqual([r.written, r.rejected], [2, []]);
    assert.ok(fs.existsSync(path.join(empty, '.github/workflows/ci.yml')), 'ودليلُ الصيانة ينزل');
});
