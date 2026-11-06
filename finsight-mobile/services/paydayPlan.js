// ── Salary-day planner ────────────────────────────────────────────────────────
// Suggests how to split a month's pay: debts, then budgets, then savings, and
// what's left to spend. Pure functions only, so they can be unit tested.
import { activeDebts, parseDueDate } from './debts.js';
import { payCycle } from './finance.js';
import { goalProgress } from './plans.js';

export const SAVE_PERCENTS = [5, 10, 20, 30];
export const DEFAULT_SAVE_PERCENT = 20;
const REMINDER_HOUR = 9;
const REMINDERS_AHEAD = 3;

// The next few paydays at 9am. Scheduled ahead and refreshed whenever the app
// opens, so a reminder still arrives if the app isn't opened for a while.
// salaryDay can be one day or a list, for people paid twice a month.
export function paydayReminderTimes(salaryDay, now = new Date()) {
  const days = (Array.isArray(salaryDay) ? salaryDay : [salaryDay])
    .map(d => parseInt(d, 10)).filter(d => d >= 1 && d <= 31);
  if (!days.length) return [];
  const times = new Map();
  for (let i = 0; i <= REMINDERS_AHEAD; i++) {
    const year = now.getFullYear();
    const month = now.getMonth() + i;
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (const day of days) {
      const at = new Date(year, month, Math.min(day, lastDay), REMINDER_HOUR);
      times.set(at.getTime(), at);
    }
  }
  return [...times.values()].sort((a, b) => a - b).filter(at => at > now).slice(0, REMINDERS_AHEAD * days.length);
}

// The month this pay has to last: starting today on payday, otherwise from the
// next payday. With no fixed payday it's the calendar month. salaryDay can be
// one day or a list of days.
export function planPeriod(salaryDay, now = new Date()) {
  const cycle = payCycle(salaryDay, now);
  const { start, end, hasPayday } = cycle.hasPayday && cycle.elapsed > 1 ? payCycle(salaryDay, cycle.end) : cycle;
  return { start, end, hasPayday, days: Math.round((end - start) / 86400000), payIn: hasPayday ? cycle.elapsed > 1 ? cycle.daysToGo : 0 : null };
}

// Payments owed before the period ends. A debt with no date is counted, because
// it's better to plan for it than to forget it.
function debtsToPay(debts, period) {
  return activeDebts(debts).filter(d => {
    const due = parseDueDate(d.dueDate);
    return !due || due < period.end;
  });
}

export function planPayday({ pay, debts = [], budgets = [], savePercent = DEFAULT_SAVE_PERCENT, period }) {
  const due = debtsToPay(debts, period);
  const debtLines = due
    .filter(d => d.payment > 0)
    .map(d => ({ id: d.id, lender: d.lender, amount: Math.min(d.payment, d.owed) }));
  const debtTotal = debtLines.reduce((sum, d) => sum + d.amount, 0);
  // A savings budget is the same money as the savings share, so it isn't counted twice.
  // A one-off budget, like a laptop, isn't spent every month, so it's listed apart.
  const budgetTotal = budgets.filter(b => b.cat !== 'Savings' && !b.oneOff).reduce((sum, b) => sum + (b.limit || 0), 0);
  const oneOffBudgets = budgets.filter(b => b.oneOff).map(b => b.name);
  const committed = debtTotal + budgetTotal;
  const wanted = Math.round(pay * (savePercent / 100));
  const saving = Math.min(wanted, Math.max(0, pay - committed));
  const free = Math.max(0, pay - committed - saving);
  return {
    pay,
    debtLines,
    debtTotal,
    budgetTotal,
    oneOffBudgets,
    wanted,
    saving,
    free,
    short: Math.max(0, committed - pay),
    perDay: period.days > 0 ? Math.floor(free / period.days) : free,
    noPayment: due.filter(d => !(d.payment > 0)).map(d => d.lender),
  };
}

// How long the first unfinished goal takes at this rate.
export function nextGoalEta(goals, saving) {
  const goal = goals.find(g => !goalProgress(g).done);
  if (!goal || !(saving > 0)) return null;
  return { name: goal.name, months: Math.ceil(goalProgress(goal).toGo / saving) };
}
