import test from 'node:test';
import assert from 'node:assert/strict';
import {
  businessFigures, businessMonth, isBusinessTx, OWN_ACCOUNTS, payYourselfTransactions, personalOnly,
} from '../services/business.js';
import { computeStats, spendingOf } from '../services/finance.js';

const tx = over => ({ id: Math.random().toString(36), type: 'debit', cat: 'Food', amount: 1000, desc: 'x', date: '05/11/2026', ...over });
const NOV = new Date(2026, 10, 15);

const shop = [
  tx({ type: 'credit', cat: 'Sales', amount: 850000 }),
  tx({ cat: 'Stock', amount: 400000 }),
  tx({ cat: 'Shop rent', amount: 150000 }),
  tx({ cat: 'POS charges', amount: 10000 }),
  tx({ cat: 'Owner pay', amount: 200000 }),
  tx({ cat: 'Food', amount: 30000 }), // personal
];

test('a business category puts a transaction in the business', () => {
  assert.equal(isBusinessTx({ cat: 'Stock' }), true);
  assert.equal(isBusinessTx({ cat: 'Food' }), false);
  assert.equal(personalOnly(shop).length, 1);
});

test('profit is sales less costs, and paying yourself is not a cost', () => {
  const f = businessFigures(shop, new Date(2026, 10, 1), new Date(2026, 11, 1));
  assert.equal(f.sales, 850000);
  assert.equal(f.costs, 560000);
  assert.equal(f.profit, 290000);
  assert.equal(f.ownerPay, 200000);
  assert.equal(f.kept, 90000);
  assert.equal(f.margin, 34);
  assert.deepEqual(f.byCost[0], ['Stock', 400000]);
});

test('this month is compared with last month', () => {
  const m = businessMonth([...shop, tx({ type: 'credit', cat: 'Sales', amount: 500000, date: '10/10/2026' })], NOV);
  assert.equal(m.profit, 290000);
  assert.equal(m.last.profit, 500000);
  assert.equal(m.hasLast, true);
});

test('business money stays out of personal figures', () => {
  const stats = computeStats({ usage: 'business' }, shop, NOV);
  assert.equal(stats.totalSpend, 30000);
  assert.equal(stats.income, 0);
});

test('paying yourself becomes personal income', () => {
  const [out, inn] = payYourselfTransactions(200000, NOV);
  assert.equal(out.cat, 'Owner pay');
  assert.equal(inn.cat, 'Income');
  assert.equal(inn.type, 'credit');
  const stats = computeStats({ usage: 'business' }, [...shop, inn], NOV);
  assert.equal(stats.income, 200000);
  assert.equal(payYourselfTransactions(0), null);
});

test('money moved between your own accounts is not spending', () => {
  const moved = [tx({ cat: OWN_ACCOUNTS, amount: 50000 }), tx({ cat: 'Food', amount: 2000 })];
  assert.equal(spendingOf(moved).length, 1);
});
