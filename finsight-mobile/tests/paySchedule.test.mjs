import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePeriodStats, daysUntilSalary, expectedPay, payCycle, paydaysOf, typicalIncome,
} from '../services/finance.js';
import { paydayReminderTimes, planPeriod } from '../services/paydayPlan.js';

const d = (y, m, day) => new Date(y, m - 1, day);
const ymd = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const income = (amount, date) => ({ id: Math.random().toString(36), type: 'credit', cat: 'Income', amount, date, desc: 'pay' });

test('paydays are read from the main and second payday, sorted and unique', () => {
  assert.deepEqual(paydaysOf({ salaryDay: '25' }), [25]);
  assert.deepEqual(paydaysOf({ salaryDay: '30', secondPayday: '15' }), [15, 30]);
  assert.deepEqual(paydaysOf({ salaryDay: '15', secondPayday: '15' }), [15]);
  assert.deepEqual(paydaysOf({ salaryDay: '' }), []);
  assert.deepEqual(paydaysOf(null), []);
});

test('one payday works as before', () => {
  const cycle = payCycle('25', d(2026, 11, 6));
  assert.equal(ymd(cycle.start), '2026-10-25');
  assert.equal(ymd(cycle.end), '2026-11-25');
  assert.equal(cycle.payCount, 1);
  assert.equal(daysUntilSalary('25', d(2026, 11, 6)), 19);
});

test('with two paydays the period runs between them', () => {
  const days = [15, 30];
  let cycle = payCycle(days, d(2026, 11, 6));
  assert.equal(ymd(cycle.start), '2026-10-30');
  assert.equal(ymd(cycle.end), '2026-11-15');
  assert.equal(cycle.payCount, 2);
  cycle = payCycle(days, d(2026, 11, 20));
  assert.equal(ymd(cycle.start), '2026-11-15');
  assert.equal(ymd(cycle.end), '2026-11-30');
  // In February day 30 is the last day.
  cycle = payCycle(days, d(2027, 2, 20));
  assert.equal(ymd(cycle.end), '2027-2-28');
  assert.equal(daysUntilSalary(days, d(2026, 11, 6)), 9);
  assert.equal(daysUntilSalary(days, d(2026, 11, 15)), 0);
});

test('a payday today starts a new period', () => {
  const cycle = payCycle([15, 30], d(2026, 11, 15));
  assert.equal(ymd(cycle.start), '2026-11-15');
  assert.equal(cycle.elapsed, 1);
});

test('two paydays that land on one date in a short month count once', () => {
  const cycle = payCycle([30, 31], d(2027, 2, 28));
  assert.equal(ymd(cycle.start), '2027-2-28');
  assert.equal(ymd(cycle.end), '2027-3-30');
});

test('when paid twice a month, each pay expects half the monthly income', () => {
  const user = { income: 400000, salaryDay: '15', secondPayday: '30' };
  const stats = computePeriodStats(user, [], d(2026, 11, 20));
  assert.equal(stats.income, 200000);
  assert.equal(expectedPay(user, []).amount, 200000);
  // Half of the half has arrived, so what came in is used.
  const paid = computePeriodStats(user, [income(150000, '15/11/2026')], d(2026, 11, 20));
  assert.equal(paid.income, 150000);
});

test('reminders cover both paydays', () => {
  const times = paydayReminderTimes([15, 30], d(2026, 11, 6));
  assert.deepEqual(times.map(ymd), ['2026-11-15', '2026-11-30', '2026-12-15', '2026-12-30', '2027-1-15', '2027-1-30']);
  assert.equal(times[0].getHours(), 9);
});

test('the plan period for two paydays is the next half month', () => {
  const period = planPeriod([15, 30], d(2026, 11, 6));
  assert.equal(ymd(period.start), '2026-11-15');
  assert.equal(ymd(period.end), '2026-11-30');
  assert.equal(period.payIn, 9);
});

test('varying income uses the average of recent months that had income', () => {
  const txs = [
    income(300000, '10/10/2026'), income(100000, '25/10/2026'),
    income(200000, '05/08/2026'),
    income(999999, '01/05/2026'), // too old to count
  ];
  assert.deepEqual(typicalIncome(txs, d(2026, 11, 6)), { amount: 300000, months: 2 });
  assert.equal(typicalIncome([], d(2026, 11, 6)), null);
});

test('with varying income and history, the average stands in until money arrives', () => {
  const user = { income: 500000, salaryDay: '' };
  const txs = [income(300000, '10/10/2026'), income(300000, '10/09/2026')];
  const stats = computePeriodStats(user, txs, d(2026, 11, 6));
  assert.equal(stats.incomeVaries, true);
  assert.equal(stats.income, 300000);
  assert.deepEqual(expectedPay(user, txs, d(2026, 11, 6)), { amount: 300000, basis: 'average', months: 2 });
  // A big job lands: what came in is used.
  const later = computePeriodStats(user, [...txs, income(450000, '03/11/2026')], d(2026, 11, 6));
  assert.equal(later.income, 450000);
});

test('with varying income and no history, the income from Settings is used', () => {
  const user = { income: 500000, salaryDay: '' };
  assert.equal(computePeriodStats(user, [], d(2026, 11, 6)).income, 500000);
  assert.deepEqual(expectedPay(user, [], d(2026, 11, 6)), { amount: 500000, basis: 'declared', months: 0 });
});
