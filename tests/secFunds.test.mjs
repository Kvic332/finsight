import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, fundYields, latestReportLink, planFundUpdates } from '../supabase/functions/sec-fund-rates/handler.ts';

const PAGE = `
  <a href="/documents/1539/Net_Asset_Value_and_Unit_Price_as_at_16th_October_2026.xlsx">16 Oct</a>
  <a href="https://sec.gov.ng/documents/1540/Net_Asset_Value_and_Unit_Price_as_at_23rd_October_2026.XLSX">23 Oct</a>
  <a href="/documents/1533/Net_Asset_Value_and_Unit_Price_as_at_25th_September_2026.XLSX">25 Sep</a>`;

// Shaped like the SEC's "Weekly Valuation" sheet: last week's columns, then this week's.
const ROWS = [
  ['WEEKLY VALUATION REPORT OF COLLECTIVE INVESTMENT SCHEMES'],
  [null, null, null, 'Week Ended October 16, 2026', null, null, 'Week Ended October 23, 2026'],
  ['S/N', 'FUND', 'FUND MANAGER', 'NAV (N)', 'Yield (WTD)', 'Yield  (YTD)', 'NAV (N)', 'Yield (WTD)', 'Yield  (YTD)'],
  [null, 'MONEY MARKET FUNDS'],
  [36, 'Coronation Money Market Fund', 'Coronation Asset Management Limited', 1, 0.2003, 0.2003, 1, 0.2036, 0.2036],
  [28, 'ARM Money Market Fund', 'ARM Investment Managers Limited', 1, 0.1666, 0.1666, 1, 0.1653, 0.1653],
  [99, 'Odd Money Market Fund', 'Odd Ltd', 1, 0.17, 0.17, 1, 0.55, 0.55],
];

const fund = over => ({ productId: 'p1', name: 'Coronation Money Market Fund', currentPct: 20.03, checkedAt: '2026-10-16T11:00:00Z', ...over });

test('the newest report link is found, whatever the case of its extension', () => {
  assert.deepEqual(latestReportLink(PAGE), {
    url: 'https://sec.gov.ng/documents/1540/Net_Asset_Value_and_Unit_Price_as_at_23rd_October_2026.XLSX',
    date: '2026-10-23',
  });
  assert.equal(latestReportLink('<p>nothing here</p>'), null);
});

test("this week's yield is read, not last week's", () => {
  const yields = fundYields(ROWS);
  assert.equal(yields.get('coronation money market fund'), 20.36);
  assert.equal(yields.get('arm money market fund'), 16.53);
});

test('normal weekly changes are applied', () => {
  const [d] = planFundUpdates([fund()], fundYields(ROWS), '2026-10-23');
  assert.deepEqual(d, { productId: 'p1', name: 'Coronation Money Market Fund', status: 'apply', pct: 20.36 });
});

test('unusual figures wait for a person', () => {
  const yields = fundYields(ROWS);
  const [odd] = planFundUpdates([fund({ name: 'Odd Money Market Fund', currentPct: 17 })], yields, '2026-10-23');
  assert.equal(odd.status, 'held');
  assert.match(odd.reason, /outside/);
  const [jump] = planFundUpdates([fund({ currentPct: 15 })], yields, '2026-10-23');
  assert.equal(jump.status, 'held');
  assert.match(jump.reason, /Moved more than 3 points/);
});

test('funds missing from the report, or already up to date, are left alone', () => {
  const [missing] = planFundUpdates([fund({ name: 'Unknown Fund' })], fundYields(ROWS), '2026-10-23');
  assert.equal(missing.status, 'unmatched');
  const [current] = planFundUpdates([fund({ checkedAt: '2026-10-23T11:00:00Z' })], fundYields(ROWS), '2026-10-23');
  assert.equal(current.status, 'current');
});

function harness(funds) {
  const calls = { applied: [], logged: [] };
  const handler = createHandler({
    checkSecret: async candidate => candidate === 's3cret',
    fetchText: async () => PAGE,
    readReport: async () => ROWS,
    store: {
      listFunds: async () => funds,
      applyRate: async (...args) => { calls.applied.push(args); },
      logDecisions: async (...args) => { calls.logged.push(args); },
    },
    logError: () => {},
  });
  return { handler, calls };
}

const post = (secret = 's3cret') => new Request('https://x.test/sec-fund-rates', { method: 'POST', headers: { 'x-cron-secret': secret } });

test('only the scheduled job, holding the secret, can run it', async () => {
  const { handler, calls } = harness([fund()]);
  assert.equal((await handler(post('wrong'))).status, 401);
  assert.equal(calls.applied.length, 0);
});

test('a run applies the safe updates and logs every decision', async () => {
  const { handler, calls } = harness([fund(), fund({ productId: 'p2', name: 'Unknown Fund' })]);
  const res = await handler(post());
  assert.deepEqual(await res.json(), { report: '2026-10-23', applied: 1, held: 0, unmatched: 1 });
  assert.deepEqual(calls.applied, [['p1', 20.36, 'https://sec.gov.ng/documents/1540/Net_Asset_Value_and_Unit_Price_as_at_23rd_October_2026.XLSX', '2026-10-23']]);
  assert.equal(calls.logged[0][2].length, 2);
});

test('running again after an update does nothing', async () => {
  const { handler, calls } = harness([fund({ checkedAt: '2026-10-23T11:00:00Z' })]);
  const res = await handler(post());
  assert.equal((await res.json()).upToDate, true);
  assert.equal(calls.applied.length, 0);
  assert.equal(calls.logged.length, 0);
});
