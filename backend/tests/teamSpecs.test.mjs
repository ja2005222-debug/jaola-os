import test from 'node:test';
import assert from 'node:assert/strict';
import { orderTasks } from '../core/runtime/TaskGraph.js';
import { BACKEND_TEAM, TEAM_BY_ID } from '../agents/backendTeam/specs.js';
import { FRONTEND_TEAM, FRONTEND_TEAM_BY_ID } from '../agents/frontendTeam/specs.js';

// ═══════════════════════════════════════════════════════
// 📌 هذا الملفُّ **لم يُكشف فيه عطب**. فُحص `specs.js` (334 سطراً بلا تغطية)
// فوُجد سليماً: المعرّفات فريدة، و`dependsOn` كلُّها تشير إلى وكلاء موجودين،
// و`debugFor` يشير إلى وكيل QA حقيقيّ، والرسمُ يُرتَّب بلا دورة.
//
// فهذه الاختباراتُ **تثبيتُ سلامةٍ قائمة** لا إصلاحُ عطب: هي ما ينكسر صامتاً
// حين يُعاد تسميةُ وكيلٍ أو تُضاف تبعيةٌ لاسمٍ لا وجود له.
//
// ⚠️ وتحذيرٌ من خطأٍ وقعتُ فيه أثناء الفحص: ظننتُ `cooperation[].with`
// معرّفاتٍ فبدت كلُّها «مفقودة». وهي **أسماءُ أدوار** تُعرض نصّاً في الـprompt
// (`AgentSpec.js`: «- مع ${c.with}: ${c.how}») ولا يبحث عنها أحدٌ كمعرّف.
// فلا تُختبر بوصفها مراجع — وإلا صار الاختبارُ يقيس توقّعي لا الكود.
// ═══════════════════════════════════════════════════════

const TEAMS = [['backend', BACKEND_TEAM, TEAM_BY_ID], ['frontend', FRONTEND_TEAM, FRONTEND_TEAM_BY_ID]];

test('المعرّفات فريدة — والمفهرسُ لا يبتلع وكيلاً', () => {
    for (const [name, team, byId] of TEAMS) {
        const ids = team.map((a) => a.id);
        assert.equal(new Set(ids).size, ids.length, `${name}: معرّفٌ مكرّر`);
        // `Object.fromEntries` يُسقط المكرّر صامتاً، فالعددُ دليلُ عدم الابتلاع
        assert.equal(Object.keys(byId).length, team.length, `${name}: المفهرس أنقص من الفريق`);
        for (const a of team) assert.equal(byId[a.id], a, `${name}: ${a.id} غائبٌ عن المفهرس`);
    }
});

test('كلُّ dependsOn يشير إلى وكيلٍ في الفريق نفسه', () => {
    for (const [name, team] of TEAMS) {
        const ids = new Set(team.map((a) => a.id));
        for (const a of team) {
            for (const d of a.dependsOn || []) {
                assert.ok(ids.has(d), `${name}: «${a.id}» يعتمد على «${d}» ولا وجود له`);
            }
            assert.ok(!(a.dependsOn || []).includes(a.id), `${name}: «${a.id}» يعتمد على نفسه`);
        }
    }
});

test('وكيلُ التنقيح يشير إلى وكيل QA حقيقيّ ويعتمد عليه', () => {
    for (const [name, team] of TEAMS) {
        const ids = new Set(team.map((a) => a.id));
        const debuggers = team.filter((a) => a.debugFor);
        assert.equal(debuggers.length, 1, `${name}: المنتظَر وكيلُ تنقيحٍ واحد`);
        const [dbg] = debuggers;
        assert.ok(ids.has(dbg.debugFor), `${name}: debugFor «${dbg.debugFor}» لا وجود له`);
        // لا يُنقّح إلا ما يجري بعده — فلا بدّ أن يعتمد على هدفه
        assert.ok((dbg.dependsOn || []).includes(dbg.debugFor),
            `${name}: «${dbg.id}» يُنقّح «${dbg.debugFor}» ولا يعتمد عليه، فقد يسبقه`);
        assert.equal(dbg.modifier, true, `${name}: المنقِّحُ يعدّل ملفاتٍ سابقة فلْيكن modifier`);
    }
});

test('الرسمُ يُرتَّب بلا دورة، وكلُّ تابعٍ بعد متبوعه', () => {
    for (const [name, team] of TEAMS) {
        const ordered = orderTasks(team, { key: 'id', label: name });
        assert.equal(ordered.length, team.length, `${name}: الترتيب أسقط وكيلاً`);
        const seen = new Set();
        for (const a of ordered) {
            for (const d of a.dependsOn || []) {
                assert.ok(seen.has(d), `${name}: «${a.id}» رُتّب قبل متبوعه «${d}»`);
            }
            seen.add(a.id);
        }
    }
});

test('كلُّ عقدٍ مكتملُ الأقسام التسعة وغيرُ فارغ', () => {
    const LISTS = ['responsibilities', 'inputs', 'outputs', 'rules', 'qualityStandards', 'selfReview', 'neverDo'];
    for (const [name, team] of TEAMS) {
        for (const a of team) {
            assert.ok(a.id && a.role && a.mission?.trim(), `${name}: «${a.id}» بلا هوية أو مهمّة`);
            for (const k of LISTS) {
                assert.ok(Array.isArray(a[k]) && a[k].length, `${name}: «${a.id}» حقلُ ${k} فارغ`);
            }
            assert.ok(Array.isArray(a.cooperation) && a.cooperation.length, `${name}: «${a.id}» بلا تعاون`);
            for (const c of a.cooperation) {
                assert.ok(c.with?.trim() && c.how?.trim(), `${name}: «${a.id}» تعاونٌ ناقص`);
            }
        }
    }
});

test('لكل فريقٍ جذرٌ واحدٌ بلا تبعية — فالبداية غيرُ ملتبسة', () => {
    for (const [name, team] of TEAMS) {
        const roots = team.filter((a) => !(a.dependsOn || []).length);
        assert.equal(roots.length, 1, `${name}: الجذورُ ${roots.length} — البدايةُ ملتبسة`);
    }
});
