import test from 'node:test';
import assert from 'node:assert/strict';
import { isRepeatAlert, newImports } from '../services/alerts.js';

const NOW = 1_000_000_000;
const alert = over => ({ source: 'push', amount: 5000, type: 'debit', desc: 'Shoprite', capturedAt: NOW - 30000, ...over });

test('the same alert arriving moments later is a repeat', () => {
  assert.equal(isRepeatAlert([alert()], alert(), NOW), true);
  assert.equal(isRepeatAlert([alert({ desc: ' SHOPRITE ' })], alert(), NOW), true);
});

test('real transactions are not mistaken for repeats', () => {
  const cases = [
    alert({ capturedAt: NOW - 3 * 60 * 1000 }),
    alert({ desc: 'Bolt' }),
    alert({ amount: 5001 }),
    alert({ type: 'credit' }),
    alert({ source: 'manual' }),
    alert({ capturedAt: undefined }),
  ];
  for (const old of cases) assert.equal(isRepeatAlert([old], alert(), NOW), false, JSON.stringify(old));
  assert.equal(isRepeatAlert([], alert(), NOW), false);
});

test('imports skip what is already recorded', () => {
  const existing = [{ amount: 100, date: '01/11/2026', desc: 'Shoprite Ikeja' }];
  const incoming = [
    { amount: 100, date: '01/11/2026', desc: 'Shoprite Ikeja' },
    { amount: 100, date: '02/11/2026', desc: 'Shoprite Ikeja' },
  ];
  assert.deepEqual(newImports(existing, incoming), [incoming[1]]);
});

test('identical purchases within one import are all kept', () => {
  const twice = [{ amount: 100, date: '01/11/2026', desc: 'Bus' }, { amount: 100, date: '01/11/2026', desc: 'Bus' }];
  assert.equal(newImports([], twice).length, 2);
});
