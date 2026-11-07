// ── Business money ────────────────────────────────────────────────────────────
// Business money stays out of personal figures; paying yourself moves money from
// the business to the personal side. Pure functions only.
import { isBusinessTx, OWNER_PAY } from './categories.js';
import { parseTxDate } from './finance.js';

export {
  BUSINESS_IN, BUSINESS_OUT, isBusinessTx, OWN_ACCOUNTS, OWNER_PAY, personalOnly,
} from './categories.js';

// Whether this person has a business side at all.
export const hasBusiness = user => user?.usage === 'business' || user?.usage === 'both';

const sum = list => list.reduce((s, t) => s + (t.amount || 0), 0);
const inRange = (tx, start, end) => {
  const d = parseTxDate(tx.date);
  return !!d && d >= start && d < end;
};

// Sales, costs and profit for a range. Paying yourself isn't a cost of the
// business: it's what you took out of the profit.
export function businessFigures(transactions, start, end) {
  const txs = transactions.filter(t => isBusinessTx(t) && inRange(t, start, end));
  const sales = sum(txs.filter(t => t.type === 'credit' && t.cat === 'Sales'));
  const otherIn = sum(txs.filter(t => t.type === 'credit' && t.cat !== 'Sales'));
  const costTxs = txs.filter(t => t.type === 'debit' && t.cat !== OWNER_PAY);
  const costs = sum(costTxs);
  const ownerPay = sum(txs.filter(t => t.type === 'debit' && t.cat === OWNER_PAY));
  const byCost = {};
  costTxs.forEach(t => { byCost[t.cat] = (byCost[t.cat] || 0) + t.amount; });
  const profit = sales + otherIn - costs;
  return {
    sales, otherIn, costs, profit, ownerPay,
    kept: profit - ownerPay,
    margin: sales > 0 ? Math.round((profit / sales) * 100) : null,
    byCost: Object.entries(byCost).sort((a, b) => b[1] - a[1]),
    count: txs.length,
  };
}

// This month so far, last month in full, and the change in profit.
export function businessMonth(transactions, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = businessFigures(transactions, start, end);
  const last = businessFigures(transactions, lastStart, start);
  return { ...month, last, hasLast: last.count > 0 };
}

const formatDate = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

// Paying yourself: money out of the business, and the same money into your
// personal side as income, so the payday plan and budgets work as for a salary.
export function payYourselfTransactions(amount, now = new Date()) {
  if (!(amount > 0)) return null;
  const stamp = now.getTime();
  const date = formatDate(now);
  return [
    { id: `pay_b_${stamp}`, desc: 'Paid myself', amount: Math.round(amount), type: 'debit', cat: OWNER_PAY, source: 'manual', date },
    { id: `pay_p_${stamp}`, desc: 'Pay from my business', amount: Math.round(amount), type: 'credit', cat: 'Income', source: 'manual', date },
  ];
}
