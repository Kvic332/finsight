import test from 'node:test';
import assert from 'node:assert/strict';
import { nextGoalEta, planPayday, planPeriod } from '../services/paydayPlan.js';

const NOW = new Date(2026, 10, 4, 12, 0);
const period = planPeriod(25, NOW);
const debt = over => ({ id: 'a', lender: 'Lender', owed: 100000, payment: 20000, dueDate: null, repeatsMonthly: true, ...over });
const budget = over => ({ id: 'b', name: 'Food', cat: 'Food', limit: 60000, ...over });

// ── The period the pay has to cover ───────────────────────────────────────────
test('before payday, the plan covers the month after the next payday', () => {
  assert.deepEqual(period.start, new Date(2026, 10, 25));
  assert.deepEqual(period.end, new Date(2026, 11, 25));
  assert.equal(period.days, 30);
  assert.equal(period.payIn, 21);
});

test('on payday, the plan starts today', () => {
  const today = planPeriod(25, new Date(2026, 10, 25, 9));
  assert.deepEqual(today.start, new Date(2026, 10, 25));
  assert.deepEqual(today.end, new Date(2026, 11, 25));
  assert.equal(today.payIn, 0);
});

test('the day after payday, the plan moves on to the next pay', () => {
  const next = planPeriod(25, new Date(2026, 10, 26, 9));
  assert.deepEqual(next.start, new Date(2026, 11, 25));
  assert.equal(next.payIn, 29);
});

test('payday 31 lands on the last day of a short month', () => {
  const short = planPeriod(31, new Date(2026, 10, 4));
  assert.deepEqual(short.start, new Date(2026, 10, 30));
  assert.deepEqual(short.end, new Date(2026, 11, 31));
});

test('with no fixed payday, the plan covers the calendar month', () => {
  const none = planPeriod('', NOW);
  assert.equal(none.hasPayday, false);
  assert.equal(none.payIn, null);
  assert.deepEqual(none.start, new Date(2026, 10, 1));
  assert.equal(none.days, 30);
});

// ── The split ─────────────────────────────────────────────────────────────────
test('pay goes to debts, then budgets, then savings, and the rest is free', () => {
  const plan = planPayday({ pay: 450000, debts: [debt()], budgets: [budget()], savePercent: 20, period });
  assert.equal(plan.debtTotal, 20000);
  assert.equal(plan.budgetTotal, 60000);
  assert.equal(plan.saving, 90000);
  assert.equal(plan.free, 280000);
  assert.equal(plan.short, 0);
  assert.equal(plan.perDay, 9333);
  assert.equal(plan.debtTotal + plan.budgetTotal + plan.saving + plan.free, plan.pay);
});

test('a final payment is no more than what is still owed', () => {
  const plan = planPayday({ pay: 100000, debts: [debt({ owed: 5000 })], period });
  assert.equal(plan.debtTotal, 5000);
});

test('cleared debts are left out', () => {
  const plan = planPayday({ pay: 100000, debts: [debt({ owed: 0 })], period });
  assert.deepEqual(plan.debtLines, []);
});

test('only payments due before the period ends are counted', () => {
  const debts = [
    debt({ id: 'overdue', dueDate: '2026-10-01', repeatsMonthly: false }),
    debt({ id: 'inside', dueDate: '2026-12-24', repeatsMonthly: false }),
    debt({ id: 'edge', dueDate: '2026-12-25', repeatsMonthly: false }),
    debt({ id: 'later', dueDate: '2027-03-01', repeatsMonthly: false }),
    debt({ id: 'undated', dueDate: null, repeatsMonthly: false }),
  ];
  const plan = planPayday({ pay: 500000, debts, period });
  assert.deepEqual(plan.debtLines.map(d => d.id), ['overdue', 'inside', 'undated']);
});

test('a debt with no payment amount is flagged, not guessed', () => {
  const plan = planPayday({ pay: 100000, debts: [debt({ lender: 'Bank', payment: null })], period });
  assert.equal(plan.debtTotal, 0);
  assert.deepEqual(plan.noPayment, ['Bank']);
});

test('a savings budget is not counted on top of the savings share', () => {
  const plan = planPayday({ pay: 100000, budgets: [budget({ cat: 'Savings', limit: 30000 })], savePercent: 10, period });
  assert.equal(plan.budgetTotal, 0);
  assert.equal(plan.saving, 10000);
  assert.equal(plan.free, 90000);
});

test('savings shrink to what is left after debts and budgets', () => {
  const plan = planPayday({ pay: 100000, debts: [debt()], budgets: [budget()], savePercent: 30, period });
  assert.equal(plan.wanted, 30000);
  assert.equal(plan.saving, 20000);
  assert.equal(plan.free, 0);
  assert.equal(plan.short, 0);
});

test('when commitments are more than the pay, the gap is shown', () => {
  const plan = planPayday({ pay: 50000, debts: [debt()], budgets: [budget()], period });
  assert.equal(plan.short, 30000);
  assert.equal(plan.saving, 0);
  assert.equal(plan.free, 0);
  assert.equal(plan.perDay, 0);
});

test('with nothing committed, savings still come out first', () => {
  const plan = planPayday({ pay: 100000, period });
  assert.equal(plan.saving, 20000);
  assert.equal(plan.free, 80000);
});

// ── Goals ─────────────────────────────────────────────────────────────────────
test('the next unfinished goal shows how long it takes', () => {
  const goals = [
    { id: '1', name: 'Done', target: 100, saved: 100 },
    { id: '2', name: 'Laptop', target: 350000, saved: 50000 },
  ];
  assert.deepEqual(nextGoalEta(goals, 90000), { name: 'Laptop', months: 4 });
});

test('no estimate without an unfinished goal or any saving', () => {
  assert.equal(nextGoalEta([], 90000), null);
  assert.equal(nextGoalEta([{ id: '1', name: 'Done', target: 100, saved: 100 }], 90000), null);
  assert.equal(nextGoalEta([{ id: '1', name: 'Laptop', target: 100, saved: 0 }], 0), null);
});
