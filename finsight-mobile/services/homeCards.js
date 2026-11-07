// ── Home's swipeable cards ────────────────────────────────────────────────────
// Which top cards Home shows, and in what order. How someone uses FinSight picks
// the first card; nothing is hidden behind that setting. Pure, so it can be tested.
import { usageOf } from './usage.js';

const ORDER = {
  salary: ['personal', 'spending', 'business', 'foreign'],
  both: ['personal', 'business', 'spending', 'foreign'],
  business: ['business', 'personal', 'spending', 'foreign'],
  tracking: ['spending', 'business', 'foreign'],
};

// facts: { hasIncome, hasBusinessMoney, walletCount }
export function homeCards(user, facts = {}) {
  const usage = usageOf(user);
  const show = {
    // Left until payday needs an income: a salary, or pay from the business.
    personal: usage === 'salary' || usage === 'both' || (usage === 'business' && facts.hasIncome),
    business: usage === 'business' || usage === 'both' || !!facts.hasBusinessMoney,
    spending: true,
    foreign: (facts.walletCount || 0) > 0,
  };
  return ORDER[usage].filter(key => show[key]);
}

// The card to open on: the one last looked at, if it's still shown.
export function startingCard(cards, remembered) {
  return cards.includes(remembered) ? remembered : cards[0];
}
