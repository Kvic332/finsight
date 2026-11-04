// ── Debts and the payoff plan ─────────────────────────────────────────────────
// Pure functions only, so they can be unit tested. Money is in whole naira.

const DAYS_IN_YEAR = 365;
const MAX_PLAN_MONTHS = 600;
export const DUE_SOON_DAYS = 3;
export const REMINDER_DAYS_BEFORE = [3, 1, 0];
const REMINDER_HOUR = 9;

const hasRate = debt => typeof debt.annualRate === 'number' && Number.isFinite(debt.annualRate);

// The yearly cost, simple rather than compounded, so debts can be ranked together.
export function annualFromRate(rate, period) {
  if (!(rate >= 0)) return null;
  const perYear = { annual: 1, monthly: 12 }[period];
  return perYear ? roundRate(rate * perYear) : null;
}

// For loan apps that only say "borrow ₦20,000, repay ₦26,000 in 30 days".
export function annualFromRepayment(borrowed, totalRepay, days) {
  if (!(borrowed > 0) || !(days > 0) || !(totalRepay >= borrowed)) return null;
  return roundRate(((totalRepay - borrowed) / borrowed) * (DAYS_IN_YEAR / days) * 100);
}

const roundRate = value => Math.round(value * 10) / 10;

// Dates are stored as YYYY-MM-DD. Returns null unless it's a real calendar date.
export function parseDueDate(text) {
  const match = String(text ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : null;
}

const formatDueDate = date => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// The same day next month, or the last day of a shorter month.
export function nextMonthlyDue(dueDate) {
  const date = parseDueDate(dueDate);
  if (!date) return dueDate;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 2, 0).getDate();
  return formatDueDate(new Date(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), lastDay)));
}

export function daysUntilDue(debt, now = new Date()) {
  const date = parseDueDate(debt.dueDate);
  if (!date) return null;
  return Math.round((date - startOfDay(now)) / 86400000);
}

export function dueStatus(debt, now = new Date()) {
  if (!(debt.owed > 0)) return { state: 'cleared', label: 'Cleared', tone: 'positive' };
  const days = daysUntilDue(debt, now);
  if (days === null) return null;
  if (days < 0) return { state: 'overdue', label: days === -1 ? 'Overdue by 1 day' : `Overdue by ${-days} days`, tone: 'negative' };
  if (days === 0) return { state: 'soon', label: 'Due today', tone: 'warning' };
  if (days === 1) return { state: 'soon', label: 'Due tomorrow', tone: 'warning' };
  if (days <= DUE_SOON_DAYS) return { state: 'soon', label: `Due in ${days} days`, tone: 'warning' };
  return { state: 'later', label: `Due in ${days} days`, tone: 'neutral' };
}

export const activeDebts = debts => debts.filter(d => d.owed > 0);

// Highest yearly cost first, because that costs least overall. On a tie, the smaller
// balance, which clears a debt sooner. Debts with no rate can't be ranked, so go last.
export function payoffOrder(debts) {
  return [...activeDebts(debts)].sort((a, b) => {
    if (hasRate(a) !== hasRate(b)) return hasRate(a) ? -1 : 1;
    if (hasRate(a) && a.annualRate !== b.annualRate) return b.annualRate - a.annualRate;
    return a.owed - b.owed;
  });
}

// What's needed each month, ignoring one-off debts that have no repeating payment.
export function debtSummary(debts, income = 0, now = new Date()) {
  const active = activeDebts(debts);
  const monthly = active.filter(d => d.repeatsMonthly).reduce((sum, d) => sum + (d.payment || 0), 0);
  const dated = active.filter(d => parseDueDate(d.dueDate));
  const next = [...dated].sort((a, b) => daysUntilDue(a, now) - daysUntilDue(b, now))[0] || null;
  return {
    totalOwed: active.reduce((sum, d) => sum + d.owed, 0),
    count: active.length,
    monthly,
    next,
    overdue: dated.filter(d => daysUntilDue(d, now) < 0).length,
    shareOfIncome: income > 0 ? Math.round((monthly / income) * 100) : null,
  };
}

export function recordPayment(debts, id, amount) {
  return debts.map(debt => {
    if (debt.id !== id) return debt;
    const applied = Math.min(amount, debt.owed);
    const owed = debt.owed - applied;
    return {
      ...debt,
      owed,
      paid: (debt.paid || 0) + applied,
      dueDate: owed > 0 && debt.repeatsMonthly ? nextMonthlyDue(debt.dueDate) : debt.dueDate,
    };
  });
}

// Each month: add interest, pay every minimum, then put what's left on the most
// expensive debt. A cleared monthly debt frees its payment for the next one, but a
// one-off payment isn't money that comes round again.
function simulate(debts, extra) {
  const order = payoffOrder(debts).map(d => ({
    owed: d.owed, rate: d.annualRate / 1200, payment: d.payment, repeats: !!d.repeatsMonthly,
  }));
  const monthlyBudget = order.filter(d => d.repeats).reduce((sum, d) => sum + d.payment, 0) + extra;
  let interest = 0;
  for (let month = 1; month <= MAX_PLAN_MONTHS; month++) {
    const oneOffs = order.filter(d => !d.repeats && d.owed >= 1).reduce((sum, d) => sum + d.payment, 0);
    let left = monthlyBudget + oneOffs;
    for (const debt of order) {
      const charge = debt.owed * debt.rate;
      debt.owed += charge;
      interest += charge;
    }
    for (const debt of order) {
      const pay = Math.min(debt.payment, debt.owed, left);
      debt.owed -= pay;
      left -= pay;
    }
    for (const debt of order) {
      const pay = Math.min(debt.owed, left);
      debt.owed -= pay;
      left -= pay;
    }
    if (order.every(d => d.owed < 1)) return { months: month, interest: Math.round(interest) };
  }
  return null;
}

// An estimate of how long clearing everything takes, and what paying extra saves.
export function payoffPlan(debts, extra = 0) {
  const active = activeDebts(debts);
  if (!active.length) return { status: 'none' };
  const missing = active.filter(d => !hasRate(d) || !(d.payment > 0));
  if (missing.length) return { status: 'incomplete', missing };
  const current = simulate(active, 0);
  const faster = extra > 0 ? simulate(active, extra) : current;
  if (!faster) return { status: 'too_low' };
  return {
    status: 'ok',
    months: faster.months,
    interest: faster.interest,
    // Null when today's payments alone never clear the debts.
    withoutExtra: current,
    monthsSaved: current ? current.months - faster.months : null,
    interestSaved: current ? current.interest - faster.interest : null,
  };
}

// When to remind someone: a few days ahead, the day before and on the day, at 9am.
export function reminderTimes(debt, now = new Date()) {
  const date = parseDueDate(debt.dueDate);
  if (!date || !(debt.owed > 0)) return [];
  return REMINDER_DAYS_BEFORE
    .map(daysBefore => ({
      daysBefore,
      at: new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysBefore, REMINDER_HOUR),
    }))
    .filter(reminder => reminder.at > now);
}

export function reminderBody(lender, daysBefore) {
  if (daysBefore === 0) return `Your ${lender} payment is due today.`;
  if (daysBefore === 1) return `Your ${lender} payment is due tomorrow.`;
  return `Your ${lender} payment is due in ${daysBefore} days.`;
}

// A short summary for ARIA.
export function debtsContext(debts) {
  const active = payoffOrder(debts);
  if (!active.length) return 'None recorded';
  return active.map(d => {
    const rate = hasRate(d) ? `about ${d.annualRate}% a year` : 'rate not given';
    const due = d.dueDate ? `, next due ${d.dueDate}` : '';
    return `${d.lender}: ₦${d.owed.toLocaleString()} owed, ${rate}${due}`;
  }).join(' | ');
}
