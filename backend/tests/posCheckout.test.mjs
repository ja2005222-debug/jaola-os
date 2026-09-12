import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { jaolaPos } from '../agents/cloneTemplates/jaolaPos.js';

function checkout(cart, { method = 'cash', printFails = false } = {}) {
    const writes = [], messages = [];
    const c = vm.createContext({ localStorage: { getItem: () => null, setItem: (k,v) => writes.push([k,v]) }, document: { addEventListener() {} }, window: {}, console });
    vm.runInContext(jaolaPos().files.find(f=>f.name==='app.js').content, c);
    c.fixture = { cart, method, printFails }; c.notify = m => messages.push(m);
    vm.runInContext(`state.cart=fixture.cart; state.user={role:'cashier'}; toast=notify; renderCart=function(){};
        printReceipt=function(){if(fixture.printFails)throw Error('printer unavailable');};
        pay(fixture.method); globalThis.result={sales,cart:state.cart,sequence:settings.receiptSeq};`,c);
    return { ...JSON.parse(JSON.stringify(c.result)), writes, messages };
}
test('POS validates quantities and prices before saving anything',()=>{
    for(const line of [{qty:-1,price:2},{qty:1.5,price:2},{qty:1,price:-2},{qty:1,price:Infinity},{qty:1,price:NaN}]) {
        const r=checkout([{pid:'a',name:'A',...line}]);
        assert.equal(r.sales.length,0); assert.equal(r.sequence,1); assert.equal(r.writes.length,0);
    }
    assert.equal(checkout([{qty:1,price:2}],{method:'unknown'}).sales.length,0);
});
test('POS totals use two-decimal unit prices consistently',()=>{
    const r=checkout([{pid:'a',name:'A',qty:1,price:0.1},{pid:'b',name:'B',qty:1,price:0.2}]);
    assert.equal(r.sales[0].total,0.3); assert.equal(r.cart.length,0);
});
test('POS printer failure cannot leave a paid cart ready for duplicate checkout',()=>{
    const r=checkout([{pid:'a',name:'A',qty:2,price:3}],{printFails:true});
    assert.equal(r.sales.length,1);assert.equal(r.cart.length,0);assert.equal(r.sequence,2);
    assert.ok(r.messages.some(m=>m.includes('الطباعة')));
});

test('POS waits for server acknowledgement before printing and prevents overlapping checkout', async () => {
    let acknowledge;
    const c = vm.createContext({ localStorage: { getItem: () => null, setItem() {} }, document: { addEventListener() {} }, window: { JAOLA_SYNC: { flush: () => new Promise(resolve => { acknowledge = resolve; }) } } });
    vm.runInContext(jaolaPos().files.find(f => f.name === 'app.js').content, c);
    vm.runInContext("globalThis.prints=0;toast=function(){};renderCart=function(){};printReceipt=function(){prints++;};state.user={role:'cashier'};state.cart=[{pid:'a',qty:1,price:2}];pay('cash');state.cart=[{pid:'b',qty:1,price:3}];pay('cash');", c);
    assert.equal(vm.runInContext('prints', c), 0);
    assert.equal(vm.runInContext('sales.length', c), 1);
    acknowledge(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(vm.runInContext('prints', c), 1);
    assert.equal(vm.runInContext('state.paying', c), false);
});

test('POS never prints an unacknowledged transaction', async () => {
    const c = vm.createContext({ localStorage: { getItem: () => null, setItem() {} }, document: { addEventListener() {} }, window: { JAOLA_SYNC: { flush: () => Promise.reject(Error('conflict')) } } });
    vm.runInContext(jaolaPos().files.find(f => f.name === 'app.js').content, c);
    vm.runInContext("globalThis.prints=0;toast=function(){};renderCart=function(){};printReceipt=function(){prints++;};state.user={role:'cashier'};state.cart=[{pid:'a',qty:1,price:2}];pay('cash');", c);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(vm.runInContext('prints', c), 0);
});
