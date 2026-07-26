// 🌐 النطاقات الخاصة: تحقق + سجلات DNS + ربط/حالة/فك عبر Vercel + حد الخطة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    validateDomain, normalizeDomain, dnsInstructionsFor, vercelProjectNameOf,
    attachDomain, domainStatus, detachDomain,
    readUserDomains, saveUserDomain, removeUserDomain, countUserDomains,
    VERCEL_A_RECORD, VERCEL_CNAME,
} from '../services/customDomains.js';
import { customDomainsMax } from '../services/subscriptionService.js';
import { UNLIMITED } from '../config/plans.js';

test('التحقق: تنظيف المدخل، رفض نطاقات المنصات وغير الصالح', () => {
    assert.equal(normalizeDomain('  HTTPS://MyStore.Com/path?x=1  '), 'mystore.com');
    assert.deepEqual(validateDomain('https://mystore.com/'), { ok: true, domain: 'mystore.com' });
    assert.deepEqual(validateDomain('shop.mystore.com'), { ok: true, domain: 'shop.mystore.com' });
    assert.ok(validateDomain('').error, 'فارغ يُرفض');
    assert.ok(validateDomain('my site.com').error, 'مسافة تُرفض');
    assert.ok(validateDomain('mystore').error, 'بلا نقطة يُرفض');
    assert.ok(/منصة/.test(validateDomain('x.vercel.app').error), 'نطاقات المنصات تُرفض بإرشاد');
    assert.ok(validateDomain('y.onrender.com').error);
});

test('سجلات DNS: الجذر A والفرعي CNAME — بقيم Vercel الرسمية', () => {
    assert.deepEqual(dnsInstructionsFor('mystore.com'), [{ type: 'A', host: '@', value: VERCEL_A_RECORD }]);
    assert.deepEqual(dnsInstructionsFor('shop.mystore.com'), [{ type: 'CNAME', host: 'shop', value: VERCEL_CNAME }]);
    // اسم مشروع Vercel نفس صياغة deployAgent
    assert.equal(vercelProjectNameOf('jamal', 'photo_test'), 'jamal-photo-test');
});

test('الربط: نجاح مع سجلات، ومشروع غير منشور، ونطاق مأخوذ، وبلا توكن', async () => {
    const env = { VERCEL_TOKEN: 'vt' };
    let captured = null;
    const ok = await attachDomain({ username: 'u', project: 'p', domain: 'mystore.com' }, {
        env,
        fetchImpl: async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ name: 'mystore.com', verification: [] }) }; },
    });
    assert.ok(ok.ok && ok.dns[0].type === 'A');
    assert.ok(captured.url.includes('/v10/projects/u-p/domains'));
    assert.equal(JSON.parse(captured.opts.body).name, 'mystore.com');

    const notDeployed = await attachDomain({ username: 'u', project: 'p', domain: 'x.com' }, {
        env, fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ error: { code: 'not_found' } }) }),
    });
    assert.ok(/انشر موقعك أولاً/.test(notDeployed.error));

    const taken = await attachDomain({ username: 'u', project: 'p', domain: 'x.com' }, {
        env, fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ error: { code: 'domain_taken' } }) }),
    });
    assert.ok(/مربوط بمشروع آخر/.test(taken.error));

    const off = await attachDomain({ username: 'u', project: 'p', domain: 'x.com' }, { env: {} });
    assert.ok(off.notConfigured && /VERCEL_TOKEN/.test(off.error));
});

test('الحالة: active / awaiting-dns / needs-verification مع تمرير سجلات TXT', async () => {
    const env = { VERCEL_TOKEN: 'vt' };
    const mk = (projBody, cfgBody) => async (url) => url.includes('/config')
        ? { ok: true, json: async () => cfgBody }
        : { ok: true, json: async () => projBody };

    const active = await domainStatus({ username: 'u', project: 'p', domain: 'd.com' }, { env, fetchImpl: mk({ verified: true }, { misconfigured: false }) });
    assert.equal(active.status, 'active');

    const dns = await domainStatus({ username: 'u', project: 'p', domain: 'd.com' }, { env, fetchImpl: mk({ verified: true }, { misconfigured: true }) });
    assert.equal(dns.status, 'awaiting-dns');
    assert.equal(dns.dns[0].type, 'A');

    const verify = await domainStatus({ username: 'u', project: 'p', domain: 'd.com' }, {
        env, fetchImpl: mk({ verified: false, verification: [{ type: 'TXT', domain: '_vercel.d.com', value: 'vc-123' }] }, { misconfigured: true }),
    });
    assert.equal(verify.status, 'needs-verification');
    assert.equal(verify.verification[0].value, 'vc-123');
});

test('الفكّ يمرّ (404 = مفكوك أصلاً)، والمخزن الملفّي يحفظ ويعدّ ويحذف', async () => {
    const env = { VERCEL_TOKEN: 'vt' };
    const r = await detachDomain({ username: 'u', project: 'p', domain: 'd.com' }, { env, fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) });
    assert.ok(r.ok, '404 عند الفك = نجاح عملي');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-'));
    assert.equal(countUserDomains(dir, 'jamal'), 0);
    saveUserDomain(dir, 'jamal', 'shop', 'mystore.com');
    saveUserDomain(dir, 'jamal', 'blog', 'myblog.com');
    assert.equal(countUserDomains(dir, 'jamal'), 2);
    assert.equal(readUserDomains(dir, 'jamal').shop.domain, 'mystore.com');
    // استبدال نطاق نفس المشروع لا يزيد العدّ
    saveUserDomain(dir, 'jamal', 'shop', 'newstore.com');
    assert.equal(countUserDomains(dir, 'jamal'), 2);
    assert.ok(removeUserDomain(dir, 'jamal', 'shop'));
    assert.equal(countUserDomains(dir, 'jamal'), 1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('حد الخطة: المجانية 0 (ميزة مدفوعة)، الاحترافية 1، المؤسسات بلا حدود', () => {
    assert.equal(customDomainsMax(null).max, 0);
    assert.equal(customDomainsMax({ subscription: { plan: 'pro', status: 'active' } }).max, 1);
    assert.equal(customDomainsMax({ subscription: { plan: 'enterprise', status: 'active' } }).max, UNLIMITED);
});
