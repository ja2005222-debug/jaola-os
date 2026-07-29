// 👥 حضور مبسّط: عدد جلسات/أجهزة نفس المالك المتصلة بغرفة مشروعه الآن —
// تحقّق حيّ بعملاء socket.io حقيقيين (لا محاكاة)، بمنطق انضمام/قطع مطابق
// لما في server.js (نفس broadcastPresence المستوردة فعلياً).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { broadcastPresence } from '../services/presence.js';

// خادم socket.io مصغّر يكرّر منطق join_project/disconnect الفعلي في
// server.js (الانضمام لغرفة باسم المشروع، والبثّ عبر broadcastPresence
// نفسها المستوردة) — بلا حاجة لإقلاع server.js الكامل (Mongo/بيئة/...).
function makeTestServer() {
    const httpServer = createServer();
    const io = new Server(httpServer);
    io.on('connection', (socket) => {
        socket.on('join_room', (room) => {
            socket.join(room);
            socket.roomName = room;
            broadcastPresence(io, room);
        });
        socket.on('disconnect', () => {
            if (socket.roomName) broadcastPresence(io, socket.roomName);
        });
    });
    return new Promise((resolve) => {
        httpServer.listen(0, () => resolve({ io, httpServer, port: httpServer.address().port }));
    });
}

function connectClient(port) {
    return new Promise((resolve) => {
        const c = ioClient(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
        c.on('connect', () => resolve(c));
    });
}

function waitForPresence(client) {
    return new Promise((resolve) => client.once('presence', resolve));
}

test('presence: عميل واحد ينضم → count=1', async () => {
    const { io, httpServer, port } = await makeTestServer();
    const a = await connectClient(port);
    const p1 = waitForPresence(a);
    a.emit('join_room', 'u1-proj1');
    assert.deepEqual((await p1).count, 1);
    a.close(); io.close(); httpServer.close();
});

test('presence: عميلان لنفس الغرفة → count=2 لكليهما', async () => {
    const { io, httpServer, port } = await makeTestServer();
    const a = await connectClient(port);
    const aFirst = waitForPresence(a);
    a.emit('join_room', 'u1-proj1');
    assert.equal((await aFirst).count, 1);

    const b = await connectClient(port);
    const bJoined = waitForPresence(b);
    const aUpdated = waitForPresence(a); // يجب أن يصل العميل الأول تحديثاً أيضاً
    b.emit('join_room', 'u1-proj1');
    const [bCount, aCount] = await Promise.all([bJoined, aUpdated]);
    assert.equal(bCount.count, 2, 'العميل المنضمّ حديثاً يرى العدد الصحيح');
    assert.equal(aCount.count, 2, 'العميل الأول يُبلَّغ بالتحديث أيضاً');

    a.close(); b.close(); io.close(); httpServer.close();
});

test('presence: قطع اتصال أحد العملاء يُنقص العدد للمتبقّين', async () => {
    const { io, httpServer, port } = await makeTestServer();
    const a = await connectClient(port);
    const aFirst = waitForPresence(a);
    a.emit('join_room', 'u1-proj1');
    await aFirst;

    const b = await connectClient(port);
    const bReady = waitForPresence(b);
    b.emit('join_room', 'u1-proj1');
    await bReady;

    const aNotified = waitForPresence(a); // بعد قطع b يجب أن يصل a تحديثاً بـcount=1
    b.close();
    const after = await aNotified;
    assert.equal(after.count, 1, 'العدد يعود لـ1 بعد قطع الجهاز الآخر');

    a.close(); io.close(); httpServer.close();
});

test('presence: غرفتان منفصلتان لا تتداخلان', async () => {
    const { io, httpServer, port } = await makeTestServer();
    const a = await connectClient(port);
    const b = await connectClient(port);

    const aReady = waitForPresence(a);
    a.emit('join_room', 'u1-proj1');
    assert.equal((await aReady).count, 1);

    const bReady = waitForPresence(b);
    b.emit('join_room', 'u2-proj9'); // غرفة مختلفة تماماً (مالك آخر)
    assert.equal((await bReady).count, 1, 'مشروع آخر معزول — لا يتأثر بعدد الأول');

    a.close(); b.close(); io.close(); httpServer.close();
});
