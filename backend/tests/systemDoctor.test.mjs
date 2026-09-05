/**
 * 🩺 فحصٌ لا يستطيع أن يفشل ليس فحصاً — Sprint 3l
 *
 * `runSystemDiagnostics` هي ما يراه المشرف على `/api/admin/health`. وكانت فيها
 * ثلاثةُ مواضع تقول «سليم» بلا أن تنظر:
 *   • الذاكرة: المقامُ `os.totalmem()` — ذاكرةُ **المضيف** لا حدُّ الحاوية.
 *     قِيس هنا: ٧٩ MB من ١٦٠٧٥ MB، أي أنّ التحذيرَ يلزمه ١١٢٥٣ MB في عمليةٍ
 *     واحدة — وحاويةُ Render تقتلها عند ٥١٢.
 *   • القرص: كان يعدّ **عناصر** المجلّد ويقول `ok` دائماً.
 *   • الإضافات: يُحذف الصفُّ كلُّه إن لم يُهيّأ المنسّق — وهي بالضبط حالةُ
 *     إخفاقه — فيقول الملخّص «كل الأنظمة سليمة ✅».
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { runSystemDiagnostics, formatDiagnostics, resolveMemoryLimit } from '../agents/systemDoctorAgent.js';
import { orchestrator } from '../core/PluginOrchestrator.js';

const rowOf = (report, needle) => report.checks.find((c) => c.name.includes(needle));

test('🔴 صفُّ الإضافات حاضرٌ ولو لم يُهيّأ المنسّق', () => {
    const r = runSystemDiagnostics();
    const row = rowOf(r, 'الإضافات');
    assert.ok(row, 'اختفى الصفُّ — والغيابُ يُقرأ سلامةً في الملخّص');
    if (!orchestrator.initialized) {
        assert.equal(row.status, 'warn', 'منسّقٌ غيرُ مهيّأ ليس حالةً سليمة');
        assert.ok(row.fix, 'حالةٌ غيرُ سليمةٍ بلا إرشاد');
    }
});

test('🔴 مقامُ الذاكرة حدٌّ حقيقيّ، ومصدرُه مُعلَن', () => {
    const r = runSystemDiagnostics();
    const row = rowOf(r, 'الذاكرة');
    const m = /^المستخدَم: (\d+) MB من (\d+) MB \((الحاوية|المضيف)\)$/.exec(row.detail);
    assert.ok(m, `صيغةُ القياس لا تُعلن مقامَها ولا مصدرَه: ${row.detail}`);
    const [, used, limit, source] = m;
    const hostMb = Math.round(os.totalmem() / (1024 * 1024));
    assert.ok(Number(limit) > 0 && Number(limit) <= hostMb, 'المقامُ يتجاوز ذاكرة المضيف');
    assert.ok(Number(used) > 0);

    // ليست حشواً: تؤكّد أنّ اختيار المصدر يطابق البيئة لا أنّه ثابت
    const cgroupLimit = ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']
        .map((p) => { try { const v = fs.readFileSync(p, 'utf8').trim(); return v === 'max' ? null : Math.round(Number(v) / (1024 * 1024)); } catch { return null; } })
        .find((mb) => Number.isFinite(mb) && mb > 0 && mb <= hostMb);
    assert.equal(source, cgroupLimit ? 'الحاوية' : 'المضيف',
        'المصدرُ المُعلَن لا يطابق ما تفرضه البيئة فعلاً');
    if (cgroupLimit) assert.equal(Number(limit), cgroupLimit);
});

test('🔴 القرصُ يُقاس لا يُعَدّ، والحالةُ مشتقّةٌ من النسبة', () => {
    const r = runSystemDiagnostics();
    const row = rowOf(r, 'القرص');
    assert.ok(row, 'لا صفَّ للقرص أصلاً');
    const m = /متاح: ([\d.]+) GB من ([\d.]+) GB \(مستخدَم (\d+)%\)/.exec(row.detail);
    assert.ok(m, `القياسُ لا يذكر مساحةً: ${row.detail}`);
    const [, free, total, pct] = m;
    assert.ok(Number(total) > 0 && Number(free) >= 0 && Number(free) <= Number(total));

    const st = fs.statfsSync('.');
    const realTotal = +(st.blocks * st.bsize / 1073741824).toFixed(1);
    assert.ok(Math.abs(Number(total) - realTotal) / realTotal < 0.02, 'الرقمُ المُعلَن ليس قياساً حقيقياً');

    const used = Number(pct);
    const expected = used >= 95 ? 'critical' : used >= 85 ? 'warn' : 'ok';
    assert.equal(row.status, expected, 'الحالةُ ثابتةٌ لا مشتقّةٌ من النسبة');
});

test('الحكمُ العامّ يُشتقّ من أسوأ صفٍّ لا يُكتب', () => {
    const r = runSystemDiagnostics();
    const hasCrit = r.checks.some((c) => c.status === 'critical');
    const hasWarn = r.checks.some((c) => c.status === 'warn');
    assert.equal(r.overall, hasCrit ? 'critical' : hasWarn ? 'warn' : 'ok');
    if (hasCrit) assert.match(r.summary, /مشكلة حرجة/);
    else if (hasWarn) assert.match(r.summary, /تحذير/);
    else assert.match(r.summary, /سليمة/);
});

test('كلُّ صفٍّ غيرِ سليمٍ يحمل إرشاداً — والتقريرُ يُعرض كاملاً', () => {
    const r = runSystemDiagnostics();
    for (const c of r.checks) {
        assert.ok(['ok', 'warn', 'critical'].includes(c.status), `حالةٌ مجهولة: ${c.status}`);
        assert.ok(c.name && c.detail, 'صفٌّ بلا اسمٍ أو تفصيل');
    }
    const text = formatDiagnostics(r);
    for (const c of r.checks) {
        assert.ok(text.includes(c.name), `الصفُّ «${c.name}» غائبٌ عن النصّ المعروض`);
        if (c.fix) assert.ok(text.includes(c.fix), 'إرشادٌ لا يصل إلى المشرف');
    }
});

test('التقريرُ يحمل زمنَه ومدّةَ التشغيل', () => {
    const r = runSystemDiagnostics();
    assert.ok(Number.isInteger(r.uptimeSec) && r.uptimeSec >= 0);
    assert.ok(Math.abs(Date.now() - r.checkedAt) < 5000, 'الطابعُ الزمنيُّ ليس لحظةَ الفحص');
    assert.ok(r.checks.length >= 7, `عدد الفحوص ${r.checks.length} — سقط صفّ`);
});

test('عدّادُ مزوّدي الذكاء يتبع البيئة لا افتراضاً', () => {
    const keys = ['GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
    const saved = keys.map((k) => [k, process.env[k]]);
    try {
        for (const k of keys) delete process.env[k];
        assert.equal(rowOf(runSystemDiagnostics(), 'مزوّدو').status, 'critical');
        process.env.GROQ_API_KEY = 'x';
        assert.equal(rowOf(runSystemDiagnostics(), 'مزوّدو').status, 'warn');
        process.env.DEEPSEEK_API_KEY = 'y';
        const two = rowOf(runSystemDiagnostics(), 'مزوّدو');
        assert.equal(two.status, 'ok');
        assert.equal(two.fix, undefined, 'حالةٌ سليمةٌ لا تحتاج إرشاداً');
    } finally {
        for (const [k, v] of saved) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
});

test('🔴 حدُّ الحاوية يغلب ذاكرةَ المضيف حين يوجد', () => {
    const HOST = 16075;
    // ٥١٢ MB بالبايت — حاويةُ Render النموذجية
    assert.deepEqual(resolveMemoryLimit([String(512 * 1024 * 1024)], HOST), { mb: 512, source: 'الحاوية' });
    // cgroup v2 تكتب «max» حين لا حدّ
    assert.deepEqual(resolveMemoryLimit(['max'], HOST), { mb: HOST, source: 'المضيف' });
    // v1 تكتب رقماً فلكياً حارساً — لا يُقرأ حدّاً
    assert.deepEqual(resolveMemoryLimit(['9223372036854771712'], HOST), { mb: HOST, source: 'المضيف' });
    // لا cgroup أصلاً
    assert.deepEqual(resolveMemoryLimit([null, null], HOST), { mb: HOST, source: 'المضيف' });
    assert.deepEqual(resolveMemoryLimit([], HOST), { mb: HOST, source: 'المضيف' });
    // الأوّلُ الصالحُ يفوز، والفارغُ يُتخطّى
    assert.deepEqual(resolveMemoryLimit(['  ', String(256 * 1024 * 1024)], HOST), { mb: 256, source: 'الحاوية' });
});

test('حاويةٌ عند ٥١٢ MB: عمليةٌ بـ٤٠٠ MB تحذير، وبـ٤٦٠ حرجة', () => {
    const at = (rss, limit) => (rss > limit * 0.85 ? 'critical' : rss > limit * 0.7 ? 'warn' : 'ok');
    const { mb } = resolveMemoryLimit([String(512 * 1024 * 1024)], 16075);
    assert.equal(at(300, mb), 'ok');
    assert.equal(at(400, mb), 'warn');
    assert.equal(at(460, mb), 'critical');
    // وبمقام المضيف القديم لبقيت الثلاثةُ «سليمة»
    assert.equal(at(460, 16075), 'ok');
});
