// ── Money calculations ────────────────────────────────────────────────────────
// The single source for every figure shown to the user or sent to ARIA.
// Pure functions only: no storage or React, so they can be unit tested.

const CAP_DAYS = 365;
// Early in the month one large payment (rent, school fees) would otherwise look
// like a daily habit, so the burn rate is never averaged over less than this.
const MIN_BURN_WINDOW_DAYS = 7;

// Transactions store dates as DD/MM/YYYY (en-NG) or ISO. `new Date()` misreads
// the first form, so always parse through here. Returns a local date or null.
export function parseTxDate(raw) {
  const str = String(raw || '').trim();
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    // Normally day first. A "month" over 12 means this one was written month first.
    const [day, month] = +dmy[2] > 12 ? [+dmy[2], +dmy[1]] : [+dmy[1], +dmy[2]];
    return validDate(+dmy[3], month, day);
  }
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDate(+iso[1], +iso[2], +iso[3]);
  return null;
}

function validDate(year, month, day) {
  const d = new Date(year, month - 1, day);
  return d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

export function isSameMonth(raw, now = new Date()) {
  const d = parseTxDate(raw);
  return !!d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function isSameDay(raw, day) {
  const d = parseTxDate(raw);
  return !!d && d.toDateString() === day.toDateString();
}

const sumAmounts = list => list.reduce((s, t) => s + (t.amount || 0), 0);

// Spending leaves out money moved into savings: it's still the user's money.
export function spendingOf(transactions) {
  return transactions.filter(t => t.type === 'debit' && t.cat !== 'Savings');
}

// A debit tagged Savings is money moved to savings. A credit tagged Savings is
// either the user logging a contribution by hand, or an alert showing money
// coming back out of a savings app, which is a withdrawal.
export function savingsFlows(transactions) {
  const tagged = transactions.filter(t => t.cat === 'Savings');
  const isContribution = t => t.type === 'debit' || (t.type === 'credit' && t.source === 'manual');
  const contributed = sumAmounts(tagged.filter(isContribution));
  const withdrawn = sumAmounts(tagged.filter(t => t.type === 'credit' && t.source !== 'manual'));
  return { contributed, withdrawn, saved: Math.max(0, contributed - withdrawn) };
}

// Days until the next salary, or null if no salary day is set. Salary day 31 in
// a 30-day month lands on the last day of that month.
export function daysUntilSalary(salaryDay, now = new Date()) {
  const day = parseInt(salaryDay, 10);
  if (!(day >= 1 && day <= 31)) return null;
  const payday = (year, month) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = payday(today.getFullYear(), today.getMonth());
  if (next < today) next = payday(today.getFullYear(), today.getMonth() + 1);
  return Math.round((next - today) / 86400000);
}

// The pay period around today: from the last payday up to the next one. With no
// salary day set, it falls back to the calendar month.
export function payCycle(salaryDay, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = today.getFullYear();
  const m = today.getMonth();
  const day = parseInt(salaryDay, 10);
  const hasPayday = day >= 1 && day <= 31;
  const payday = (year, month) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  };
  let start = new Date(y, m, 1);
  let end = new Date(y, m + 1, 1);
  if (hasPayday) {
    const thisMonth = payday(y, m);
    start = today >= thisMonth ? thisMonth : payday(y, m - 1);
    end = today >= thisMonth ? payday(y, m + 1) : thisMonth;
  }
  const days = (a, b) => Math.round((b - a) / 86400000);
  return { start, end, hasPayday, length: days(start, end), elapsed: days(start, today) + 1, daysToGo: days(today, end) };
}

// Share of the declared income that counts as the salary having arrived.
const SALARY_SEEN_SHARE = 0.5;

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// A correction the user made by entering their real balance. It covers what the
// estimate can't see, such as money carried over from before payday, cash or a
// missed alert, and applies only to the pay period it was made in.
function balanceCorrectionFor(user, range) {
  const check = user?.balanceCheck;
  if (!check || typeof check.correction !== 'number' || !range?.start) return 0;
  return check.periodStart === dayKey(range.start) ? check.correction : 0;
}

// What to store when the user says how much they really have now. The estimate
// passed in is computeStats(...).estimateLeft, before any earlier correction.
export function makeBalanceCheck(realBalance, estimateLeft, period, now = new Date()) {
  return {
    periodStart: dayKey(period.start),
    correction: Math.round(realBalance - estimateLeft),
    realBalance: Math.round(realBalance),
    checkedAt: now.toISOString(),
  };
}

export function runwayDays(left, dailySpend) {
  if (!(dailySpend > 0)) return null;
  return Math.min(CAP_DAYS, Math.floor(left / dailySpend));
}

// For notifications and ARIA. null means there's no spending to measure yet.
export function formatRunway(days) {
  if (days === null || days === undefined) return 'not enough data';
  return days >= CAP_DAYS ? `${CAP_DAYS}+ days` : `${days} days`;
}

function inPeriod(raw, period) {
  const d = parseTxDate(raw);
  return !!d && d >= period.start && d < period.end;
}

export function computeStats(user, transactions, now = new Date(), period = null) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const range = period || { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  const monthTxs = transactions.filter(t => inPeriod(t.date, range));
  const daysSoFar = Math.round((today - range.start) / 86400000) + 1;
  const spending = spendingOf(monthTxs);
  const { contributed, withdrawn, saved: totalSaved } = savingsFlows(monthTxs);
  const totalSpend = sumAmounts(spending);
  const receivedIncome = sumAmounts(monthTxs.filter(t => t.type === 'credit' && t.cat === 'Income'));
  const declared = Number(user?.income) || 0;
  // Once salary-sized money has arrived (at least half the declared income), what
  // actually came in is used, even if it's less. Before then, the declared income
  // stands in, so one small credit can't replace a salary that hasn't landed yet.
  const salarySeen = declared > 0 && receivedIncome >= declared * SALARY_SEEN_SHARE;
  const income = declared > 0 ? (salarySeen ? receivedIncome : declared) : receivedIncome;

  // The estimate before any correction to the user's real balance.
  const estimateLeft = income - totalSpend - contributed + withdrawn;
  const correction = balanceCorrectionFor(user, range);
  const left = Math.max(0, estimateLeft + correction);

  const dailySpend = totalSpend / Math.max(MIN_BURN_WINDOW_DAYS, daysSoFar);
  const daysLeft = runwayDays(left, dailySpend);
  const daysLeftIfCut20 = runwayDays(left, dailySpend * 0.8);

  const salaryIn = daysUntilSalary(user?.salaryDay, now);
  const projectedOnPayday = salaryIn === null ? null : Math.max(0, Math.round(left - dailySpend * salaryIn));
  const willMakePayday = salaryIn === null ? null : left >= dailySpend * salaryIn;

  const savingsRate = income > 0 ? Math.round((totalSaved / income) * 100) : 0;

  const categoryTotals = {};
  spending.forEach(t => { categoryTotals[t.cat] = (categoryTotals[t.cat] || 0) + t.amount; });

  // ── FinScore ───────────────────────────────────────────────────────────────
  // Spend discipline: ratio 0 → 100, ratio 1.0 → 17, ratio ≥ 1.2 → 0
  const spendRatio = income > 0 ? totalSpend / income : 1;
  const spendScore = Math.max(0, Math.min(100, Math.round((1.2 - spendRatio) / 1.2 * 100)));
  // Savings rate: saving 20% or more scores 100
  const saveScore = Math.min(100, savingsRate * 5);
  // Budget adherence: more categories, none dominating, and consistent tracking
  const catValues = Object.values(categoryTotals);
  const maxCatPct = totalSpend > 0 ? Math.max(...catValues) / totalSpend : 1;
  const diversityPoints = Math.min(40, catValues.length * 10);
  const balancePoints = maxCatPct < 0.5 ? 30 : maxCatPct < 0.7 ? 15 : 0;
  const trackingPoints = Math.min(30, transactions.length * 3);
  const txScore = Math.min(100, diversityPoints + balancePoints + trackingPoints);
  // Investment activity: has goals, has savings or investment transactions
  const hasGoals = (user?.goals || []).length > 0;
  const hasSavingsTx = transactions.some(t =>
    t.cat === 'Savings' || /cowrywise|piggyvest|invest|risevest|bamboo/i.test(t.desc || ''));
  const investScore = Math.min(100,
    (hasGoals ? 35 : 0) + (hasSavingsTx ? 45 : 0) +
    (savingsRate >= 10 ? 20 : savingsRate >= 5 ? 10 : 0));
  const finScore = Math.max(10, Math.min(100, Math.round(
    spendScore * 0.35 + saveScore * 0.35 + txScore * 0.15 + investScore * 0.15
  )));

  // Uses all transactions so the week still works across a month boundary.
  const allSpending = spendingOf(transactions);
  const spendTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return {
      day: d.toLocaleDateString('en-NG', { weekday: 'short' }),
      spend: sumAmounts(allSpending.filter(t => isSameDay(t.date, d))),
    };
  });

  return {
    income, salarySeen, estimateLeft, correction, left, totalSpend, totalSaved, savingsRate, dailySpend,
    daysLeft, daysLeftIfCut20,
    daysUntilSalary: salaryIn, projectedOnPayday, willMakePayday,
    categoryTotals, spendTrend, finScore,
    scoreBreakdown: { spendScore, saveScore, txScore, investScore },
  };
}

// Figures for the pay period around today, so every screen counts from the same
// day: the last payday, or the 1st of the month with no fixed payday.
export function computePeriodStats(user, transactions, now = new Date()) {
  const cycle = payCycle(user?.salaryDay, now);
  return { ...computeStats(user, transactions, now, cycle), cycle };
}

// How to name the pay period in a sentence: "since 23 Oct" or "this month".
export function periodLabel(cycle) {
  return cycle.hasPayday
    ? `since ${cycle.start.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`
    : 'this month';
}

// Everything the Home screen says about reaching the next payday.
export function computePaydayPlan(user, transactions, now = new Date()) {
  const cycle = payCycle(user?.salaryDay, now);
  const stats = computeStats(user, transactions, now, cycle);
  const { left, dailySpend, daysLeft } = stats;
  const safePerDay = cycle.daysToGo > 0 ? Math.floor(left / cycle.daysToGo) : left;
  const shortDays = daysLeft === null ? 0 : Math.max(0, cycle.daysToGo - daysLeft);
  // Rounded up to the next ₦100, because advice to cut ₦1,089 reads as false precision.
  const cutPerDay = shortDays > 0 ? Math.ceil((dailySpend - safePerDay) / 100) * 100 : 0;
  const moneyIn = sumAmounts(transactions.filter(t => t.type === 'credit' && t.cat !== 'Savings' && inPeriod(t.date, cycle)));
  return { ...stats, cycle, safePerDay, shortDays, cutPerDay, moneyIn };
}
