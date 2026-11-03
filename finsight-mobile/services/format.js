// ── Display formatting ────────────────────────────────────────────────────────
// Grouping is done by hand because number locale data differs between Android
// devices, and an amount must never look different from one phone to another.

const NAIRA = '₦';
const MINUS = '−';
const NO_VALUE = '—';

function group(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// showSign adds + to positive amounts, for money coming in. Rounds to whole
// naira unless kobo is true.
export function formatMoney(value, { kobo = false, showSign = false } = {}) {
  if (!isNumber(value)) return NO_VALUE;
  const fixed = Math.abs(value).toFixed(kobo ? 2 : 0);
  const [whole, fraction] = fixed.split('.');
  const isZero = Number(fixed) === 0;
  const sign = !isZero && value < 0 ? MINUS : !isZero && showSign ? '+' : '';
  return `${sign}${NAIRA}${group(whole)}${fraction ? `.${fraction}` : ''}`;
}

// For tight spaces only, such as chart labels. Main figures use formatMoney.
export function formatMoneyCompact(value) {
  if (!isNumber(value)) return NO_VALUE;
  const abs = Math.abs(value);
  const sign = value < 0 && Math.round(abs) > 0 ? MINUS : '';
  const short = (n, suffix) => `${sign}${NAIRA}${String(Number(n.toFixed(1)))}${suffix}`;
  // Round first, so 999,950 becomes ₦1M rather than ₦1000K.
  if (abs >= 999950) return short(abs / 1000000, 'M');
  if (abs >= 1000) return short(abs / 1000, 'K');
  return `${sign}${NAIRA}${Math.round(abs)}`;
}

export function formatPercent(value, { decimals = 0 } = {}) {
  if (!isNumber(value)) return NO_VALUE;
  return `${value.toFixed(decimals)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDayLabel(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return NO_VALUE;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

// How long ago a rate or balance was updated.
export function formatAge(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return NO_VALUE;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDayLabel(date, now);
}

// Reads what someone typed in an amount box. Returns whole naira, or null if it
// isn't a positive amount.
export function parseAmount(text) {
  const cleaned = String(text ?? '').replace(/[₦,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const amount = Math.round(Number(cleaned));
  return amount > 0 ? amount : null;
}
