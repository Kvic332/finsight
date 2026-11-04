import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentRegulators, describeRate, hostOf, isCurrentLicence, latestChecks, listingBlockers, parseNumber, todayInLagos,
} from '../services/catalogRules.js';

const NOW = new Date('2026-11-03T12:00:00Z');
const check = (regulator, status, checked_at, expires_at = null) => ({ regulator, status, checked_at, expires_at });

const published = {
  provider: { status: 'published' },
  product: { status: 'published', category: 'loan' },
  rate: { rate_min_pct: 4, rate_period: 'monthly' },
  checks: [check('FCCPC', 'verified', '2026-11-01T00:00:00Z')],
};

test('the newest check for a regulator counts', () => {
  const latest = latestChecks([
    check('CBN', 'revoked', '2026-11-02T00:00:00Z'),
    check('CBN', 'verified', '2026-11-01T00:00:00Z'),
    check('SEC', 'verified', '2026-10-01T00:00:00Z'),
  ]);
  assert.equal(latest.CBN.status, 'revoked');
  assert.equal(latest.SEC.status, 'verified');
});

test('on a tie, a check that is not verified wins, whatever the order', () => {
  const at = '2026-11-02T00:00:00Z';
  assert.equal(latestChecks([check('CBN', 'verified', at), check('CBN', 'revoked', at)]).CBN.status, 'revoked');
  assert.equal(latestChecks([check('CBN', 'revoked', at), check('CBN', 'verified', at)]).CBN.status, 'revoked');
});

test('an expired licence is not current', () => {
  assert.equal(isCurrentLicence(check('CBN', 'verified', '2026-01-01', '2026-11-01T00:00:00Z'), NOW), false);
  assert.equal(isCurrentLicence(check('CBN', 'verified', '2026-01-01', '2026-12-01T00:00:00Z'), NOW), true);
  assert.equal(isCurrentLicence(check('CBN', 'not_found', '2026-01-01'), NOW), false);
  assert.equal(isCurrentLicence(undefined, NOW), false);
});

test('current regulators leave out revoked licences', () => {
  assert.deepEqual(currentRegulators([
    check('SEC', 'verified', '2026-10-01T00:00:00Z'),
    check('CBN', 'verified', '2026-10-01T00:00:00Z'),
    check('FCCPC', 'verified', '2026-10-01T00:00:00Z'),
    check('FCCPC', 'revoked', '2026-10-02T00:00:00Z'),
  ], NOW), ['CBN', 'SEC']);
});

test('a complete product has no blockers', () => {
  assert.deepEqual(listingBlockers(published, NOW), []);
});

test('every missing piece is named', () => {
  const blockers = listingBlockers({
    provider: { status: 'draft' },
    product: { status: 'draft', category: 'savings' },
    rate: undefined,
    checks: [],
  }, NOW);
  assert.equal(blockers.length, 4);
  assert.match(blockers[3], /current CBN licence/);
});

test('only the regulator for the category counts', () => {
  const sec = [check('SEC', 'verified', '2026-11-01T00:00:00Z')];
  assert.match(listingBlockers({ ...published, checks: sec }, NOW)[0], /FCCPC or CBN/);
  const fund = { ...published, product: { status: 'published', category: 'fund' }, checks: sec };
  assert.deepEqual(listingBlockers(fund, NOW), []);
  const fx = { ...published, product: { status: 'published', category: 'fx' } };
  assert.match(listingBlockers(fx, NOW)[0], /CBN/);
});

test('a bank with only a CBN licence can list a loan', () => {
  const cbn = [check('CBN', 'verified', '2026-11-01T00:00:00Z')];
  assert.deepEqual(listingBlockers({ ...published, checks: cbn }, NOW), []);
});

test('rates are described plainly', () => {
  assert.equal(describeRate(undefined), 'No rate yet');
  assert.equal(describeRate({ rate_min_pct: 4, rate_max_pct: 10, rate_period: 'monthly' }), '4% to 10% a month');
  assert.equal(describeRate({ rate_min_pct: 12, rate_max_pct: 12, rate_period: 'annual' }), '12% a year');
  assert.equal(describeRate({ rate_min_pct: 0, rate_max_pct: null, rate_period: 'annual' }), '0% a year');
  assert.match(describeRate({ rate_min_pct: null, buy_rate: 1500, sell_rate: 1600 }), /^Buy ₦1,500 · Sell ₦1,600$/);
  assert.equal(describeRate({ rate_min_pct: null, buy_rate: null, sell_rate: 1600 }), 'Sell ₦1,600');
});

test('a provider that only publishes its top rate reads as "up to"', () => {
  assert.equal(describeRate({ rate_min_pct: 0, rate_max_pct: 16, rate_period: 'annual' }), 'Up to 16% a year');
  assert.equal(describeRate({ rate_min_pct: 0, rate_max_pct: null, rate_period: 'annual' }), '0% a year');
});

test('numbers are parsed strictly', () => {
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('  '), null);
  assert.equal(parseNumber('1,500,000'), 1500000);
  assert.equal(parseNumber('12.5'), 12.5);
  assert.equal(parseNumber('0'), 0);
  assert.ok(Number.isNaN(parseNumber('12%')));
  assert.ok(Number.isNaN(parseNumber('-3')));
});

test('today follows Lagos, not UTC', () => {
  assert.equal(todayInLagos(new Date('2026-11-03T23:30:00Z')), '2026-11-04');
  assert.equal(todayInLagos(new Date('2026-11-03T22:30:00Z')), '2026-11-03');
});

test('a source shows as its website name', () => {
  assert.equal(hostOf('https://www.cbn.gov.ng/supervision/list.html'), 'www.cbn.gov.ng');
});
