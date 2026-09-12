import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { jaolaPos } from '../agents/cloneTemplates/jaolaPos.js';
import { jaolaHelpdesk } from '../agents/cloneTemplates/jaolaHelpdesk.js';

function runtime(builder, values = {}) {
    const writes = [], notices = [];
    const elements = new Map();
    const context = vm.createContext({
        localStorage: { getItem: () => null, setItem: (key, value) => writes.push([key, value]) },
        document: { addEventListener() {}, getElementById: id => { if (!elements.has(id)) elements.set(id, { value: values[id] ?? '' }); return elements.get(id); } },
        window: {}, console, notify: message => notices.push(message),
    });
    vm.runInContext(builder().files.find(f => f.name === 'app.js').content, context);
    vm.runInContext('toast = notify;', context);
    return { run: code => vm.runInContext(code, context), writes, notices };
}

test('POS refuses invalid product prices instead of creating free or infinite-priced products', () => {
    for (const value of ['', 'abc', '12abc', '-1', 'Infinity']) {
        const r = runtime(jaolaPos, { prName: 'New', prPrice: value });
        r.run('renderProducts=function(){}; globalThis.before=products.length; addProduct();');
        assert.equal(r.run('products.length'), r.run('before'));
        assert.equal(r.writes.length, 0);
    }
    const valid = runtime(jaolaPos, { prName: 'Free', prPrice: '0' });
    valid.run('renderProducts=function(){}; addProduct();');
    assert.equal(valid.run('products.at(-1).price'), 0);
    assert.equal(valid.writes.length, 1);
});

test('POS shift closing includes a subsequent receipt in the same millisecond exactly once', () => {
    const r = runtime(jaolaPos);
    r.run(`renderShift=function(){}; Date.now=function(){return 1000;}; shifts=[];
        sales=[{id:'a',no:1,ts:1000,total:0.1,method:'cash'},{id:'b',no:2,ts:1000,total:0.2,method:'cash'}]; closeShift();
        sales.push({id:'c',no:3,ts:1000,total:0.2,method:'card'});`);
    assert.equal(r.run('currentShiftSales().length'), 1);
    assert.equal(r.run('shifts[0].total'), 0.3);
    r.run('closeShift(); closeShift();');
    assert.equal(r.run('shifts.length'), 2);
    assert.equal(r.run('shifts[1].count'), 1);
    assert.equal(r.run('currentShiftSales().length'), 0);
});

test('helpdesk rejects unknown stages and replies on closed tickets without writes', () => {
    const r = runtime(jaolaHelpdesk, { replyText: 'Reply' });
    r.run(`renderTicketDetail=function(){};renderDashboard=function(){};session={role:'agent'};
        tickets=[{id:'a',stage:'unknown',replies:[]}];advanceTicket('a');`);
    assert.equal(r.run('tickets[0].stage'), 'unknown');
    assert.equal(r.writes.length, 0);
    r.run(`tickets[0].stage='closed';state.activeTicket='a';addReply();`);
    assert.equal(r.run('tickets[0].replies.length'), 0);
    assert.equal(r.writes.length, 0);
});

test('helpdesk normal lifecycle preserves resolution time and accepts an active reply', () => {
    const r = runtime(jaolaHelpdesk, { replyText: 'Checked' });
    r.run(`renderTicketDetail=function(){};renderDashboard=function(){};session={role:'agent'};
        tickets=[{id:'a',stage:'open',replies:[],resolvedAt:null}];state.activeTicket='a';
        addReply();advanceTicket('a');advanceTicket('a');globalThis.resolved=tickets[0].resolvedAt;advanceTicket('a');advanceTicket('a');`);
    assert.equal(r.run('tickets[0].stage'), 'closed');
    assert.equal(r.run('tickets[0].replies.length'), 1);
    assert.equal(r.run('tickets[0].resolvedAt'), r.run('resolved'));
    assert.equal(r.writes.length, 4);
});

test('POS keeps old timestamp-based shift records readable and rejects corrupt new closure data', () => {
    const r = runtime(jaolaPos);
    r.run(`renderShift=function(){}; shifts=[{closedAt:100}]; sales=[{id:'old',no:1,ts:50,total:2,method:'cash'},{id:'new',no:2,ts:200,total:3,method:'card'}];`);
    assert.equal(r.run('currentShiftSales().length'), 1);
    r.run(`sales[1].total=Infinity;closeShift();`);
    assert.equal(r.run('shifts.length'), 1);
    assert.equal(r.writes.length, 0);
});

test('helpdesk reply controls follow the active ticket state', () => {
    const r = runtime(jaolaHelpdesk);
    r.run(`session={role:'agent'}; tickets=[{id:'a',no:1,stage:'closed',replies:[]}];state.activeTicket='a';renderTicketDetail();`);
    assert.equal(r.run("byId('replySubmit').disabled"), true);
    assert.equal(r.run("byId('replyText').disabled"), true);
    r.run(`tickets[0].stage='in_progress';renderTicketDetail();`);
    assert.equal(r.run("byId('replySubmit').disabled"), false);
});
