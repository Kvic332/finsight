// Sorting, filtering and wording for Compare and Grow. Nothing here reads
// is_referral except to disclose it, because payment must never affect the order.
import { formatMoney } from './format.js';
import { RATE_PERIODS } from './catalogRules.js';

export const TABS = [
  { value: 'loan', label: 'Loans' },
  { value: 'savings', label: 'Savings' },
  { value: 'fund', label: 'Funds' },
];

export const MAX_COMPARE = 3;
const STALE_AFTER_DAYS = 30;

export const TERMS = [
  { value: 'month', label: 'Up to 30 days', min: 0, max: 30 },
  { value: 'quarter', label: '31 to 90 days', min: 31, max: 90 },
  { value: 'year', label: '91 to 365 days', min: 91, max: 365 },
  { value: 'long', label: 'Over a year', min: 366, max: Infinity },
];

export function sortOptions(category) {
  return category === 'loan'
    ? [
      { value: 'rate', label: 'Lowest rate' },
      { value: 'amount', label: 'Highest amount' },
      { value: 'updated', label: 'Recently checked' },
    ]
    : [
      { value: 'rate', label: 'Highest rate' },
      { value: 'updated', label: 'Recently checked' },
    ];
}

const hasValue = value => value !== null && value !== undefined;

function byName(a, b) {
  return a.provider_name.localeCompare(b.provider_name) || a.product_name.localeCompare(b.product_name);
}

// Missing values go last whichever way the list runs.
function compareValues(a, b, direction) {
  if (!hasValue(a) && !hasValue(b)) return 0;
  if (!hasValue(a)) return 1;
  if (!hasValue(b)) return -1;
  return direction * (a - b);
}

export function sortListings(listings, category, sort = 'rate') {
  const keyed = (key, direction) => (a, b) => compareValues(key(a), key(b), direction) || byName(a, b);
  const comparators = {
    // Borrowers want the lowest starting rate, and savers the highest rate on offer.
    rate: category === 'loan' ? keyed(l => l.annual_min_pct, 1) : keyed(l => l.annual_max_pct, -1),
    amount: keyed(l => l.max_amount, -1),
    updated: keyed(l => new Date(l.rate_checked_at).getTime(), -1),
  };
  return [...listings].sort(comparators[sort] || comparators.rate);
}

function overlaps(listing, term) {
  const { min_tenor_days: min, max_tenor_days: max } = listing;
  if (!hasValue(min) && !hasValue(max)) return true;
  return (hasValue(max) ? max : Infinity) >= term.min && (hasValue(min) ? min : 0) <= term.max;
}

function allowsAmount(listing, amount) {
  // The amount is typed in naira, so it can't be measured against a dollar product.
  if (listing.currency !== 'NGN') return false;
  return (!hasValue(listing.min_amount) || amount >= listing.min_amount)
    && (!hasValue(listing.max_amount) || amount <= listing.max_amount);
}

export function filterListings(listings, { amount, term, regulator } = {}) {
  const termOption = TERMS.find(t => t.value === term);
  return listings.filter(listing => (!amount || allowsAmount(listing, amount))
    && (!termOption || overlaps(listing, termOption))
    && (!regulator || listing.badges.some(b => b.regulator === regulator)));
}

export function regulatorsIn(listings) {
  return [...new Set(listings.flatMap(l => l.badges.map(b => b.regulator)))].sort();
}

export function isStale(checkedAt, now = new Date()) {
  return now.getTime() - new Date(checkedAt).getTime() > STALE_AFTER_DAYS * 86400000;
}

function money(value, currency) {
  return currency === 'NGN' ? formatMoney(value) : formatMoney(value).replace('₦', `${currency} `);
}

export function amountRange({ min_amount: min, max_amount: max, currency }) {
  if (hasValue(min) && hasValue(max)) return `${money(min, currency)} to ${money(max, currency)}`;
  if (hasValue(max)) return `Up to ${money(max, currency)}`;
  if (hasValue(min)) return `From ${money(min, currency)}`;
  return null;
}

export function termRange({ min_tenor_days: min, max_tenor_days: max }) {
  const days = n => `${n} ${n === 1 ? 'day' : 'days'}`;
  if (hasValue(min) && hasValue(max)) return min === max ? days(max) : `${min} to ${days(max)}`;
  if (hasValue(max)) return `Up to ${days(max)}`;
  if (hasValue(min)) return `From ${days(min)}`;
  return null;
}

const periodSuffix = value => RATE_PERIODS.find(p => p.value === value)?.suffix || '';

// The number on the card, worded so a range never reads as a promise.
export function headlineRate(listing) {
  const { category, rate_min_pct: min, rate_max_pct: max, rate_period: period } = listing;
  const isRange = hasValue(max) && max !== min;
  if (!isRange) return `${min}% ${periodSuffix(period)}`;
  return category === 'loan' ? `From ${min}% ${periodSuffix(period)}` : `Up to ${max}% ${periodSuffix(period)}`;
}

const trimmed = value => String(Number(Number(value).toFixed(2)));

// So rates quoted monthly and yearly can be read side by side.
export function annualNote({ rate_period: period, annual_min_pct: min, annual_max_pct: max }) {
  if (period === 'annual') return null;
  if (!hasValue(min)) return "Can't be shown per year, as it depends on the term";
  return min === max
    ? `About ${trimmed(min)}% a year, before compounding`
    : `About ${trimmed(min)}% to ${trimmed(max)}% a year, before compounding`;
}

export function toggleCompare(selected, id) {
  if (selected.includes(id)) return { selected: selected.filter(s => s !== id), full: false };
  if (selected.length >= MAX_COMPARE) return { selected, full: true };
  return { selected: [...selected, id], full: false };
}
