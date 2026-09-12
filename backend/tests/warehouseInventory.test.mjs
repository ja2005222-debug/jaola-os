import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { jaolaWarehouse } from '../agents/cloneTemplates/jaolaWarehouse.js';

function shipment(stock, lines, direction = 'out') {
    const writes = [], messages = [];
    const context = vm.createContext({
        localStorage: { getItem: () => null, setItem: (k, v) => writes.push([k, v]) },
        document: { addEventListener() {}, getElementById: () => ({ value: '' }) },
        window: {}, console,
    });
    const script = jaolaWarehouse().files.find(f => f.name === 'app.js').content;
    vm.runInContext(script, context);
    context.fixture = { stock, lines, direction };
    context.notify = m => messages.push(m);
    vm.runInContext(`items = fixture.stock; state.outLines = fixture.lines; state.inLines = fixture.lines;
        toast = notify; printShipment = function() {}; renderOutbound = function() {}; renderInbound = function() {};
        if (fixture.direction === 'in') postInbound(); else postOutbound(); globalThis.result = {items, shipments, lines:fixture.direction === 'in' ? state.inLines : state.outLines, sequence:settings.shipSeq};`, context);
    return { ...JSON.parse(JSON.stringify(context.result)), writes, messages };
}

test('warehouse rejects combined duplicate quantities before any inventory or shipment mutation', () => {
    const result = shipment([{ id: 'a', qty: 5 }], [{ itemId: 'a', name: 'A', qty: 3 }, { itemId: 'a', name: 'A', qty: 3 }]);
    assert.equal(result.items[0].qty, 5);
    assert.equal(result.shipments.length, 0);
    assert.equal(result.lines.length, 2);
    assert.equal(result.sequence, 1);
    assert.equal(result.writes.length, 0);
});

test('warehouse validates the entire shipment before touching an earlier valid item', () => {
    for (const qty of [-1, 0, 1.5, NaN, Infinity, '2']) {
        const result = shipment([{ id: 'a', qty: 5 }, { id: 'b', qty: 5 }], [{ itemId: 'a', qty: 2 }, { itemId: 'b', qty }]);
        assert.deepEqual(result.items.map(i => i.qty), [5, 5]);
        assert.equal(result.writes.length, 0);
    }
    const missing = shipment([{ id: 'a', qty: 5 }], [{ itemId: 'a', qty: 2 }, { itemId: 'deleted', qty: 1 }]);
    assert.equal(missing.items[0].qty, 5);
    assert.equal(missing.writes.length, 0);
});

test('warehouse accepts duplicate lines at exact stock and records one shipment', () => {
    const result = shipment([{ id: 'a', qty: 5 }], [{ itemId: 'a', qty: 2 }, { itemId: 'a', qty: 3 }]);
    assert.equal(result.items[0].qty, 0);
    assert.equal(result.shipments.length, 1);
    assert.equal(result.shipments[0].lines.length, 2);
    assert.equal(result.sequence, 2);
    assert.equal(result.lines.length, 0);
    assert.equal(result.writes.length, 3);
});

 test('warehouse inbound validates all lines before increasing stock', () => {
    for (const line of [{ itemId: 'deleted', qty: 1 }, { itemId: 'b', qty: -2 }, { itemId: 'b', qty: Infinity }, { itemId: 'b', qty: 0.5 }]) {
        const result = shipment([{ id: 'a', qty: 5 }, { id: 'b', qty: 5 }], [{ itemId: 'a', qty: 2 }, line], 'in');
        assert.deepEqual(result.items.map(i => i.qty), [5, 5]);
        assert.equal(result.writes.length, 0);
        assert.equal(result.shipments.length, 0);
    }
    const overflow = shipment([{ id: 'a', qty: Number.MAX_SAFE_INTEGER - 2 }], [{ itemId: 'a', qty: 2 }, { itemId: 'a', qty: 1 }], 'in');
    assert.equal(overflow.writes.length, 0);
    const valid = shipment([{ id: 'a', qty: 5 }], [{ itemId: 'a', qty: 2 }, { itemId: 'a', qty: 3 }], 'in');
    assert.equal(valid.items[0].qty, 10);
    assert.equal(valid.shipments.length, 1);
    assert.equal(valid.lines.length, 0);
});
