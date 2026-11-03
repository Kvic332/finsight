import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTxDate, isSameMonth, savingsFlows, spendingOf,
  daysUntilSalary, runwayDays, formatRunway, computeStats, payCycle, computePaydayPlan,
} from '../services/finance.js';

const date = (y, m, d) => new Date(y, m - 1, d);
const tx = (over) => ({ type: 'debit', cat: 'Food', amount: 1000, date: '10/06/2026', source: 'manual', ...over });

test('parseTxDate reads DD/MM/YYYY without swapping day and month', () => {
  assert.deepEqual(parseTxDate('03/11/2026'), date(2026, 11, 3));
  assert.deepEqual(parseTxDate('3/1/2026'), date(2026, 1, 3));
});

test('parseTxDate reads ISO dates and rejects rubbish', () => {
  assert.deepEqual(parseTxDate('2026-11-03'), date(2026, 11, 3));
  assert.deepEqual(parseTxDate('2026-11-03T10:00:00Z'), date(2026, 11, 3));
  assert.equal(parseTxDate('31/02/2026'), null);
  assert.equal(parseTxDate('yesterday'), null);
  assert.equal(parseTxDate(undefined), null);
});

test('isSameMonth keeps a 13th-or-later date in the right month', () => {
  assert.equal(isSameMonth('25/06/2026', date(2026, 6, 30)), true);
  assert.equal(isSameMonth('25/06/2025', date(2026, 6, 30)), false);
});

test('savings debits are not spending', () => {
  const txs = [tx({ amount: 500 }), tx({ cat: 'Savings', amount: 200 })];
  assert.equal(spendingOf(txs).length, 1);
});

test('savings flows separate contributions from withdrawals', () => {
  const flows = savingsFlows([
    tx({ cat: 'Savings', type: 'debit', amount: 5000, source: 'push' }),
    tx({ cat: 'Savings', type: 'credit', amount: 2000, source: 'manual' }),
    tx({ cat: 'Savings', type: 'credit', amount: 1000, source: 'push' }),
  ]);
  assert.deepEqual(flows, { contributed: 7000, withdrawn: 1000, saved: 6000 });
});

test('saved never goes below zero', () => {
  assert.equal(savingsFlows([tx({ cat: 'Savings', type: 'credit', amount: 900, source: 'push' })]).saved, 0);
});

test('daysUntilSalary handles today, later this month and next month', () => {
  assert.equal(daysUntilSalary(25, date(2026, 6, 25)), 0);
  assert.equal(daysUntilSalary(25, date(2026, 6, 20)), 5);
  assert.equal(daysUntilSalary(25, date(2026, 6, 26)), 29);
});

test('daysUntilSalary clamps to short months and crosses the year', () => {
  assert.equal(daysUntilSalary(31, date(2026, 2, 28)), 0);
  assert.equal(daysUntilSalary(31, date(2026, 3, 1)), 30);
  assert.equal(daysUntilSalary(1, date(2026, 12, 15)), 17);
});

test('daysUntilSalary returns null when unset or invalid', () => {
  for (const v of [undefined, null, '', 0, 32, 'soon']) assert.equal(daysUntilSalary(v), null);
});

test('runway is null without spending, floored and capped otherwise', () => {
  assert.equal(runwayDays(1000, 0), null);
  assert.equal(runwayDays(1000, 300), 3);
  assert.equal(runwayDays(1e9, 1), 365);
  assert.equal(formatRunway(null), 'not enough data');
  assert.equal(formatRunway(365), '365+ days');
  assert.equal(formatRunway(12), '12 days');
});

test('left is income minus spending and savings, and savings no longer inflate it', () => {
  const now = date(2026, 6, 20);
  const s = computeStats({ income: 100000 }, [
    tx({ amount: 30000, date: '05/06/2026' }),
    tx({ cat: 'Savings', type: 'credit', amount: 10000, date: '06/06/2026' }),
  ], now);
  assert.equal(s.left, 60000);
  assert.equal(s.totalSpend, 30000);
  assert.equal(s.totalSaved, 10000);
  assert.equal(s.savingsRate, 10);
});

test('a withdrawal from savings adds back to what is left', () => {
  const s = computeStats({ income: 100000 }, [
    tx({ cat: 'Savings', type: 'credit', amount: 5000, source: 'push', date: '06/06/2026' }),
  ], date(2026, 6, 20));
  assert.equal(s.left, 105000);
  assert.equal(s.totalSaved, 0);
});

test('other months do not count', () => {
  const s = computeStats({ income: 100000 }, [tx({ amount: 99000, date: '05/05/2026' })], date(2026, 6, 20));
  assert.equal(s.left, 100000);
  assert.equal(s.totalSpend, 0);
});

test('a small credit cannot replace declared income, a bigger one can', () => {
  const now = date(2026, 6, 20);
  const small = tx({ type: 'credit', cat: 'Income', amount: 4000, date: '02/06/2026' });
  const big = tx({ type: 'credit', cat: 'Income', amount: 150000, date: '02/06/2026' });
  assert.equal(computeStats({ income: 100000 }, [small], now).income, 100000);
  assert.equal(computeStats({ income: 100000 }, [big], now).income, 150000);
});

test('burn rate uses days elapsed, not a flat 30', () => {
  const s = computeStats({ income: 100000 }, [tx({ amount: 20000, date: '01/06/2026' })], date(2026, 6, 10));
  assert.equal(s.dailySpend, 2000);
  assert.equal(s.daysLeft, 40);
  assert.equal(s.daysLeftIfCut20, 50);
});

test('burn rate is not skewed by one big payment in the first week', () => {
  const s = computeStats({ income: 100000 }, [tx({ amount: 70000, date: '01/06/2026' })], date(2026, 6, 1));
  assert.equal(s.dailySpend, 10000);
  assert.equal(s.daysLeft, 3);
});

test('no spending means no runway rather than a fake healthy number', () => {
  const s = computeStats({ income: 100000 }, [], date(2026, 6, 10));
  assert.equal(s.daysLeft, null);
  assert.equal(s.daysLeftIfCut20, null);
});

test('payday projection reflects the burn rate', () => {
  const now = date(2026, 6, 10);
  const txs = [tx({ amount: 20000, date: '01/06/2026' })];
  const ok = computeStats({ income: 100000, salaryDay: 25 }, txs, now);
  assert.equal(ok.daysUntilSalary, 15);
  assert.equal(ok.projectedOnPayday, 50000);
  assert.equal(ok.willMakePayday, true);
  const short = computeStats({ income: 25000, salaryDay: 25 }, txs, now);
  assert.equal(short.projectedOnPayday, 0);
  assert.equal(short.willMakePayday, false);
});

test('without a salary day there is no payday projection', () => {
  const s = computeStats({ income: 100000 }, [], date(2026, 6, 10));
  assert.equal(s.daysUntilSalary, null);
  assert.equal(s.projectedOnPayday, null);
  assert.equal(s.willMakePayday, null);
});

test('spend trend covers 7 days across a month boundary in both date formats', () => {
  const s = computeStats({}, [
    tx({ amount: 300, date: '30/06/2026' }),
    tx({ amount: 200, date: '2026-07-02' }),
    tx({ amount: 999, date: '2026-07-02', cat: 'Savings' }),
  ], date(2026, 7, 2));
  assert.equal(s.spendTrend.length, 7);
  assert.equal(s.spendTrend[4].spend, 300);
  assert.equal(s.spendTrend[6].spend, 200);
});

test('category totals exclude savings', () => {
  const s = computeStats({}, [
    tx({ cat: 'Food', amount: 100 }), tx({ cat: 'Savings', amount: 500 }),
  ], date(2026, 6, 20));
  assert.deepEqual(s.categoryTotals, { Food: 100 });
});

test('FinScore stays within 10 to 100', () => {
  const low = computeStats({ income: 1000 }, [tx({ amount: 5000 })], date(2026, 6, 20));
  assert.equal(low.finScore >= 10, true);
  const high = computeStats({ income: 100000, goals: ['Car'] }, [
    tx({ cat: 'Savings', amount: 30000 }), tx({ cat: 'Food', amount: 100 }),
    tx({ cat: 'Transport', amount: 100 }), tx({ cat: 'Health', amount: 100 }),
  ], date(2026, 6, 20));
  assert.equal(high.finScore <= 100, true);
  assert.equal(high.finScore > low.finScore, true);
});

test('payCycle runs from the last payday to the next', () => {
  const c = payCycle(25, date(2026, 11, 3));
  assert.deepEqual(c.start, date(2026, 10, 25));
  assert.deepEqual(c.end, date(2026, 11, 25));
  assert.equal(c.length, 31);
  assert.equal(c.elapsed, 10);
  assert.equal(c.daysToGo, 22);
  assert.equal(c.hasPayday, true);
});

test('payCycle starts fresh on payday itself', () => {
  const c = payCycle(25, date(2026, 11, 25));
  assert.deepEqual(c.start, date(2026, 11, 25));
  assert.deepEqual(c.end, date(2026, 12, 25));
  assert.equal(c.elapsed, 1);
  assert.equal(c.daysToGo, 30);
});

test('payCycle handles month ends and the new year', () => {
  assert.deepEqual(payCycle(31, date(2026, 2, 28)).start, date(2026, 2, 28));
  assert.deepEqual(payCycle(31, date(2026, 2, 28)).end, date(2026, 3, 31));
  assert.deepEqual(payCycle(25, date(2027, 1, 5)).start, date(2026, 12, 25));
});

test('payCycle falls back to the calendar month without a salary day', () => {
  const c = payCycle(undefined, date(2026, 11, 3));
  assert.equal(c.hasPayday, false);
  assert.deepEqual(c.start, date(2026, 11, 1));
  assert.deepEqual(c.end, date(2026, 12, 1));
  assert.equal(c.daysToGo, 28);
});

test('the payday plan counts spending since the last payday, across the month boundary', () => {
  const plan = computePaydayPlan({ income: 450000, salaryDay: 25 }, [
    tx({ amount: 100000, date: '28/10/2026' }),
    tx({ amount: 37600, date: '02/11/2026' }),
    tx({ amount: 999999, date: '20/10/2026' }),
  ], date(2026, 11, 3));
  assert.equal(plan.totalSpend, 137600);
  assert.equal(plan.left, 312400);
  assert.equal(plan.safePerDay, 14200);
  assert.equal(plan.dailySpend, 13760);
  assert.equal(plan.daysLeft, 22);
  assert.equal(plan.shortDays, 0);
  assert.equal(plan.cutPerDay, 0);
});

test('the payday plan says how short you are and how much to cut', () => {
  const plan = computePaydayPlan({ income: 450000, salaryDay: 25 }, [tx({ amount: 150000, date: '28/10/2026' })], date(2026, 11, 3));
  assert.equal(plan.left, 300000);
  assert.equal(plan.dailySpend, 15000);
  assert.equal(plan.daysLeft, 20);
  assert.equal(plan.shortDays, 2);
  assert.equal(plan.safePerDay, 13636);
  assert.equal(plan.cutPerDay, 1400);
});

test('the payday plan is calm when there is nothing to measure', () => {
  const plan = computePaydayPlan({ income: 450000, salaryDay: 25 }, [], date(2026, 11, 3));
  assert.equal(plan.daysLeft, null);
  assert.equal(plan.shortDays, 0);
  assert.equal(plan.cutPerDay, 0);
});

test('money in counts this cycle only and excludes savings withdrawals', () => {
  const plan = computePaydayPlan({ income: 450000, salaryDay: 25 }, [
    tx({ type: 'credit', cat: 'Income', amount: 450000, date: '25/10/2026' }),
    tx({ type: 'credit', cat: 'Income', amount: 7000, date: '24/10/2026' }),
    tx({ type: 'credit', cat: 'Savings', amount: 5000, source: 'push', date: '30/10/2026' }),
  ], date(2026, 11, 3));
  assert.equal(plan.moneyIn, 450000);
});

test('parseTxDate reads a month-first date when the day first reading is impossible', () => {
  assert.deepEqual(parseTxDate('5/18/2026'), date(2026, 5, 18));
  assert.deepEqual(parseTxDate('05/06/2026'), date(2026, 6, 5));
  assert.equal(parseTxDate('13/13/2026'), null);
});
