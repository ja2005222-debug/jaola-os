import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { jaolaBooking } from '../agents/cloneTemplates/jaolaBooking.js';

function fixture() {
  const elements = new Map();
  let stored = '[]', fail = false;
  const context = vm.createContext({
    document: { addEventListener() {}, getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: id === 'custName' ? 'عميل' : '', classList: { add() {}, toggle() {} } });
      return elements.get(id);
    } },
    localStorage: { getItem() { return stored; }, setItem(k, v) { if (fail) throw Error('quota'); stored = v; } },
  });
  vm.runInContext(jaolaBooking().files.find(f => f.name === 'app.js').content, context);
  const run = source => vm.runInContext(source, context);
  run("state.service='s1'; state.date=nextDays(7)[1].key; state.slot='10:00'; state.step='confirm'");
  return { run, elements, seed(v) { stored = JSON.stringify(v); }, fail() { fail = true; }, data() { return JSON.parse(stored); } };
}

test('booking rejects incomplete selection and stale occupied slots', () => {
  const f = fixture();
  f.run("state.service=null; confirmBooking()");
  assert.equal(f.data().length, 0);
  f.run("state.service='s1'");
  f.seed([{ id: 100, date: f.run('state.date'), slot: '10:00' }]);
  f.run('confirmBooking()');
  assert.equal(f.data().length, 1);
  assert.match(f.elements.get('bookingError').textContent, /محجوز/);
});

test('booking allocates beyond existing IDs and ignores repeated confirmation', () => {
  const f = fixture();
  f.seed([{ id: 102, date: '2000-01-01', slot: '10:00' }]);
  f.run('confirmBooking(); confirmBooking()');
  assert.deepEqual(f.data().map(b => b.id), [102, 103]);
  assert.equal(f.run('state.step'), 'done');
});

test('failed persistence does not mutate bookings or show success', () => {
  const f = fixture(); f.fail(); f.run('confirmBooking()');
  assert.equal(f.run('state.bookings.length'), 0);
  assert.equal(f.run('state.step'), 'confirm');
  assert.match(f.elements.get('bookingError').textContent, /تعذّر حفظ/);
});
