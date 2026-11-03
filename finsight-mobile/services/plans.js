// ── Budgets and savings goals ─────────────────────────────────────────────────
// Pure functions only, so they can be unit tested.
import { isSameMonth } from './finance.js';

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

// A budget counts this month's debits in its category, plus any whose description
// contains one of its keywords, such as "netflix".
export function budgetSpent(budget, transactions, now = new Date()) {
  const category = (budget.cat || '').toLowerCase();
  const keywords = (budget.keywords || [])
    .map(k => (k || '').trim().toLowerCase())
    .filter(k => k.length >= 2);
  return transactions
    .filter(tx => {
      if (tx.type !== 'debit' || !isSameMonth(tx.date, now)) return false;
      if ((tx.cat || '').toLowerCase() === category) return true;
      const desc = (tx.desc || '').toLowerCase();
      return keywords.some(k => desc.includes(k));
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
    const name = isObject ? item.name || 'Goal' : String(item);
    return {
      id: (isObject && item.id) || `goal-${name}`,
      name,
      target: (isObject && Number(item.target)) || DEFAULT_TARGETS[name] || FALLBACK_TARGET,
      saved: (isObject && Number(item.saved)) || 0,
    };
  });
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
