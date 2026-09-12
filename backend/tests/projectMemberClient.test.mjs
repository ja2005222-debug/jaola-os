import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { jaolaHr } from '../agents/cloneTemplates/jaolaHr.js';
import { buildDataSyncJS } from '../services/dataSync.js';
import { projectTeamClient } from '../services/projectTeamClient.js';
import { listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { templateDefaults } from '../services/templateDefaults.js';
import { cloneRoleOptions, cloneRoleBinding, resolveCloneRole } from '../services/cloneRoles.js';
import { transactionAccess } from '../services/transactionAccess.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
for (const meta of listClones()) {
    const clone = getCloneById(meta.id);
    const html = clone.files.find(file => file.name === 'index.html')?.content;
    if (clone.track !== 'system' || !html?.includes('id="loginRole"')) continue;
    for (const option of cloneRoleOptions(clone.id)) {
        test(`${clone.id}/${option.id}: real template enters assigned role with server snapshot and matching controls`, async () => {
            const source = clone.files.find(file => file.name === 'app.js').content;
            const seed = (await templateDefaults(source)).data;
            const binding = cloneRoleBinding(clone.id);
            const recordId = option.requiresRecord ? JSON.parse(seed[binding.key])[0].id : '';
            const policy = resolveCloneRole(clone.id, option.id, recordId);
            const data = transactionAccess({ id: 'member', recordId }, policy.rules).snapshot(seed);
            const dom = new JSDOM(html, { url: 'https://project.example', runScripts: 'outside-only' });
            const w = dom.window;
            const run = code => vm.runInContext(code, dom.getInternalVMContext());
            w.Headers = Headers; w.Response = Response;
            w.fetch = async url => new Response(JSON.stringify(String(url).endsWith('/auth/member-login')
                ? { ok: true, session: 'member-session', account: 'staff', uiRole: policy.uiRole, ui: policy.ui }
                : { revision: 0, data }));
            const append = w.document.body.appendChild.bind(w.document.body);
            w.document.body.appendChild = element => {
                const result = append(element);
                if (element.tagName === 'SCRIPT' && element.getAttribute('src') === 'app.js') { run(source); element.onload(); }
                return result;
            };
            try {
                await tick();
                run(buildDataSyncJS({ apiBase: 'https://api.example', token: 'published' }));
                const form = w.document.querySelector('form');
                form.elements.account.value = 'staff'; form.elements.password.value = 'test-member-password';
                form.dispatchEvent(new w.Event('submit', { cancelable: true }));
                for (let i = 0; i < 6; i++) await tick();
                assert.equal(w.document.getElementById('loginRole').value, option.id);
                assert.equal(w.document.getElementById('loginRole').disabled, true);
                assert.equal(run('typeof session !== "undefined" ? session?.role : state.user?.role'), option.id);
                for (const action of policy.ui?.hiddenActions || []) {
                    for (const element of w.document.querySelectorAll('[data-action="' + action + '"]')) assert.equal(element.hidden, true, action);
                }
                assert.equal(w.document.getElementById('jaola-team-toggle'), null);
            } finally { w.dispatchEvent(new w.Event('pagehide')); w.close(); }
        });
    }
}
test('generated HR member login selects server-assigned role and starts with isolated employee data', async () => {
    const clone = jaolaHr();
    const dom = new JSDOM(clone.files.find(file => file.name === 'index.html').content, { url: 'https://hr.example', runScripts: 'outside-only' });
    const w = dom.window;
    const run = code => vm.runInContext(code, dom.getInternalVMContext());
    const calls = [];
    w.Headers = Headers; w.Response = Response;
    w.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url).endsWith('/auth/member-login')) return new Response(JSON.stringify({ ok: true, session: 'member-session', account: 'ahmed', uiRole: 'employee' }));
        return new Response(JSON.stringify({ revision: 0, data: {
            jhr_employees: JSON.stringify([{ id: 'e1', name: 'أحمد', salary: 1000, role: 'موظف', dept: 'عام' }]),
            jhr_attendance: '[]', jhr_leaves: '[]', jhr_payslips: '[]', jhr_settings: '{"name":"الشركة","currency":"ر.س"}',
        } }));
    };
    const append = w.document.body.appendChild.bind(w.document.body);
    w.document.body.appendChild = element => {
        const result = append(element);
        if (element.tagName === 'SCRIPT' && element.getAttribute('src') === 'app.js') {
            run(clone.files.find(file => file.name === 'app.js').content);
            element.onload();
        }
        return result;
    };
    try {
        await tick();
        run(buildDataSyncJS({ apiBase: 'https://api.example', token: 'published' }));
        const form = w.document.querySelector('form');
        form.elements.account.value = 'ahmed'; form.elements.password.value = 'test-member-password';
        form.dispatchEvent(new w.Event('submit', { cancelable: true }));
        await tick(); await tick(); await tick();
        assert.equal(run('state.user.role'), 'employee');
        assert.equal(w.document.getElementById('loginRole').value, 'employee');
        assert.equal(w.document.getElementById('loginRole').disabled, true);
        assert.deepEqual(JSON.parse(w.localStorage.getItem('jhr_employees')).map(row => row.id), ['e1']);
        assert.equal(w.document.getElementById('jaola-team-toggle'), null);
        assert.equal(calls[0].url, 'https://api.example/api/public/auth/member-login');
        assert.equal(JSON.parse(calls[0].options.body).account, 'ahmed');
        assert.ok(calls.some(call => call.options.headers?.get?.('Authorization') === 'Bearer member-session'));
    } finally { w.dispatchEvent(new w.Event('pagehide')); w.close(); }
});

test('team panel saves assigned employee account, clears password and revokes without exposing returned text as HTML', async () => {
    const dom = new JSDOM('<body></body>', { url: 'https://hr.example', runScripts: 'dangerously' });
    const w = dom.window;
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
    const calls = [];
    const data = { roles: [{ id: 'employee', label: 'موظف', requiresRecord: true }], bindings: [{ id: 'e1', name: 'أحمد' }], accounts: [{ account: '<img src=x>', role: 'employee', active: true }] };
    w.fetch = async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => options.method === 'GET' ? data : { ok: true } };
    };
    try {
        w.eval('(' + projectTeamClient.toString() + ')("https://api.example", "published")');
        await tick();
        w.document.getElementById('jaola-team-toggle').click(); await tick();
        assert.equal(w.document.querySelector('dialog img'), null);
        const form = w.document.querySelector('dialog form');
        form.elements.account.value = 'ahmed'; form.elements.password.value = 'test-member-password';
        form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); await tick();
        const saved = JSON.parse(calls.find(call => call.options.method === 'POST').options.body);
        assert.equal(saved.recordId, 'e1'); assert.equal(saved.role, 'employee');
        assert.equal(form.elements.password.value, '');
        w.document.querySelector('[data-accounts] button').click(); await tick();
        assert.ok(calls.some(call => call.options.method === 'DELETE'));
    } finally { w.close(); }
});
