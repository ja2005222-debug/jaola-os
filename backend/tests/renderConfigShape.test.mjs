// 🚀 شكلُ `render.yaml` — سؤالٌ واحدٌ بخمسة أجوبة
//
// `prepareRenderDeploy(projectPath, name, hasBackend)` يكتب إعدادَ Render،
// و`hasBackend` يقلب الإعدادَ رأساً على عقب: **موقعٌ ثابت** (`env: static`)
// مقابل **خدمة Node** (`npm install` + `node server.js` + `MONGODB_URI`).
//
// والسؤال «أيحتاج هذا المشروع خلفيةً؟» له **مصدرُ حقيقةٍ واحد** منذ Sprint 7/1
// (`agents/backendNeed.js: needsBackend`). ومع ذلك يُجاب في خمسة مواضع:
//
//   • `jcr.js:983`        → `needsBackend(...)`  ← المصدرُ الواحد ✅
//   • `jcr.js:2321/2383`  → `false` ثابتاً       ← مسارُ الكلون الثابت (مقصود)
//   • `server.js:2382`    → `false` ثابتاً       ← `/api/template/apply` (مقصود)
//   • مسارا النشر         → `true` ثابتاً        ← يُعيدان الكتابة فوق ما سبق
//
// 🔴 **النتيجةُ المقيسة**: كلُّ نشرٍ يُعيد توليدَ `render.yaml` بـ`true`، فيُلغي
//    قرارَ «موقعٌ ثابت» الذي اتُّخذ عند التجهيز. مشروعٌ ثابتٌ يُنشَر خدمةَ Node.
//    أهذا مقصودٌ («خادمٌ دائم» كما يقول سجلُّ النشر) أم انحراف؟ قرارُ سلوكٍ
//    يمسّ مواقعَ منشورةً حيّة — فلا يُغيَّر في تدقيق. هذا الحارسُ يثبّت الحالةَ
//    المقيسة **بأسمائها** كي لا تنزلق أكثر، ويجعل أيَّ تغييرٍ قراراً واعياً.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
import { generateRenderConfig } from '../agents/renderAgent.js';

divertConsoleToStderr();

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(BACKEND, f), 'utf8');

test('العلَمُ يقلب الإعدادَ فعلاً — وإلا فلا معنى لبقيّة الملفّ', () => {
    const stat = generateRenderConfig('demo', false);
    const node = generateRenderConfig('demo', true);
    assert.match(stat, /env: static/);
    assert.doesNotMatch(stat, /startCommand/);
    assert.match(node, /env: node/);
    assert.match(node, /startCommand: node server\.js/);
    assert.match(node, /MONGODB_URI/);
});

test('مواضعُ الجواب الخمسة كما قِيست — أيُّ تغييرٍ قرارٌ لا انزلاق', () => {
    // تُشتقّ من القرص: النصُّ هو الحقيقة، لا قائمةٌ في ذاكرتي.
    const sites = [];
    for (const f of ['agents/jcr.js', 'server.js', 'agents/renderAgent.js', 'services/deployAutomation.js']) {
        read(f).split('\n').forEach((line, i) => {
            const m = /prepareRenderDeploy\(|prepare\(projectPath/.exec(line);
            if (!m || /export (async )?function/.test(line)) return;
            const arg = /,\s*(true|false)\s*\)/.exec(line) || /,\s*(\w+)\s*\)/.exec(line);
            sites.push(`${f}:${i + 1} → ${arg ? arg[1] : '?'}`);
        });
    }
    assert.deepEqual(sites.sort(), [
        'agents/jcr.js:2321 → false',
        'agents/jcr.js:2383 → false',
        'agents/jcr.js:983 → hasBackend',
        'agents/renderAgent.js:172 → hasBackend',
        'server.js:2382 → false',
        'services/deployAutomation.js:213 → true',
    ], 'مواضعُ تقرير شكل `render.yaml` تغيّرت — راجع الحارسَ والوثيقة معاً');
});

test('مسارا النشر يفرضان `true` — فيلغيان قرارَ التجهيز', () => {
    assert.match(read('server.js'), /deployToRender\([\s\S]{0,400}?hasBackend: true/,
        '`/api/deploy` لم يعد يمرّر `true` صراحةً — تغيّر السلوك');
    assert.match(read('services/deployAutomation.js'), /prepare\(projectPath, projectSlug, true\)/,
        '`autoDeployFullStack` لم يعد يمرّر `true` صراحةً — تغيّر السلوك');
});

test('«أيحتاج خلفيةً؟» له مصدرٌ واحدٌ قائم — والمواضعُ الثابتة تتجاوزه', () => {
    const need = read('agents/backendNeed.js');
    assert.match(need, /export function needsBackend/, 'مصدرُ الحقيقة الواحد اختفى');
    assert.match(read('agents/jcr.js'), /needsBackend\(context\.originalGoal\)/,
        'الموضعُ الوحيد الذي يسأل المصدرَ الواحد لم يعد يفعل');
});
