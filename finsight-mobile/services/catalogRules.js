// What makes a catalogue product appear in the app. The compare_listings view in
// Supabase is what really decides. This only explains why something is hidden,
// so keep the two in step.

export const CATEGORIES = [
  { value: 'loan', label: 'Loan' },
  { value: 'savings', label: 'Savings' },
  { value: 'fund', label: 'Fund' },
  { value: 'fx', label: 'FX' },
];

export const REGULATORS_BY_CATEGORY = {
  loan: ['FCCPC', 'CBN'],
  savings: ['CBN'],
  fund: ['SEC'],
  fx: ['CBN'],
};

export const REGULATORS = ['CBN', 'FCCPC', 'SEC'];

export const RATE_PERIODS = [
  { value: 'annual', label: 'Year', suffix: 'a year' },
  { value: 'monthly', label: 'Month', suffix: 'a month' },
  { value: 'daily', label: 'Day', suffix: 'a day' },
  { value: 'per_term', label: 'Term', suffix: 'per term' },
];

export const CHECK_STATUSES = [
  { value: 'verified', label: 'Verified' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'not_found', label: 'Not found' },
];

// The check that counts for each regulator. On a tie, the one that isn't
// verified wins, the same as the database.
export function latestChecks(checks) {
  const latest = {};
  for (const check of checks) {
    const current = latest[check.regulator];
    const time = new Date(check.checked_at).getTime();
    const currentTime = current ? new Date(current.checked_at).getTime() : -Infinity;
    if (time > currentTime || (time === currentTime && current.status === 'verified' && check.status !== 'verified')) {
      latest[check.regulator] = check;
    }
  }
  return latest;
}

export function isCurrentLicence(check, now = new Date()) {
  return !!check && check.status === 'verified' && (!check.expires_at || new Date(check.expires_at) > now);
}

export function currentRegulators(checks, now = new Date()) {
  return Object.values(latestChecks(checks))
    .filter(check => isCurrentLicence(check, now))
    .map(check => check.regulator)
    .sort();
}

export function listingBlockers({ provider, product, rate, checks }, now = new Date()) {
  const blockers = [];
  if (provider.status !== 'published') blockers.push("The provider isn't published");
  if (product.status !== 'published') blockers.push("This product isn't published");
  if (!rate) blockers.push('It needs a rate');
  const needed = REGULATORS_BY_CATEGORY[product.category] || [];
  const held = currentRegulators(checks, now);
  if (!needed.some(regulator => held.includes(regulator))) {
    blockers.push(`The provider needs a current ${needed.join(' or ')} licence`);
  }
  return blockers;
}

export function describeRate(rate) {
  if (!rate) return 'No rate yet';
  if (rate.rate_min_pct === null || rate.rate_min_pct === undefined) {
    const sides = [];
    if (rate.buy_rate) sides.push(`Buy ₦${Number(rate.buy_rate).toLocaleString('en-NG')}`);
    if (rate.sell_rate) sides.push(`Sell ₦${Number(rate.sell_rate).toLocaleString('en-NG')}`);
    return sides.join(' · ');
  }
  const period = RATE_PERIODS.find(p => p.value === rate.rate_period);
  const hasRange = rate.rate_max_pct !== null && rate.rate_max_pct !== undefined && rate.rate_max_pct !== rate.rate_min_pct;
  const value = hasRange ? `${rate.rate_min_pct}% to ${rate.rate_max_pct}%` : `${rate.rate_min_pct}%`;
  return period ? `${value} ${period.suffix}` : value;
}

// Blank is null. Anything that isn't a clean number is NaN, so a form can tell
// a typing mistake apart from a field left empty.
export function parseNumber(text) {
  const clean = String(text ?? '').replace(/,/g, '').trim();
  if (!clean) return null;
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN;
}

export function todayInLagos(now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function shortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos',
  });
}

export function hostOf(url) {
  return String(url || '').replace(/^https:\/\//, '').split('/')[0];
}
