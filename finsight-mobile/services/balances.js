// ── Balances the banks reported ───────────────────────────────────────────────
// Pure functions only, so they can be unit tested.

// Older than this, a reported balance says little about today.
export const BALANCE_FRESH_DAYS = 14;

// The latest balance each bank reported in its alerts, newest first.
export function latestBalances(transactions, now = Date.now()) {
  const byBank = new Map();
  for (const tx of transactions) {
    if (typeof tx.balance !== 'number' || !tx.bank || typeof tx.capturedAt !== 'number') continue;
    // A balance in dollars isn't naira; foreign accounts are shown on their own.
    if (tx.currency && tx.currency !== 'NGN') continue;
    if (now - tx.capturedAt > BALANCE_FRESH_DAYS * 86400000) continue;
    const seen = byBank.get(tx.bank);
    if (!seen || tx.capturedAt > seen.capturedAt) byBank.set(tx.bank, { bank: tx.bank, balance: tx.balance, capturedAt: tx.capturedAt });
  }
  return [...byBank.values()].sort((a, b) => b.capturedAt - a.capturedAt);
}
