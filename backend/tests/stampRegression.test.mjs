// 🛡️ دلالة البصمة: تُقاس بالارتداد لا المطلق — لا تُسترجَع إلا إن أدخلت فشلاً
// *جديداً*. نموذج يفرط في الأدوار (Admin على قالب متجر بلا لوحة إدارة) يجب ألّا
// يُسقط البصمة، لأن الفشل موجود في الكلون النظيف أصلاً (لا بسبب التخصيص).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyBehavior } from '../agents/behaviorVerifier.js';
import { stampSeed } from '../agents/seedStamp.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

async function failSet(files, model) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jstamp-'));
    for (const f of files) fs.writeFileSync(path.join(dir, f.name), f.content);
    const v = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp' }, domainModel: model });
    fs.rmSync(dir, { recursive: true, force: true });
    return new Set(v.ran ? v.checks.filter(c => c.status === 'fail').map(c => c.name) : []);
}

test('البصمة لا تُدخل فشلاً جديداً مقابل الكلون النظيف (نموذج مُفرِط بدور Admin)', async () => {
    const c = jaolaStore();
    const base = c.files.map(f => ({ name: f.name, content: f.content }));
    // نموذج هدف يفرط: يضيف Admin غير المبنيّ في قالب المتجر
    const model = { roles: [{ name: 'Customer' }, { name: 'Admin' }] };

    // خصّص البيانات (chat محقون) — عطور بنفس المفاتيح
    const chat = async () => `[
      { id: 'p1', name: 'عطر باريسي', cat: 'عطور', price: 480, rating: 4.9, emoji: '🧴', stock: 10, desc: 'شرقي فرنسي.' },
      { id: 'p2', name: 'عود ملكي', cat: 'عطور', price: 950, rating: 4.8, emoji: '🌸', stock: 6, desc: 'عود أصيل.' }
    ]`;
    const seed = await stampSeed(base, 'متجر عطور', { chat, category: 'ecommerce' });
    assert.equal(seed.ok, true);
    const stamped = base.map(f => (f.name === 'app.js' ? seed.files.find(x => x.name === 'app.js') : f));

    const baseFails = await failSet(base, model);
    const stampFails = await failSet(stamped, model);

    // الجوهر: كل فشل في المبصوم موجود أصلاً في الأساس ⇒ لا فشل *جديد* ⇒ لا استرجاع
    const newFails = [...stampFails].filter(n => !baseFails.has(n));
    assert.deepEqual(newFails, [], `البصمة لم تُدخل فشلاً جديداً (جديد: ${newFails.join('،') || 'لا شيء'})`);

    // والبيانات فعلاً تغيّرت
    const app = stamped.find(f => f.name === 'app.js').content;
    assert.ok(app.includes('عطر باريسي') && !app.includes('سماعات لاسلكية'), 'البيانات خُصّصت');
});
