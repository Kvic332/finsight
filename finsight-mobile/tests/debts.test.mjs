import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annualFromRate, annualFromRepayment, daysUntilDue, debtsContext, debtSummary, dueStatus, nextMonthlyDue, parseDueDate,
  payoffOrder, payoffPlan, recordPayment, reminderBody, reminderTimes,
} from '../services/debts.js';

const NOW = new Date(2026, 10, 4, 12, 0);
const debt = over => ({
  id: 'a', lender: 'Lender', owed: 100000, annualRate: 60, payment: 20000, dueDate: '2026-11-20', repeatsMonthly: true, ...over,
});
const names = list => list.map(d => d.id);

// ── True cost ─────────────────────────────────────────────────────────────────
test('rates are turned into a yearly figure', () => {
  assert.equal(annualFromRate(5, 'monthly'), 60);
  assert.equal(annualFromRate(28, 'annual'), 28);
  assert.equal(annualFromRate(0, 'monthly'), 0);
  assert.equal(annualFromRate(5, 'weekly'), null);
  assert.equal(annualFromRate(undefined, 'monthly'), null);
});

test('a short loan shows its real yearly cost', () => {
  // ₦6,000 on ₦20,000 for 30 days sounds small, but it's about 365% a year.
  assert.equal(annualFromRepayment(20000, 26000, 30), 365);
  assert.equal(annualFromRepayment(20000, 20000, 30), 0);
});

test('figures that make no sense give no rate', () => {
  assert.equal(annualFromRepayment(0, 100, 30), null);
  assert.equal(annualFromRepayment(100, 50, 30), null);
  assert.equal(annualFromRepayment(100, 200, 0), null);
});

// ── Dates ─────────────────────────────────────────────────────────────────────
test('only real dates are accepted', () => {
  assert.ok(parseDueDate('2026-11-20'));
  assert.equal(parseDueDate('2026-02-31'), null);
  assert.equal(parseDueDate('20/11/2026'), null);
  assert.equal(parseDueDate(''), null);
  assert.equal(parseDueDate(null), null);
});

test('the next due date handles short months and new years', () => {
  assert.equal(nextMonthlyDue('2026-11-20'), '2026-12-20');
  assert.equal(nextMonthlyDue('2026-12-15'), '2027-01-15');
  assert.equal(nextMonthlyDue('2027-01-31'), '2027-02-28');
  assert.equal(nextMonthlyDue('2028-01-31'), '2028-02-29');
});

test('due labels are plain and correct', () => {
  const label = dueDate => dueStatus(debt({ dueDate }), NOW).label;
  assert.equal(label('2026-11-04'), 'Due today');
  assert.equal(label('2026-11-05'), 'Due tomorrow');
  assert.equal(label('2026-11-07'), 'Due in 3 days');
  assert.equal(label('2026-11-03'), 'Overdue by 1 day');
  assert.equal(label('2026-10-25'), 'Overdue by 10 days');
  assert.equal(dueStatus(debt({ dueDate: '2026-11-03' }), NOW).tone, 'negative');
  assert.equal(dueStatus(debt({ dueDate: '2026-11-07' }), NOW).tone, 'warning');
  assert.equal(dueStatus(debt({ dueDate: '2026-12-07' }), NOW).tone, 'neutral');
  assert.equal(dueStatus(debt({ dueDate: null }), NOW), null);
  assert.equal(dueStatus(debt({ owed: 0 }), NOW).label, 'Cleared');
});

test('days until due ignores the time of day', () => {
  assert.equal(daysUntilDue(debt({ dueDate: '2026-11-05' }), new Date(2026, 10, 4, 23, 59)), 1);
  assert.equal(daysUntilDue(debt({ dueDate: 'bad' }), NOW), null);
});

// ── Payoff order ──────────────────────────────────────────────────────────────
test('the most expensive debt comes first', () => {
  const list = [debt({ id: 'cheap', annualRate: 30 }), debt({ id: 'dear', annualRate: 300 }), debt({ id: 'mid', annualRate: 60 })];
  assert.deepEqual(names(payoffOrder(list)), ['dear', 'mid', 'cheap']);
});

test('ties go to the smaller balance, unknown rates go last, cleared debts drop out', () => {
  const list = [
    debt({ id: 'big', owed: 90000 }),
    debt({ id: 'small', owed: 10000 }),
    debt({ id: 'unknown', annualRate: null, owed: 1000 }),
    debt({ id: 'cleared', owed: 0, annualRate: 900 }),
  ];
  assert.deepEqual(names(payoffOrder(list)), ['small', 'big', 'unknown']);
});

test('ordering leaves the original list alone', () => {
  const list = [debt({ id: 'x', annualRate: 1 }), debt({ id: 'y', annualRate: 9 })];
  payoffOrder(list);
  assert.equal(list[0].id, 'x');
});

// ── Summary ───────────────────────────────────────────────────────────────────
test('the summary totals what is owed and what is due monthly', () => {
  const summary = debtSummary([
    debt({ id: 'a', owed: 100000, payment: 20000, dueDate: '2026-11-20' }),
    debt({ id: 'b', owed: 50000, payment: 10000, dueDate: '2026-11-06' }),
    debt({ id: 'one-off', owed: 30000, payment: 30000, dueDate: '2026-12-01', repeatsMonthly: false }),
    debt({ id: 'cleared', owed: 0, payment: 99999 }),
  ], 300000, NOW);
  assert.equal(summary.totalOwed, 180000);
  assert.equal(summary.count, 3);
  assert.equal(summary.monthly, 30000);
  assert.equal(summary.shareOfIncome, 10);
  assert.equal(summary.next.id, 'b');
  assert.equal(summary.overdue, 0);
});

test('the summary counts overdue debts, and copes with no income or debts', () => {
  assert.equal(debtSummary([debt({ dueDate: '2026-11-01' })], 0, NOW).overdue, 1);
  assert.equal(debtSummary([debt()], 0, NOW).shareOfIncome, null);
  const empty = debtSummary([], 100, NOW);
  assert.equal(empty.totalOwed, 0);
  assert.equal(empty.next, null);
});

// ── Payments ──────────────────────────────────────────────────────────────────
test('a payment lowers what is owed and moves a monthly due date on', () => {
  const [paid] = recordPayment([debt()], 'a', 20000);
  assert.equal(paid.owed, 80000);
  assert.equal(paid.paid, 20000);
  assert.equal(paid.dueDate, '2026-12-20');
});

test('a one-off debt keeps its date, and other debts are untouched', () => {
  const list = [debt({ repeatsMonthly: false }), debt({ id: 'b' })];
  const [first, second] = recordPayment(list, 'a', 1000);
  assert.equal(first.dueDate, '2026-11-20');
  assert.equal(second, list[1]);
});

test('paying too much stops at zero', () => {
  const [paid] = recordPayment([debt({ owed: 500, paid: 100 })], 'a', 900);
  assert.equal(paid.owed, 0);
  assert.equal(paid.paid, 600);
  assert.equal(paid.dueDate, '2026-11-20');
  assert.equal(dueStatus(paid, NOW).state, 'cleared');
});

// ── Plan ──────────────────────────────────────────────────────────────────────
test('a zero-rate debt clears in the expected time', () => {
  const plan = payoffPlan([debt({ annualRate: 0, owed: 100000, payment: 25000 })]);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.months, 4);
  assert.equal(plan.interest, 0);
});

test('interest is added each month', () => {
  // ₦1,000 at 12% a year is 1% a month: ₦10 of interest, then cleared.
  const plan = payoffPlan([debt({ owed: 1000, annualRate: 12, payment: 2000 })]);
  assert.equal(plan.months, 1);
  assert.equal(plan.interest, 10);
});

test('paying extra is faster and costs less', () => {
  const debts = [debt({ owed: 200000, annualRate: 120, payment: 25000 })];
  const plan = payoffPlan(debts, 25000);
  assert.ok(plan.monthsSaved > 0);
  assert.ok(plan.interestSaved > 0);
  assert.equal(plan.withoutExtra.months, plan.months + plan.monthsSaved);
  assert.equal(payoffPlan(debts, 0).monthsSaved, 0);
});

test('extra money saves more on the expensive debt, when it comes first', () => {
  const debts = [
    debt({ id: 'dear', owed: 100000, annualRate: 240, payment: 10000 }),
    debt({ id: 'cheap', owed: 100000, annualRate: 24, payment: 10000 }),
  ];
  const highest = payoffPlan(debts, 20000).interest;
  const onlyDear = payoffPlan([debts[0]], 20000).interest + payoffPlan([debts[1]], 0).interest;
  assert.ok(highest <= onlyDear);
});

test('a monthly payment moves to the next debt once its own is cleared', () => {
  const plan = payoffPlan([
    debt({ id: 'a', owed: 10000, annualRate: 0, payment: 10000 }),
    debt({ id: 'b', owed: 30000, annualRate: 0, payment: 10000 }),
  ]);
  // Month 1 clears a and pays 10,000 on b. Then 20,000 a month clears the rest in one.
  assert.equal(plan.months, 2);
});

test('a one-off payment does not carry on as spare money', () => {
  const plan = payoffPlan([
    debt({ id: 'once', owed: 26000, annualRate: 0, payment: 26000, repeatsMonthly: false }),
    debt({ id: 'monthly', owed: 100000, annualRate: 0, payment: 25000 }),
  ]);
  // Only ₦25,000 comes round each month, so it takes four months, not two.
  assert.equal(plan.months, 4);
});

test('payments that never clear the debt are reported, not hidden', () => {
  const stuck = [debt({ owed: 1000000, annualRate: 360, payment: 1000 })];
  assert.deepEqual(payoffPlan(stuck), { status: 'too_low' });
  const rescued = payoffPlan(stuck, 500000);
  assert.equal(rescued.status, 'ok');
  assert.equal(rescued.withoutExtra, null);
  assert.equal(rescued.monthsSaved, null);
});

test('the plan names debts missing a rate or payment', () => {
  const plan = payoffPlan([debt(), debt({ id: 'b', annualRate: null }), debt({ id: 'c', payment: 0 })]);
  assert.equal(plan.status, 'incomplete');
  assert.deepEqual(names(plan.missing), ['b', 'c']);
  assert.equal(payoffPlan([]).status, 'none');
  assert.equal(payoffPlan([debt({ owed: 0 })]).status, 'none');
});

// ── Reminders ─────────────────────────────────────────────────────────────────
test('reminders come 3 days before, the day before and on the day', () => {
  const times = reminderTimes(debt(), NOW);
  assert.deepEqual(times.map(t => t.daysBefore), [3, 1, 0]);
  assert.equal(times[0].at.getDate(), 17);
  assert.equal(times[2].at.getDate(), 20);
  assert.equal(times[0].at.getHours(), 9);
});

test('reminders in the past are skipped, and cleared debts get none', () => {
  // Now is 12:00 on the 4th, so 9am today has gone.
  assert.deepEqual(reminderTimes(debt({ dueDate: '2026-11-05' }), NOW).map(t => t.daysBefore), [0]);
  assert.deepEqual(reminderTimes(debt({ dueDate: '2026-11-04' }), NOW), []);
  assert.deepEqual(reminderTimes(debt({ owed: 0 }), NOW), []);
  assert.deepEqual(reminderTimes(debt({ dueDate: null }), NOW), []);
});

test('reminder wording is plain and leaves out the amount', () => {
  assert.equal(reminderBody('Kuda', 3), 'Your Kuda payment is due in 3 days.');
  assert.equal(reminderBody('Kuda', 1), 'Your Kuda payment is due tomorrow.');
  assert.equal(reminderBody('Kuda', 0), 'Your Kuda payment is due today.');
});

// ── ARIA ──────────────────────────────────────────────────────────────────────
test('ARIA gets a short summary, most expensive first', () => {
  const text = debtsContext([
    debt({ id: 'a', lender: 'Cheap', annualRate: 20, owed: 5000 }),
    debt({ id: 'b', lender: 'Dear', annualRate: 200, owed: 1000, dueDate: null }),
    debt({ id: 'c', lender: 'NoRate', annualRate: null, owed: 1000, dueDate: null }),
  ]);
  assert.ok(text.indexOf('Dear') < text.indexOf('Cheap'));
  assert.match(text, /about 200% a year/);
  assert.match(text, /rate not given/);
  assert.equal(debtsContext([]), 'None recorded');
});
