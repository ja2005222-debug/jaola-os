// 🕸️ TaskGraph: الخوارزمية المنقولة حرفياً من backendTeam.planExecution، معمَّمة على أي مفتاح.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTasks } from '../core/runtime/TaskGraph.js';
import { DELIVERY_STAGES } from '../core/contracts/index.js';
import { planExecution, BACKEND_TEAM } from '../agents/backendTeam/index.js';

test('بلا اعتماديات → الترتيب هو ترتيب التعريف حرفياً (DELIVERY_STAGES)', () => {
    const out = orderTasks(DELIVERY_STAGES, { key: 'name' });
    assert.deepEqual(out.map(s => s.name), DELIVERY_STAGES.map(s => s.name));
    assert.equal(out[0], DELIVERY_STAGES[0]); // العناصر نفسها لا نسخ
});

test('dependsOn يؤخّر المعتمِد ويحافظ على الاستقرار عند تساوي الدرجة، ويتجاهل اعتمادية خارج المجموعة', () => {
    const tasks = [
        { name: 'deploy', dependsOn: ['build', 'test'] },
        { name: 'build', dependsOn: ['ghost'] },
        { name: 'lint' },
        { name: 'test', dependsOn: ['build'] },
    ];
    assert.deepEqual(orderTasks(tasks, { key: 'name' }).map(t => t.name), ['build', 'lint', 'test', 'deploy']);
});

test('دورة اعتمادية → خطأ يسمّي المجموعة', () => {
    const cyc = [{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }];
    assert.throws(() => orderTasks(cyc, { label: 'X' }), /دورة اعتمادية في X/);
});

test('planExecution للفريق الخلفي = orderTasks بمفتاح id — نفس الناتج والرسالة', () => {
    assert.deepEqual(planExecution(BACKEND_TEAM), orderTasks(BACKEND_TEAM, { key: 'id' }).map(a => a.id));
    assert.throws(() => planExecution([{ id: 'x', dependsOn: ['y'] }, { id: 'y', dependsOn: ['x'] }]), /دورة اعتمادية في فريق الوكلاء/);
});
