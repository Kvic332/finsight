import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../services/finance.js';
import { explainFinScore } from '../services/finScoreExplain.js';

const tx = over => ({ id: Math.random().toString(36), type: 'debit', cat: 'Food', amount: 1000, desc: 'x', ...over });
const NOV = new Date(2026, 10, 15); // halfway through November
const tracker = { usage: 'tracking' };

test('without income, spending is compared with last month instead of an income never entered', () => {
  // Last month ₦60,000 over 30 days; this month ₦15,000 in 15 days: half the pace.
  const txs = [tx({ amount: 60000, date: '10/10/2026' }), tx({ amount: 15000, date: '05/11/2026' })];
  const stats = computeStats(tracker, txs, NOV);
  assert.equal(stats.scoreInputs.scoreMode, 'spending');
  assert.equal(stats.previousSpend, 60000);
  assert.equal(stats.scoreBreakdown.spendScore, 100);
  // The old rule scored any spending with no income at about 0.
  // Spending 35 of 35 points, nothing saved, one category: 37. The old rule gave 10.
  assert.equal(stats.finScore, 37);
});

test('spending faster than last month lowers the spending part', () => {
  const txs = [tx({ amount: 30000, date: '10/10/2026' }), tx({ amount: 30000, date: '05/11/2026' })];
  // ₦2,000 a day against ₦1,000 a day last month.
  assert.equal(computeStats(tracker, txs, NOV).scoreBreakdown.spendScore, 10);
  // With nothing to compare yet, the part is neutral.
  assert.equal(computeStats(tracker, [tx({ date: '05/11/2026' })], NOV).scoreBreakdown.spendScore, 70);
});

test('without income, saving is measured against everything that went out', () => {
  const txs = [tx({ amount: 80000, date: '05/11/2026' }), tx({ amount: 20000, cat: 'Savings', date: '06/11/2026' })];
  const stats = computeStats(tracker, txs, NOV);
  assert.equal(stats.scoreInputs.saveShare, 20);
  assert.equal(stats.scoreBreakdown.saveScore, 100);
});

test('someone with an income keeps the income-based score', () => {
  const stats = computeStats({ income: 100000, salaryDay: '1' }, [tx({ amount: 10000, date: '05/11/2026' })], NOV);
  assert.equal(stats.scoreInputs.scoreMode, 'income');
});

test('the reasons explain the comparison with last month', () => {
  const txs = [tx({ amount: 60000, date: '10/10/2026' }), tx({ amount: 15000, date: '05/11/2026' })];
  const { parts } = explainFinScore(computeStats(tracker, txs, NOV), 'this month');
  assert.match(parts[0].reason, /₦15,000 this month, 50% slower than the period before \(₦60,000\)/);
  assert.match(parts[1].reason, /0% of all the money that went out/);
});

test('the biggest expense this month is found', () => {
  const txs = [tx({ amount: 5000, desc: 'Fuel', date: '03/11/2026' }), tx({ amount: 12000, desc: 'Rent share', date: '04/11/2026' })];
  assert.equal(computeStats(tracker, txs, NOV).biggest.desc, 'Rent share');
});

test('the weekly summary compares this week with last week', async () => {
  const { weeklySummary } = await import('../services/finance.js');
  const txs = [
    tx({ amount: 30000, cat: 'Food', date: '14/11/2026' }), tx({ amount: 12000, cat: 'Transport', date: '12/11/2026' }),
    tx({ amount: 60000, date: '05/11/2026' }), tx({ amount: 5000, cat: 'Savings', date: '13/11/2026' }),
  ];
  const week = weeklySummary(txs, NOV);
  assert.equal(week.spent, 42000);
  assert.equal(week.previous, 60000);
  assert.equal(week.text, 'You spent ₦42,000 this week, most on Food (₦30,000). 30% less than last week. You saved ₦5,000.');
  assert.equal(weeklySummary([], NOV).text, 'Nothing spent this week.');
});
