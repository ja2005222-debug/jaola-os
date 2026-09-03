// 🧾 سجلّ المهام الدائم — المهمة لا تسقط صامتة مع إعادة تشغيل الخادم
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { enqueueMission, takeLostMission, noteLostMission, ledgerPath } from '../services/missionQueue.js';

const readLedger = () => JSON.parse(fs.readFileSync(ledgerPath(), 'utf-8') || '[]');

test('السجلّ يعكس المهمة الجارية بهدفها وغرفتها ثم يُمسح عند الانتهاء', async () => {
    let release;
    const running = new Promise(r => { release = r; });
    const U = `ledger-u-${Date.now()}`;
    enqueueMission({ username: U, project: 'p1', goal: 'ابني متجر عطور', roomName: 'room-1', run: () => running });
    const row = readLedger().find(r => r.username === U);
    assert.ok(row, 'المهمة في السجلّ');
    assert.equal(row.state, 'running');
    assert.equal(row.goal, 'ابني متجر عطور');
    assert.equal(row.roomName, 'room-1');
    release();
    await running; await new Promise(r => setImmediate(r));
    assert.ok(!readLedger().some(r => r.username === U), 'تُمسح بعد الانتهاء');
});

test('عملية جديدة تقرأ السجلّ كمهام ساقطة وتُفرغه، وtakeLostMission تُعطيها مرة واحدة', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
    const file = path.join(dir, 'mission_ledger.json');
    fs.writeFileSync(file, JSON.stringify([{ username: 'amal', project: 'shop', goal: 'متجر', roomName: 'r', state: 'waiting' }]));
    const script = `
        import { takeLostMission } from '${path.resolve('services/missionQueue.js').replace(/\\/g, '/')}';
        const a = takeLostMission('amal', 'shop'); const b = takeLostMission('amal', 'shop');
        console.log(JSON.stringify({ a, b }));`;
    const out = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, MISSION_LEDGER_PATH: file }, encoding: 'utf-8',
    });
    assert.equal(out.status, 0, out.stderr);
    const { a, b } = JSON.parse(out.stdout.trim().split('\n').pop());
    assert.equal(a.goal, 'متجر');
    assert.equal(a.state, 'waiting');
    assert.equal(b, null, 'مرة واحدة فقط');
    assert.equal(fs.readFileSync(file, 'utf-8'), '[]', 'السجلّ أُفرغ بعد القراءة');
});

test('noteLostMission ترفض المدخلات الناقصة', () => {
    assert.equal(noteLostMission({}), false);
    assert.equal(noteLostMission({ username: 'x', project: 'y', goal: 'g' }), true);
    assert.equal(takeLostMission('x', 'y').goal, 'g');
});
