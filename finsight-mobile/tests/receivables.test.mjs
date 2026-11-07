import test from 'node:test';
import assert from 'node:assert/strict';
import {
  followUpBody, followUpTimes, owedStatus, owedSummary, receivePayment, remaining, taxSetAside, validateOwed,
} from '../services/receivables.js';
import { businessFigures } from '../services/business.js';

const NOW = new Date(2026, 10, 15, 12);
const chidi = { id: 'c', name: 'Chidi Stores', amount: 50000, received: 0, dueDate: '2026-11-10' };
const ada = { id: 'a', name: 'Ada', amount: 20000, received: 5000, dueDate: '2026-11-20' };

test('what is still owed, and how late it is', () => {
  assert.equal(remaining(ada), 15000);
  assert.deepEqual(owedStatus(chidi, NOW), { label: '5 days late', tone: 'negative' });
  assert.deepEqual(owedStatus(ada, NOW), { label: 'Due in 5 days', tone: 'neutral' });
  assert.deepEqual(owedStatus({ ...ada, received: 20000 }, NOW), { label: 'Paid', tone: 'positive' });
  assert.deepEqual(owedSummary([chidi, ada], NOW), { total: 65000, count: 2, late: 1 });
});

test('a payment lowers what is owed and becomes a sale today', () => {
  const { list, tx } = receivePayment([chidi, ada], 'c', 30000, NOW);
  assert.equal(remaining(list[0]), 20000);
  assert.equal(tx.cat, 'Sales');
  assert.equal(tx.type, 'credit');
  assert.equal(tx.date, '15/11/2026');
  assert.equal(businessFigures([tx], new Date(2026, 10, 1), new Date(2026, 11, 1)).sales, 30000);
  assert.match(receivePayment([chidi], 'c', 60000, NOW).error, /only owe ₦50,000 more/);
});

test('reminders come on the due day and twice after while unpaid', () => {
  const times = followUpTimes({ ...ada, dueDate: '2026-11-20' }, NOW);
  assert.deepEqual(times.map(t => t.at.getDate()), [20, 23, 27]);
  // Only the reminders still ahead of now.
  assert.deepEqual(followUpTimes(chidi, NOW).map(t => t.after), [7]);
  assert.deepEqual(followUpTimes({ ...chidi, dueDate: '2026-11-01' }, NOW), []);
  assert.deepEqual(followUpTimes({ ...ada, received: 20000 }, NOW), []);
  assert.equal(followUpBody(ada, 3), 'Ada still owes you ₦15,000, 3 days after it was due.');
});

test('entries need a name and an amount', () => {
  assert.deepEqual(Object.keys(validateOwed({ name: '', amount: 0, dueDate: '30/11' })), ['name', 'amount', 'dueDate']);
  assert.deepEqual(validateOwed({ name: 'Ada', amount: 100, dueDate: '' }), {});
});

test('tax set-aside is a share of profit, never of a loss', () => {
  assert.equal(taxSetAside(290000, 5), 14500);
  assert.equal(taxSetAside(-1000, 5), 0);
  assert.equal(taxSetAside(290000, 0), 0);
});
