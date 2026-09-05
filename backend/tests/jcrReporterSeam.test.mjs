// 📡 الشقُّ: كلُّ بثٍّ من jcr إلى غرفةِ المستخدم يمرّ بالمُبلِّغ الواحد.
//
// قِيس قبل الشقّ: ١١٤ موضعَ `this.io.to(roomName).emit` + ١٥٣ `emitLiveLog` +
// خريطةُ لغةٍ كسولة — ٦٥٪ من إشارات `this`. بعده: `this.io` يبقى **قيمةً**
// تُمرَّر لتسعةِ نداءاتٍ خارجيّة فقط، ولا `.to(` عليه داخلَ الصنف.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { layerEdges, edgesBetween } from '../scripts/layerEdges.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const SRC = fs.readFileSync(path.join(import.meta.dirname, '../agents/jcr.js'), 'utf8');

test('لا بثَّ مباشراً على io داخلَ jcr — المُبلِّغُ هو الباب', () => {
    assert.equal((SRC.match(/this\.io\.to\(/g) || []).length, 0, 'this.io.to( عاد إلى jcr');
    // JCR/10: تمريرةٌ خرجت مع `_buildFromRegistry` (صارت `reporter.io` هناك)؛ JCR/11: ثانيةٌ خرجت مع
    // `_reportMissionSuccess` (الدفعُ التلقائيّ) — ٨ = الإسناد + ٧ تمريرات.
    assert.equal((SRC.match(/this\.io\b/g) || []).length, 8, 'إسنادُ البانية + ٧ تمريراتٍ قيمةً — لا أكثر');
    assert.ok(!/roomLang/.test(SRC), 'لغةُ الغرفة انتقلت إلى المُبلِّغ');
    // كان ≥ ١٠٠ يومَ الشقّ (١١٣ موضعاً)؛ الاستخراجاتُ JCR/4–11 أخذت معها بثّها — الأرضيّةُ تتبع القياس: 96 موضعاً الآن.
    assert.ok((SRC.match(/this\.reporter\.send\(roomName, /g) || []).length >= 90, 'النقلُ الحرفيّ وقع — والبثُّ ما زال عبر المُبلِّغ');
});

test('البانيةُ تبني المُبلِّغَ من io نفسِه وتُبقي io للتمرير', () => {
    const io = { to: () => ({ emit: () => {} }) };
    const rt = new JaolaCognitiveRuntime(io);
    assert.ok(rt.reporter instanceof RoomReporter);
    assert.equal(rt.reporter.io, io);
    assert.equal(rt.io, io, 'io يبقى — يُمرَّر لـautoPushIfEnabled وdeployToRender');
});

test('emitLiveLog يُترجم للغرفة الإنجليزيّة عبر المُبلِّغ — السلوكُ كما كان', () => {
    const events = [];
    const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, p) => events.push({ room, ev, p }) }) });
    rt.emitLiveLog('r1', 'STACK', 'HybridRouter', 'مسار سريع → Vanilla');
    rt.reporter.setLang('r2', 'en');
    rt.emitLiveLog('r2', 'STACK', 'HybridRouter', 'مسار سريع → Vanilla');
    assert.equal(events[0].p.message, '[STACK] ➔ [HybridRouter]: مسار سريع → Vanilla');
    assert.equal(events[0].ev, 'log');
    assert.notEqual(events[1].p.message, events[0].p.message, 'الإنجليزيّةُ تُترجَم');
    assert.match(events[1].p.message, /^\[STACK\] ➔ \[HybridRouter\]: /);
});

test('حدُّ الطبقة صامد: core لا يستورد من agents ولا services', () => {
    const edges = layerEdges();
    assert.deepEqual(edgesBetween(edges, 'core', 'agents'), []);
    assert.deepEqual(edgesBetween(edges, 'core', 'services'), []);
});
