// ── Remembered categories ─────────────────────────────────────────────────────
// When someone corrects a transaction's category, FinSight remembers it for that
// payee and uses it for later imports. Pure functions only, so they can be tested.

// Banking words that say how money moved, not who it went to.
const NOISE = new Set([
  'trf', 'tf', 'transfer', 'transferred', 'to', 'from', 'nip', 'fip', 'pos', 'web', 'payment', 'purchase',
  'for', 'the', 'via', 'on', 'at', 'of', 'ref', 'mob', 'mobile', 'ussd', 'ng', 'ngn', 'n', 'alert', 'onb',
  'debit', 'credit', 'dr', 'cr', 'card', 'txn', 'trx', 'and', 'by', 'a', 'acct', 'account', 'bank',
]);

// A short, stable name for who was paid: "ONB TRF TO SLOT SYSTEMS 1234" and
// "Slot Systems POS" both give "slot systems". Null when nothing is left.
export function payeeKey(desc) {
  const words = String(desc || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !NOISE.has(w));
  return words.length ? words.slice(0, 3).join(' ') : null;
}

export function learnPayeeRule(rules, desc, cat) {
  const key = payeeKey(desc);
  return key && cat ? { ...rules, [key]: cat } : rules;
}

// Gives imported transactions the category the user chose before for that payee.
// Anything typed by hand is left as the user entered it.
export function applyPayeeRules(transactions, rules) {
  if (!rules || !Object.keys(rules).length) return transactions;
  return transactions.map(tx => {
    if (tx.source === 'manual') return tx;
    const cat = rules[payeeKey(tx.desc)];
    return cat && cat !== tx.cat ? { ...tx, cat, ruleApplied: true } : tx;
  });
}
