import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addToGoal, budgetSpent, budgetStatus, goalProgress, normalizeGoals,
} from '../services/plans.js';

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
