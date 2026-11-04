import test from 'node:test';
import assert from 'node:assert/strict';
import {
  amountRange, annualNote, filterListings, headlineRate, inflationCheck, inflationMonth, isInflationCurrent, isStale,
  MAX_COMPARE, regulatorsIn, sortListings, sortOptions, termRange, toggleCompare,
} from '../services/compareRules.js';

function listing(over = {}) {
  return {
    product_id: over.provider_name || 'p',
    category: 'loan',
    provider_name: 'Provider',
    product_name: 'Product',
    currency: 'NGN',
    min_amount: null,
    max_amount: null,
    min_tenor_days: null,
    max_tenor_days: null,
    rate_min_pct: 4,
    rate_max_pct: null,
    rate_period: 'monthly',
    annual_min_pct: 48,
    annual_max_pct: 48,
    rate_checked_at: '2026-11-01T00:00:00Z',
    is_referral: false,
    badges: [{ regulator: 'FCCPC' }],
    ...over,
  };
}

const names = list => list.map(l => l.provider_name);

// ── Sorting ───────────────────────────────────────────────────────────────────
test('loans put the lowest starting rate first', () => {
  const list = [
    listing({ provider_name: 'High', annual_min_pct: 120, annual_max_pct: 120 }),
    listing({ provider_name: 'Low', annual_min_pct: 30, annual_max_pct: 200 }),
  ];
  assert.deepEqual(names(sortListings(list, 'loan')), ['Low', 'High']);
});

test('savings and funds put the highest rate first', () => {
  const list = [
    listing({ provider_name: 'Low', annual_min_pct: 5, annual_max_pct: 10 }),
    listing({ provider_name: 'High', annual_min_pct: 1, annual_max_pct: 18 }),
  ];
  assert.deepEqual(names(sortListings(list, 'savings')), ['High', 'Low']);
  assert.deepEqual(names(sortListings(list, 'fund')), ['High', 'Low']);
});

test('a referral link never changes the order', () => {
  const plain = [
    listing({ provider_name: 'Better', annual_min_pct: 10 }),
    listing({ provider_name: 'Worse', annual_min_pct: 90 }),
  ];
  const paid = [plain[0], { ...plain[1], is_referral: true }];
  assert.deepEqual(names(sortListings(paid, 'loan')), names(sortListings(plain, 'loan')));
  const tied = [
    listing({ provider_name: 'B', is_referral: true }),
    listing({ provider_name: 'A' }),
  ];
  assert.deepEqual(names(sortListings(tied, 'loan')), ['A', 'B']);
});

test('rates that cannot be annualised go last in both directions', () => {
  const list = [
    listing({ provider_name: 'Term', rate_period: 'per_term', annual_min_pct: null, annual_max_pct: null }),
    listing({ provider_name: 'Year', annual_min_pct: 200, annual_max_pct: 200 }),
  ];
  assert.deepEqual(names(sortListings(list, 'loan')), ['Year', 'Term']);
  assert.deepEqual(names(sortListings(list, 'savings')), ['Year', 'Term']);
});

test('other sorts work, with a stable order on ties', () => {
  const list = [
    listing({ provider_name: 'Small', max_amount: 1000, rate_checked_at: '2026-11-02T00:00:00Z' }),
    listing({ provider_name: 'Big', max_amount: 9000, rate_checked_at: '2026-10-01T00:00:00Z' }),
    listing({ provider_name: 'Unknown', rate_checked_at: '2026-10-01T00:00:00Z' }),
  ];
  assert.deepEqual(names(sortListings(list, 'loan', 'amount')), ['Big', 'Small', 'Unknown']);
  assert.deepEqual(names(sortListings(list, 'loan', 'updated')), ['Small', 'Big', 'Unknown']);
});

test('sorting leaves the original list alone', () => {
  const list = [listing({ provider_name: 'B' }), listing({ provider_name: 'A' })];
  sortListings(list, 'loan');
  assert.equal(list[0].provider_name, 'B');
});

test('only loans offer a sort by amount', () => {
  assert.ok(sortOptions('loan').some(o => o.value === 'amount'));
  assert.ok(!sortOptions('savings').some(o => o.value === 'amount'));
});

// ── Filtering ─────────────────────────────────────────────────────────────────
test('the amount must fit the product, and unknown limits pass', () => {
  const list = [
    listing({ provider_name: 'Fits', min_amount: 1000, max_amount: 5000 }),
    listing({ provider_name: 'TooSmall', max_amount: 1000 }),
    listing({ provider_name: 'TooBig', min_amount: 9000 }),
    listing({ provider_name: 'NoLimits' }),
  ];
  assert.deepEqual(names(filterListings(list, { amount: 3000 })), ['Fits', 'NoLimits']);
  assert.deepEqual(names(filterListings(list, { amount: 5000 })), ['Fits', 'NoLimits']);
});

test('a naira amount is not compared with a dollar product', () => {
  const list = [listing({ provider_name: 'Dollar', currency: 'USD', max_amount: 10000 })];
  assert.equal(filterListings(list, { amount: 3000 }).length, 0);
  assert.equal(filterListings(list, {}).length, 1);
});

test('terms match by overlap', () => {
  const list = [
    listing({ provider_name: 'Short', min_tenor_days: 7, max_tenor_days: 30 }),
    listing({ provider_name: 'Wide', min_tenor_days: 30, max_tenor_days: 365 }),
    listing({ provider_name: 'Long', min_tenor_days: 400 }),
    listing({ provider_name: 'Unstated' }),
  ];
  assert.deepEqual(names(filterListings(list, { term: 'month' })), ['Short', 'Wide', 'Unstated']);
  assert.deepEqual(names(filterListings(list, { term: 'quarter' })), ['Wide', 'Unstated']);
  assert.deepEqual(names(filterListings(list, { term: 'long' })), ['Long', 'Unstated']);
});

test('filters combine, and the regulator list has no repeats', () => {
  const list = [
    listing({ provider_name: 'Bank', badges: [{ regulator: 'CBN' }], max_amount: 5000 }),
    listing({ provider_name: 'App', badges: [{ regulator: 'FCCPC' }], max_amount: 5000 }),
    listing({ provider_name: 'Both', badges: [{ regulator: 'CBN' }, { regulator: 'FCCPC' }], max_amount: 100 }),
  ];
  assert.deepEqual(names(filterListings(list, { regulator: 'CBN' })), ['Bank', 'Both']);
  assert.deepEqual(names(filterListings(list, { regulator: 'CBN', amount: 1000 })), ['Bank']);
  assert.deepEqual(regulatorsIn(list), ['CBN', 'FCCPC']);
});

// ── Wording ───────────────────────────────────────────────────────────────────
test('a rate is flagged once it is over 30 days old', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  assert.equal(isStale('2026-10-05T12:00:00Z', now), false);
  assert.equal(isStale('2026-10-03T11:00:00Z', now), true);
});

test('amounts read naturally, in the right currency', () => {
  assert.equal(amountRange(listing({ min_amount: 5000, max_amount: 200000 })), '₦5,000 to ₦200,000');
  assert.equal(amountRange(listing({ max_amount: 200000 })), 'Up to ₦200,000');
  assert.equal(amountRange(listing({ min_amount: 5000 })), 'From ₦5,000');
  assert.equal(amountRange(listing({ min_amount: 0 })), 'From ₦0');
  assert.equal(amountRange(listing({ currency: 'USD', min_amount: 100 })), 'From USD 100');
  assert.equal(amountRange(listing()), null);
});

test('terms read naturally', () => {
  assert.equal(termRange(listing({ min_tenor_days: 14, max_tenor_days: 90 })), '14 to 90 days');
  assert.equal(termRange(listing({ min_tenor_days: 30, max_tenor_days: 30 })), '30 days');
  assert.equal(termRange(listing({ max_tenor_days: 1 })), 'Up to 1 day');
  assert.equal(termRange(listing({ min_tenor_days: 30 })), 'From 30 days');
  assert.equal(termRange(listing()), null);
});

test('a range is never shown as a promise', () => {
  assert.equal(headlineRate(listing({ rate_min_pct: 4, rate_max_pct: 10 })), 'From 4% a month');
  assert.equal(
    headlineRate(listing({ category: 'savings', rate_min_pct: 10, rate_max_pct: 18, rate_period: 'annual' })),
    'Up to 18% a year',
  );
  assert.equal(headlineRate(listing({ rate_min_pct: 4, rate_max_pct: 4 })), '4% a month');
  assert.equal(headlineRate(listing({ rate_min_pct: 0, rate_period: 'annual' })), '0% a year');
});

test('the yearly note appears only when it adds something', () => {
  assert.equal(annualNote(listing({ rate_period: 'annual' })), null);
  assert.match(annualNote(listing({ annual_min_pct: 48, annual_max_pct: 120 })), /48% to 120% a year/);
  assert.match(annualNote(listing()), /About 48% a year/);
  assert.match(annualNote(listing({ annual_min_pct: 12.345, annual_max_pct: 12.345 })), /12\.35%/);
  assert.match(annualNote(listing({ rate_period: 'per_term', annual_min_pct: null, annual_max_pct: null })), /depends on the term/);
});

// ── Inflation ─────────────────────────────────────────────────────────────────
const INFLATION = { month: '2026-09-01', headline_pct: 14.63, source_url: 'https://nbs.test' };
const NOV = new Date('2026-11-04T12:00:00Z');
const saving = (min, max, over = {}) => listing({ category: 'savings', annual_min_pct: min, annual_max_pct: max, ...over });

test('a rate above inflation says so, using real growth', () => {
  const result = inflationCheck(saving(20, 20), INFLATION, NOV);
  assert.equal(result.tone, 'positive');
  // 1.20 / 1.1463 is 4.7% real growth, where a simple subtraction would say 5.4%.
  assert.equal(result.label, 'Rate beats inflation by about 4.7%');
});

test('a rate below inflation says so plainly', () => {
  const result = inflationCheck(saving(12, 12), INFLATION, NOV);
  assert.equal(result.tone, 'warning');
  assert.equal(result.label, 'Rate is about 2.3% below inflation');
});

test('a range is judged on its top rate and worded that way', () => {
  assert.equal(inflationCheck(saving(0, 22), INFLATION, NOV).label, 'Top rate beats inflation by about 6.4%');
  assert.equal(inflationCheck(saving(5, 12), INFLATION, NOV).label, 'Top rate is about 2.3% below inflation');
});

test('a rate matching inflation is level', () => {
  const result = inflationCheck(saving(14.63, 14.63), INFLATION, NOV);
  assert.equal(result.tone, 'neutral');
  assert.equal(result.label, 'Rate is level with inflation');
});

test('funds are checked as well', () => {
  assert.ok(inflationCheck(saving(18, 18, { category: 'fund' }), INFLATION, NOV));
});

test('the detail names the figure, its month, its source and its limits', () => {
  const { detail } = inflationCheck(saving(20, 20), INFLATION, NOV);
  assert.match(detail, /14\.63% in September 2026/);
  assert.match(detail, /National Bureau of Statistics/);
  assert.match(detail, /before tax and fees/);
});

test('nothing is said where the comparison would mislead', () => {
  assert.equal(inflationCheck(listing(), INFLATION, NOV), null);
  assert.equal(inflationCheck(saving(6, 6, { currency: 'USD' }), INFLATION, NOV), null);
  assert.equal(inflationCheck(saving(null, null), INFLATION, NOV), null);
  assert.equal(inflationCheck(saving(20, 20), null, NOV), null);
});

test('an old inflation figure is not used', () => {
  assert.equal(isInflationCurrent(INFLATION, new Date('2026-12-29T00:00:00Z')), true);
  assert.equal(isInflationCurrent(INFLATION, new Date('2026-12-30T12:00:00Z')), false);
  assert.equal(inflationCheck(saving(20, 20), INFLATION, new Date('2027-02-01T00:00:00Z')), null);
});

test('months read naturally', () => {
  assert.equal(inflationMonth({ month: '2026-01-01' }), 'January 2026');
});

// ── Comparing ─────────────────────────────────────────────────────────────────
test('compare holds up to three and can be undone', () => {
  let state = { selected: [] };
  for (const id of ['a', 'b', 'c']) state = toggleCompare(state.selected, id);
  assert.equal(state.selected.length, MAX_COMPARE);
  const over = toggleCompare(state.selected, 'd');
  assert.equal(over.full, true);
  assert.deepEqual(over.selected, ['a', 'b', 'c']);
  assert.deepEqual(toggleCompare(state.selected, 'b').selected, ['a', 'c']);
});
