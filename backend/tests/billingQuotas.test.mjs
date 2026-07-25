// 💳 حصص الخطط: عدّاد الاستهلاك الشهري + حصة ذكاء البوت حسب الخطة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bumpUsage, getUsageCount } from '../services/usageMeter.js';
import { botAiQuota, getUsage } from '../services/subscriptionService.js';
import { publicPlans, UNLIMITED } from '../config/plans.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'usage-'));

test('عدّاد شهري: زيادة وقراءة، وعزل بين الأشهر والمستخدمين', () => {
    const dir = tmp();
    const jan = new Date('2026-01-10');
    const feb = new Date('2026-02-10');
    assert.equal(getUsageCount(dir, 'ali', 'botAi', jan), 0);
    assert.equal(bumpUsage(dir, 'ali', 'botAi', jan), 1);
    assert.equal(bumpUsage(dir, 'ali', 'botAi', jan), 2);
    assert.equal(getUsageCount(dir, 'ali', 'botAi', jan), 2);
    assert.equal(getUsageCount(dir, 'ali', 'botAi', feb), 0, 'شهر جديد = عدّ جديد');
    assert.equal(getUsageCount(dir, 'omar', 'botAi', jan), 0, 'مستخدم آخر معزول');
    // الأشهر القديمة تُقصّ (يبقى 12)
    for (let m = 1; m <= 14; m++) bumpUsage(dir, 'ali', 'botAi', new Date(`2027-${String(m > 12 ? m - 12 : m).padStart(2, '0')}-05`));
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'ali.json'), 'utf8'));
    assert.ok(Object.keys(raw.botAi).length <= 12);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('حصة ذكاء البوت حسب الخطة: مجاني 30، Pro 2000، مؤسسات بلا حدود', () => {
    assert.equal(botAiQuota(null).monthly, 30, 'بلا وثيقة → الخطة المجانية');
    assert.equal(botAiQuota({}).monthly, 30);
    const pro = { subscription: { plan: 'pro', status: 'active' } };
    assert.equal(botAiQuota(pro).monthly, 2000);
    const ent = { subscription: { plan: 'enterprise', status: 'active' } };
    assert.equal(botAiQuota(ent).monthly, UNLIMITED);
    // اشتراك منتهي المدة → يرتد للمجاني
    const expired = { subscription: { plan: 'pro', status: 'active', currentPeriodEnd: '2020-01-01' } };
    assert.equal(botAiQuota(expired).monthly, 30);
});

test('getUsage يضم كتلة botAi والخطط العامة تحوّل اللانهائي إلى null', () => {
    const u = getUsage(null, 2, 7);
    assert.equal(u.botAi.used, 7);
    assert.equal(u.botAi.limit, 30);
    assert.equal(u.botAi.remaining, 23);
    const ent = getUsage({ subscription: { plan: 'enterprise', status: 'active' } }, 0, 999);
    assert.ok(ent.botAi.unlimited && ent.botAi.limit === null);

    const plans = publicPlans();
    const free = plans.find(p => p.id === 'free');
    const enterprise = plans.find(p => p.id === 'enterprise');
    assert.equal(free.limits.botAiMessages, 30);
    assert.equal(enterprise.limits.botAiMessages, null, 'Infinity لا يصل للواجهة');
});
