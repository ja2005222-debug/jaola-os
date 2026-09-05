// 📡 RoomReporter — الشقُّ الذي يفصل البثَّ عن `this` في jcr.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomReporter } from '../core/runtime/RoomReporter.js';

function fakeIo() {
    const events = [];
    return { events, io: { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) } };
}

test('send تنقل النداءَ حرفيّاً: الغرفةُ والحدثُ والحمولةُ كما هي', () => {
    const { events, io } = fakeIo();
    const r = new RoomReporter(io);
    const payload = { message: 'x', options: ['a'] };
    r.send('room-1', 'chat_reply', payload);
    assert.deepEqual(events, [{ room: 'room-1', ev: 'chat_reply', payload }]);
    assert.equal(events[0].payload, payload, 'المرجعُ نفسُه — لا نسخ ولا تحويل');
});

test('liveLog تُنسّق [الطبقة] ➔ [الوكيل]: الرسالة، وتبثّ على حدث log', () => {
    const { events, io } = fakeIo();
    new RoomReporter(io).liveLog('r', '5. RUNTIME', 'Coder', 'كتابة الشفرة...');
    assert.deepEqual(events, [{ room: 'r', ev: 'log', payload: { message: '[5. RUNTIME] ➔ [Coder]: كتابة الشفرة...' } }]);
});

test('الترجمةُ تقع فقط حين لغةُ الغرفة en — والعربيّةُ هي الأصل', () => {
    const { events, io } = fakeIo();
    const r = new RoomReporter(io, { localize: (m) => m.replace('كتابة', 'Writing') });
    r.liveLog('ar-room', 'L', 'A', 'كتابة');
    r.setLang('en-room', 'en');
    r.liveLog('en-room', 'L', 'A', 'كتابة');
    r.setLang('fr-room', 'fr');
    r.liveLog('fr-room', 'L', 'A', 'كتابة');
    assert.deepEqual(events.map((e) => e.payload.message), ['[L] ➔ [A]: كتابة', '[L] ➔ [A]: Writing', '[L] ➔ [A]: كتابة']);
});

test('بلا مُترجمٍ مُحقَن: هويّة — لا استيرادَ من agents/ (حدُّ الطبقة)', () => {
    const { events, io } = fakeIo();
    const r = new RoomReporter(io);
    r.setLang('r', 'en');
    r.liveLog('r', 'L', 'A', 'نصٌّ عربيّ');
    assert.equal(events[0].payload.message, '[L] ➔ [A]: نصٌّ عربيّ');
});

test('setLang/langOf: تتجاهل الفراغ، وتُبدّل اللغةَ بلا أثرٍ على غرفٍ أخرى', () => {
    const r = new RoomReporter(fakeIo().io);
    r.setLang('', 'en'); r.setLang('r', ''); r.setLang(null, 'en');
    assert.equal(r.langOf('r'), undefined);
    r.setLang('r', 'en'); r.setLang('s', 'ar');
    assert.equal(r.langOf('r'), 'en'); assert.equal(r.langOf('s'), 'ar');
    r.setLang('r', 'ar');
    assert.equal(r.langOf('r'), 'ar'); assert.equal(r.langOf('s'), 'ar');
});

test('io بلا to() يُرفض عند البناء برسالةٍ واضحة، لا عند أوّل بثّ', () => {
    assert.throws(() => new RoomReporter({}), /io\.to\(room\)\.emit مطلوب/);
    assert.throws(() => new RoomReporter(null), TypeError);
});
