import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addToGoal, budgetSpent, budgetStatus, goalProgress, normalizeGoals, unassignedSavings, updateGoal,
} from '../services/plans.js';

test('savings not in any goal are found, and never go below zero', () => {
  const goals = [{ id: '1', saved: 50000 }, { id: '2', saved: 0 }];
  assert.equal(unassignedSavings(366583, goals), 316583);
  assert.equal(unassignedSavings(366583, []), 366583);
  // After a withdrawal, goals can hold more than is saved: nothing is unassigned.
  assert.equal(unassignedSavings(20000, goals), 0);
});

const now = new Date(2026, 10, 20);
const tx = over => ({ type: 'debit', cat: 'Food', amount: 1000, date: '05/11/2026', desc: 'Lunch', ...over });

test('a budget counts this month\'s debits in its category', () => {
  const spent = budgetSpent({ cat: 'Food' }, [
    tx({ amount: 500 }),
    tx({ amount: 700, cat: 'Transport' }),
    tx({ amount: 900, date: '05/10/2026' }),
    tx({ amount: 1200, type: 'credit' }),
  ], now);
  assert.equal(spent, 500);
});

test('a budget also counts matching keywords, and never counts a transaction twice', () => {
  const budget = { cat: 'Entertainment', keywords: ['Netflix', ' ', 'x'] };
  const spent = budgetSpent(budget, [
    tx({ amount: 7500, cat: 'Other', desc: 'NETFLIX subscription' }),
    tx({ amount: 3000, cat: 'Entertainment', desc: 'Netflix gift' }),
    tx({ amount: 100, cat: 'Other', desc: 'Taxi' }),
  ], now);
  assert.equal(spent, 10500);
});

test("a budget counts purchases that mention its name, whatever their category", () => {
  const budget = { name: 'Laptop', cat: 'Shopping', limit: 350000 };
  const spent = budgetSpent(budget, [
    tx({ amount: 350000, cat: 'Food', desc: 'Laptop from Slot' }),
    tx({ amount: 900, cat: 'Other', desc: 'Laptops bag' }),
    tx({ amount: 400, cat: 'Other', desc: 'laptop stand' }),
  ], now);
  assert.equal(spent, 350400);
});

test('a short or symbol-filled budget name matches safely', () => {
  assert.equal(budgetSpent({ name: 'TV', cat: 'Shopping' }, [tx({ cat: 'Other', desc: 'tv licence' })], now), 0);
  assert.equal(budgetSpent({ name: 'Data (MTN)', cat: 'Utilities' }, [tx({ cat: 'Other', desc: 'data (mtn) bundle' })], now), 1000);
});

test('a monthly budget can count the pay period instead of the calendar month', () => {
  // Payday on the 23rd: the period runs 23 Oct to 23 Nov.
  const period = { start: new Date(2026, 9, 23), end: new Date(2026, 10, 23) };
  const spent = budgetSpent({ cat: 'Food' }, [
    tx({ amount: 400, date: '25/10/2026' }),
    tx({ amount: 600, date: '05/11/2026' }),
    tx({ amount: 900, date: '22/10/2026' }),
    tx({ amount: 800, date: '23/11/2026' }),
  ], now, period);
  assert.equal(spent, 1000);
});

test('a one-off budget counts by name from its start, across months, ignoring its category', () => {
  const laptop = { name: 'Laptop', cat: 'Other', limit: 590000, oneOff: true, startDate: '2026-10-01' };
  const spent = budgetSpent(laptop, [
    tx({ amount: 300000, cat: 'Transfer', desc: 'Laptop deposit', date: '15/10/2026' }),
    tx({ amount: 290000, cat: 'Shopping', desc: 'laptop balance', date: '03/11/2026' }),
    tx({ amount: 5000, cat: 'Other', desc: 'Gift' }),
    tx({ amount: 9000, cat: 'Other', desc: 'Laptop bag', date: '20/09/2026' }),
  ], now);
  assert.equal(spent, 590000);
});

test('a one-off budget without a start date counts from the month it was made', () => {
  const budget = { name: 'Wedding', cat: 'Other', oneOff: true, createdMonth: '2026-11' };
  const spent = budgetSpent(budget, [
    tx({ amount: 100, desc: 'Wedding cake', date: '01/11/2026' }),
    tx({ amount: 900, desc: 'Wedding venue', date: '31/10/2026' }),
  ], now);
  assert.equal(spent, 100);
});

test('an old one-off budget with no dates starts this month, not with all history', () => {
  // A laptop stand bought in May shouldn't count towards a laptop planned in November.
  const budget = { name: 'Laptop', cat: 'Other', oneOff: true };
  const spent = budgetSpent(budget, [
    tx({ amount: 2899, desc: 'order 10 Steps Laptop Stand', date: '28/05/2026' }),
    tx({ amount: 500000, desc: 'Laptop', date: '02/11/2026' }),
  ], now);
  assert.equal(spent, 500000);
});

test('a transaction linked to a budget counts there, and only there', () => {
  const laptop = { id: 'lap', name: 'Laptop', cat: 'Other', limit: 590000, oneOff: true, startDate: '2026-11-01' };
  const food = { id: 'food', name: 'Food', cat: 'Food', limit: 60000 };
  const txs = [
    // A bank transfer for the laptop, before the budget started, linked by hand.
    tx({ id: '1', amount: 560000, cat: 'Transfer', desc: 'TRF TO SLOT SYSTEMS', date: '28/10/2026', budgetId: 'lap' }),
    // Food-category spending linked to the laptop doesn't count as food too.
    tx({ id: '2', amount: 5000, cat: 'Food', desc: 'Laptop bag', date: '05/11/2026', budgetId: 'lap' }),
    tx({ id: '3', amount: 2000, cat: 'Food', desc: 'Lunch', date: '05/11/2026' }),
  ];
  assert.equal(budgetSpent(laptop, txs, now), 565000);
  assert.equal(budgetSpent(food, txs, now), 2000);
});

test('a linked transaction still respects a monthly budget\'s period', () => {
  const food = { id: 'food', name: 'Food', cat: 'Food', limit: 60000 };
  const period = { start: new Date(2026, 10, 1), end: new Date(2026, 11, 1) };
  const txs = [tx({ amount: 3000, cat: 'Other', desc: 'Groceries', date: '20/10/2026', budgetId: 'food' })];
  assert.equal(budgetSpent(food, txs, now, period), 0);
});

test('goal names lose stray spaces', () => {
  assert.equal(normalizeGoals([{ id: '1', name: 'Investment ', target: 100 }])[0].name, 'Investment');
  assert.equal(normalizeGoals([{ id: '1', name: '  ', target: 100 }])[0].name, 'Goal');
});

test('budget status warns at 80% and flags going over', () => {
  assert.equal(budgetStatus(50, 100).tone, 'accent');
  assert.equal(budgetStatus(80, 100).tone, 'warning');
  assert.equal(budgetStatus(100, 100).tone, 'warning');
  const over = budgetStatus(130, 100);
  assert.equal(over.tone, 'negative');
  assert.equal(over.left, -30);
  assert.equal(over.percent, 130);
  assert.equal(budgetStatus(10, 0).percent, 0);
});

test('old goal formats are upgraded without losing anything', () => {
  const goals = normalizeGoals(['Car', { id: '7', name: 'Rent', target: 900000, saved: 5000 }, { name: 'Other', target: '100' }]);
  assert.deepEqual(goals[0], { id: 'goal-Car', name: 'Car', target: 2000000, saved: 0 });
  assert.deepEqual(goals[1], { id: '7', name: 'Rent', target: 900000, saved: 5000 });
  assert.deepEqual(goals[2], { id: 'goal-Other', name: 'Other', target: 100, saved: 0 });
  assert.deepEqual(normalizeGoals(undefined), []);
});

test('adding money changes only the chosen goal', () => {
  const goals = [{ id: 'a', name: 'A', target: 100, saved: 10 }, { id: 'b', name: 'B', target: 100, saved: 0 }];
  const out = addToGoal(goals, 'a', 25);
  assert.equal(out[0].saved, 35);
  assert.equal(out[1].saved, 0);
  assert.equal(goals[0].saved, 10);
});

test('goal progress never overstates and caps at 100%', () => {
  assert.deepEqual(goalProgress({ target: 1000, saved: 999 }), { used: 0.999, percent: 99, toGo: 1, done: false });
  const done = goalProgress({ target: 1000, saved: 1500 });
  assert.equal(done.percent, 100);
  assert.equal(done.toGo, 0);
  assert.equal(done.done, true);
});

test('editing a goal keeps its saved amount and leaves others alone', () => {
  const goals = [{ id: 'a', name: 'A', target: 100, saved: 40 }, { id: 'b', name: 'B', target: 200, saved: 0 }];
  const out = updateGoal(goals, 'a', { name: 'Car', target: 900 });
  assert.deepEqual(out[0], { id: 'a', name: 'Car', target: 900, saved: 40 });
  assert.deepEqual(out[1], goals[1]);
});
