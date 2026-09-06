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
    // JCR/10: تمريرةٌ خرجت مع `_buildFromRegistry` (صارت `reporter.io` هناك)؛ JCR/11: ثانيةٌ مع
    // `_reportMissionSuccess`؛ JCR/12: ثالثةٌ مع `_buildFromClone`؛ JCR/19: رابعةٌ مع `_buildReactProject`؛
    // JCR/20: خامسةٌ مع `_persistReactContent`؛ JCR/22: سادسةٌ مع `_runSurgicalEditNow`؛ JCR/23: سابعةٌ مع `_addPageNow`؛
    // JCR/24: الأخيرتان (`deployToRender` ووكيلُ النشر) مع `_handleCeoIntent` — لم يبقَ إلّا إسنادُ البانية: jcr لا يمرّر io بنفسه.
    assert.equal((SRC.match(/this\.io\b/g) || []).length, 1, 'إسنادُ البانية وحدَه — كلُّ تمريرةٍ خرجت مع مرحلتها عبر reporter.io');
    assert.ok(!/roomLang/.test(SRC), 'لغةُ الغرفة انتقلت إلى المُبلِّغ');
    // كان ≥ ١٠٠ يومَ الشقّ (١١٣ موضعاً)؛ الاستخراجاتُ JCR/4–12 أخذت معها بثّها — الأرضيّةُ تتبع القياس:
    // 90 موضعاً بعد JCR/12، و84 بعد JCR/19، و76 بعد JCR/20، و65 بعد JCR/22، و59 بعد JCR/23، و43 بعد JCR/24، و36 بعد JCR/25
    // (معالجا الخطّة والنمط أخذا ٧) — الأرضيّةُ تنزل إلى ٣٠: ما زالت تُمسك عودةَ البثّ إلى الصنف بلا مُبلِّغ، وتُعاد بالقياس.
    assert.ok((SRC.match(/this\.reporter\.send\(roomName, /g) || []).length >= 30, 'النقلُ الحرفيّ وقع — والبثُّ ما زال عبر المُبلِّغ');
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
