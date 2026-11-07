// ── Categories ────────────────────────────────────────────────────────────────
// A transaction belongs to the business when its category is a business one, so
// remembered payees and bank alerts sort business from personal without an extra
// field. No imports, so any service can use it.

export const BUSINESS_IN = ['Sales', 'Other business income'];
export const BUSINESS_OUT = [
  'Stock', 'Shop rent', 'Staff', 'Delivery', 'Business bills', 'POS charges', 'Levies & tax', 'Other business', 'Owner pay',
];
export const OWNER_PAY = 'Owner pay';
// Money moved between your own accounts: neither spending nor income.
export const OWN_ACCOUNTS = 'Between my accounts';

const BUSINESS = new Set([...BUSINESS_IN, ...BUSINESS_OUT]);
export const isBusinessTx = tx => BUSINESS.has(tx?.cat);
export const personalOnly = transactions => transactions.filter(t => !isBusinessTx(t));

// Personal categories, as the Add and review screens offer them.
export const PERSONAL_OUT = ['Food', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Savings', 'Debt', 'Transfer', 'Other'];
export const PERSONAL_IN = ['Income', 'Savings', 'Transfer', 'Other'];
