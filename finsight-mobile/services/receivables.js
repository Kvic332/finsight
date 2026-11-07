// ── Money owed to you ─────────────────────────────────────────────────────────
// Customers who bought on credit. A payment received is recorded as a sale when
// it arrives, so profit counts money when it actually comes in. Pure functions.
import { parseDueDate } from './debts.js';

export const OWED_KEY = 'finsight_owed_to_me';
const REMINDER_HOUR = 9;
// On the due day, then twice more while it's still unpaid.
export const FOLLOW_UP_DAYS = [0, 3, 7];

const round = n => Math.round(n * 100) / 100;
const naira = n => `₦${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
export const remaining = entry => round(Math.max(0, (entry.amount || 0) - (entry.received || 0)));
export const openOwed = list => list.filter(e => remaining(e) > 0);

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function daysOverdue(entry, now = new Date()) {
  const due = parseDueDate(entry.dueDate);
  if (!due || remaining(entry) <= 0) return null;
  return Math.round((startOfDay(now) - due) / 86400000);
}

export function owedStatus(entry, now = new Date()) {
  if (remaining(entry) <= 0) return { label: 'Paid', tone: 'positive' };
  const late = daysOverdue(entry, now);
  if (late === null) return null;
  if (late > 0) return { label: late === 1 ? '1 day late' : `${late} days late`, tone: 'negative' };
  if (late === 0) return { label: 'Due today', tone: 'warning' };
  return { label: -late === 1 ? 'Due tomorrow' : `Due in ${-late} days`, tone: 'neutral' };
}

export function owedSummary(list, now = new Date()) {
  const open = openOwed(list);
  return {
    total: round(open.reduce((s, e) => s + remaining(e), 0)),
    count: open.length,
    late: open.filter(e => (daysOverdue(e, now) ?? 0) > 0).length,
  };
}

export function validateOwed({ name, amount, dueDate }) {
  return {
    ...(String(name || '').trim() ? null : { name: 'Enter who owes you' }),
    ...(amount > 0 ? null : { amount: 'Enter the amount, like 25,000' }),
    ...(dueDate && !parseDueDate(dueDate) ? { dueDate: 'Use year-month-day, like 2026-11-30' } : null),
  };
}

const formatDate = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

// A payment from a customer: the entry goes down, and the money is a sale today.
export function receivePayment(list, id, amount, now = new Date()) {
  const entry = list.find(e => e.id === id);
  if (!entry) return { error: 'Not found' };
  const left = remaining(entry);
  if (!(amount > 0)) return { error: 'Enter the amount received, like 10,000' };
  if (amount > left) return { error: `They only owe ${naira(left)} more` };
  const updated = list.map(e => (e.id === id ? { ...e, received: round((e.received || 0) + amount) } : e));
  const tx = {
    id: `owed_${id}_${now.getTime()}`,
    desc: `Payment from ${entry.name}`,
    amount: Math.round(amount),
    type: 'credit',
    cat: 'Sales',
    source: 'manual',
    date: formatDate(now),
  };
  return { list: updated, tx };
}

export function followUpTimes(entry, now = new Date()) {
  const due = parseDueDate(entry.dueDate);
  if (!due || remaining(entry) <= 0) return [];
  return FOLLOW_UP_DAYS
    .map(after => ({ after, at: new Date(due.getFullYear(), due.getMonth(), due.getDate() + after, REMINDER_HOUR) }))
    .filter(r => r.at > now);
}

export function followUpBody(entry, after) {
  const amount = naira(remaining(entry));
  if (after === 0) return `${entry.name} is due to pay you ${amount} today.`;
  return `${entry.name} still owes you ${amount}, ${after} days after it was due.`;
}

// For the tax set-aside: a share of this month's profit, never of a loss.
export function taxSetAside(profit, percent) {
  if (!(percent > 0) || !(profit > 0)) return 0;
  return Math.round((profit * percent) / 100);
}
