import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { jaolaBudgetAdvisor } from '../agents/cloneTemplates/jaolaBudgetAdvisor.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(flush) {
    const data = new Map(), messages = [];
    const context = vm.createContext({
        localStorage: { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) },
        document: { addEventListener() {}, documentElement: { getAttribute: () => 'ar' } },
        window: { JAOLA_SYNC: { flush } }, notify: m => messages.push(m), console,
    });
    vm.runInContext(jaolaBudgetAdvisor().files.find(f => f.name === 'app.js').content, context);
    vm.runInContext('toast=notify;globalThis.applied=0;', context);
    return { data, messages, run: script => vm.runInContext(script, context) };
}
test('budget waits for commit acknowledgement before success and prevents overlapping changes', async () => {
    let acknowledge;
    const h = harness(() => new Promise(resolve => { acknowledge=resolve; }));
    h.run("persistBudgetData('transactions',[{id:'a'}],function(){applied++;});persistBudgetData('transactions',[{id:'b'}],function(){applied++;});");
    assert.equal(h.run('applied'),0);
    assert.equal(JSON.parse(h.data.get('jbudget_transactions'))[0].id,'a');
    acknowledge(); await tick();
    assert.equal(h.run('applied'),1);
    assert.equal(h.run('state.saving'),false);
});
test('budget rejects unacknowledged save without reporting success', async () => {
    const h=harness(()=>Promise.reject(Error('conflict')));
    h.run("persistBudgetData('budgets',[{id:'a'}],function(){applied++;});");
    await tick();
    assert.equal(h.run('applied'),0);
    assert.ok(h.messages.length);
});
