// ── Budgets and savings goals ─────────────────────────────────────────────────
// Pure functions only, so they can be unit tested.
import { isSameMonth, parseTxDate } from './finance.js';

const DEFAULT_TARGETS = {
  'Emergency Fund': 500000,
  'New Laptop': 350000,
  Travel: 200000,
  House: 5000000,
  Car: 2000000,
  Business: 1000000,
  Wedding: 1500000,
  Education: 800000,
};
const FALLBACK_TARGET = 500000;

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// When a one-off budget starts counting: its start date, or the first day of the
// month it was made. Budgets from older versions have neither, and counting all
// their history would sweep in old purchases, so they start this month.
export function budgetStart(budget, now = new Date()) {
  const raw = budget.startDate || (budget.createdMonth ? `${budget.createdMonth}-01` : '');
  return parseTxDate(raw) || new Date(now.getFullYear(), now.getMonth(), 1);
}

// A monthly budget counts this month's debits in its category, plus any whose
// description contains one of its keywords, such as "netflix", or the budget's own
// name as a whole word, so a "Laptop" budget counts "Laptop from Slot" whatever its
// category. A one-off budget, such as a laptop, counts from its start with no monthly
// reset, and only by name and keywords: its category would sweep in unrelated spending.
// A monthly budget counts the pay period it's given ({ start, end }), so it agrees
// with Home and Activity, or the calendar month when none is given.
export function budgetSpent(budget, transactions, now = new Date(), period = null) {
  const start = budget.oneOff ? budgetStart(budget, now) : null;
  const inRange = date => {
    if (!budget.oneOff && period) {
      const day = parseTxDate(date);
      return !!day && day >= period.start && day < period.end;
    }
    if (!budget.oneOff) return isSameMonth(date, now);
    const day = parseTxDate(date);
    return !!day && day >= start;
  };
  const category = budget.oneOff ? null : (budget.cat || '').toLowerCase();
  const keywords = (budget.keywords || [])
    .map(k => (k || '').trim().toLowerCase())
    .filter(k => k.length >= 2);
  const name = (budget.name || '').trim().toLowerCase();
  // Not \b, which fails beside symbols such as the bracket in "Data (MTN)".
  const nameWord = name.length >= 3 ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}($|[^a-z0-9])`) : null;
  return transactions
    .filter(tx => {
      if (tx.type !== 'debit' || !inRange(tx.date)) return false;
      if (category !== null && (tx.cat || '').toLowerCase() === category) return true;
      const desc = (tx.desc || '').toLowerCase();
      return keywords.some(k => desc.includes(k)) || !!nameWord?.test(desc);
    })
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
}

export function budgetStatus(spent, limit) {
  const used = limit > 0 ? spent / limit : 0;
  return {
    used,
    percent: Math.round(used * 100),
    left: limit - spent,
    tone: used > 1 ? 'negative' : used >= 0.8 ? 'warning' : 'accent',
  };
}

// Goals used to be saved as plain names, so older profiles may still hold strings.
export function normalizeGoals(raw) {
  return (raw || []).map(item => {
    const isObject = item && typeof item === 'object';
    const name = (isObject ? item.name || 'Goal' : String(item)).trim() || 'Goal';
    return {
      id: (isObject && item.id) || `goal-${name}`,
      name,
      target: (isObject && Number(item.target)) || DEFAULT_TARGETS[name] || FALLBACK_TARGET,
      saved: (isObject && Number(item.saved)) || 0,
    };
  });
}

// Saved money not yet counted in any goal, such as savings picked up from bank
// alerts or statements. Money added with "Add money" is in both totals, so it
// cancels out and is never counted twice.
export function unassignedSavings(totalSaved, goals) {
  const inGoals = goals.reduce((sum, g) => sum + (g.saved || 0), 0);
  return Math.max(0, Math.round(totalSaved - inGoals));
}

export function addToGoal(goals, id, amount) {
  return goals.map(g => (g.id === id ? { ...g, saved: g.saved + amount } : g));
}

export function updateGoal(goals, id, changes) {
  return goals.map(g => (g.id === id ? { ...g, ...changes } : g));
}

export function goalProgress(goal) {
  const used = goal.target > 0 ? goal.saved / goal.target : 0;
  return {
    used: Math.min(1, used),
    percent: Math.min(100, Math.floor(used * 100)),
    toGo: Math.max(0, goal.target - goal.saved),
    done: goal.saved >= goal.target,
  };
}
