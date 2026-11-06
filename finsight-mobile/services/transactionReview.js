import { parseTxDate } from './finance.js';

// ── Imported transactions that look wrong ─────────────────────────────────────
// Older imports read some adverts, failed payments and balance warnings as money
// moving. These rules find them so the user can remove them. Pure functions only.

const RULES = [
  {
    reason: 'Looks like an advert',
    pattern: new RegExp([
      String.raw`\b\d{1,3}\s?% ?off\b`, String.raw`\boff your next\b`, String.raw`\bget your code\b`,
      String.raw`\buse (?:the )?code\b`, String.raw`\bwith [a-z0-9-]+ code\b`, String.raw`\bpromo(?:tion)?\b`,
      String.raw`\bdiscounts?\b`, String.raw`\bcongratulations\b`, String.raw`\byou(?:'ve|’ve| have) unlocked\b`,
      String.raw`\bwin\b`, String.raw`\bbonus\b`, String.raw`\banniversary\b`, String.raw`\bdeals?\b`,
      String.raw`\bsale\b`, String.raw`\bwas\s*(?:₦|n|ngn)\s?[\d,]+.{0,12}\bnow\b`, String.raw`\binstead of\b`,
      String.raw`\bprice reduction\b`, String.raw`\byour cart\b`, String.raw`\bplace your (?:1st|first) order\b`,
      String.raw`\bclaim it\b`, String.raw`\bsign ?up reward\b`, String.raw`\bbrand day\b`,
      String.raw`\bdon'?t miss\b`, String.raw`\bmiss out\b`, String.raw`\bsteal\b`, String.raw`\bdial \*`,
      String.raw`\bloan has been approved\b`, String.raw`\bcomplete more tasks\b`, String.raw`\bsmartphone you love\b`,
      // Seen in captured notifications: price drops, upgrades and network offers.
      String.raw`\bbefore\s*(?:₦|n|ngn)\s?[\d,]+.{0,12}\bnow\b`, String.raw`\bbeen waiting for\b`,
      String.raw`\bwill expire\b`, String.raw`\bstay connected\b`, String.raw`(?:^|\s)get\s*(?:₦|n|ngn)\s?\d`,
      String.raw`\bshop now\b`, String.raw`\bbuy now\b`, String.raw`\blimited time\b`, String.raw`\bfree delivery\b`,
    ].join('|'), 'i'),
  },
  {
    reason: 'Looks like a payment that failed, so no money moved',
    pattern: /\binsufficient (?:balance|funds)\b|\b(?:transaction|payment|transfer|debit)\s+(?:has\s+)?(?:failed|declined|was unsuccessful)\b|\bcould not be completed\b|\bunsuccessful\b/i,
  },
  {
    reason: 'Looks like a balance warning, not a payment',
    pattern: /\b(?:balance|bal)\s+(?:is\s+)?(?:low|less than|below)\b|\bless than\s*(?:₦|n|ngn)?\s*\d|\blow balance\b|\btop up now\b/i,
  },
];

// For importers: whether a message is an advert, a failed payment or a balance
// warning rather than money moving.
export function noiseReason(text) {
  const rule = RULES.find(r => r.pattern.test(String(text || '')));
  return rule ? rule.reason : null;
}

// A description that's only a number, like "480" or "₦269", means the message was
// misread: the amount usually came from an advert's price.
const NUMBER_ONLY = /^[\s₦n,.\d]*$/i;

// Only imported transactions are checked: anything the user typed is theirs.
export function suspectReason(tx) {
  if (!tx || tx.source === 'manual' || tx.reviewedOk) return null;
  const text = `${tx.desc || ''} ${tx.raw || ''}`;
  const rule = RULES.find(r => r.pattern.test(text));
  if (rule) return rule.reason;
  if (NUMBER_ONLY.test(tx.desc || '')) return "Couldn't read what this was, so the amount may be wrong";
  return null;
}

// Money that came in but was saved as spending: interest, refunds, credits.
const MONEY_IN = /\binterest (?:earned|paid|credited)\b|\b(?:has been|was|been) credited\b|\bcredited to your\b|\byou(?:'ve| have)? received\b|\bcashback\b|\brefund(?:ed)?\b|\breversal\b|\breversed\b/i;
// What savings look like, so a credit tagged Savings without any of it stands out.
const SAVINGS_WORDS = /sav(?:e|ing|ings)|cashbox|piggy|cowry|vault|target|owealth|fixed deposit|lock|stash/i;

// A wrong direction or category is fixed rather than removed: the money was real.
export function suspectFix(tx) {
  if (!tx || tx.source === 'manual' || tx.reviewedOk) return null;
  const text = `${tx.desc || ''} ${tx.raw || ''}`;
  if (tx.type === 'debit' && MONEY_IN.test(text)) {
    return { reason: 'Looks like money in, saved as money out', changes: { type: 'credit', cat: 'Income' }, change: 'Change to money in, under Income' };
  }
  if (tx.type === 'credit' && tx.cat === 'Savings' && !SAVINGS_WORDS.test(text)) {
    return { reason: "Looks like a payment to you, not savings", changes: { cat: 'Income' }, change: 'Change the category to Income' };
  }
  return null;
}

// Which copy of a payment to keep when it was recorded twice: what the user typed,
// then the bank alert, then the pasted SMS, then the statement.
const KEEP_ORDER = ['manual', 'push', 'sms', 'import'];
const rank = tx => {
  const i = KEEP_ORDER.indexOf(tx.source);
  return i === -1 ? KEEP_ORDER.length : i;
};
const DAY_MS = 86400000;

// The same payment recorded from two sources, such as a bank alert and the same
// line in a statement: same amount and direction, at most a day apart. Two from the
// same source are left alone, because they can really be two identical payments.
// Returns a map of the extra copy's id to the copy kept.
export function findDuplicates(transactions) {
  const pending = transactions
    .filter(tx => !tx.reviewedOk && tx.amount > 0)
    .map(tx => ({ tx, day: parseTxDate(tx.date)?.getTime() }))
    .filter(item => item.day !== undefined)
    .sort((a, b) => rank(a.tx) - rank(b.tx));
  const used = new Set();
  const extras = new Map();
  for (const keep of pending) {
    if (used.has(keep.tx.id)) continue;
    for (const other of pending) {
      if (other === keep || used.has(other.tx.id) || other.tx.source === keep.tx.source) continue;
      if (rank(other.tx) <= rank(keep.tx)) continue;
      if (other.tx.amount !== keep.tx.amount || other.tx.type !== keep.tx.type) continue;
      if (Math.abs(other.day - keep.day) > DAY_MS) continue;
      used.add(keep.tx.id);
      used.add(other.tx.id);
      extras.set(other.tx.id, keep.tx);
      break;
    }
  }
  return extras;
}

// Things to remove come first; only a transaction that isn't junk is checked for a fix.
export function suspectTransactions(transactions) {
  const duplicates = findDuplicates(transactions);
  return transactions
    .map(tx => {
      const reason = suspectReason(tx);
      if (reason) return { tx, reason, action: 'remove' };
      const kept = duplicates.get(tx.id);
      if (kept) return { tx, reason: `Looks like a second copy of "${kept.desc}"`, action: 'remove' };
      const fix = suspectFix(tx);
      return fix ? { tx, reason: fix.reason, action: 'fix', changes: fix.changes, change: fix.change } : null;
    })
    .filter(Boolean);
}

// Removes and fixes the chosen ones, and remembers the rest were checked, so
// they aren't flagged again.
export function applyReview(transactions, removeIds, keepIds, fixes = {}) {
  const remove = new Set(removeIds);
  const keep = new Set(keepIds);
  return transactions
    .filter(tx => !remove.has(tx.id))
    .map(tx => {
      if (fixes[tx.id]) return { ...tx, ...fixes[tx.id], reviewedOk: true };
      return keep.has(tx.id) ? { ...tx, reviewedOk: true } : tx;
    });
}
