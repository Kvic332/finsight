import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, planRates } from '../supabase/functions/fx-rates/handler.ts';

// Units per 1 USD, as open.er-api.com gives them.
const SOURCE = { NGN: 1348.02, GBP: 0.7429, EUR: 0.8905, CAD: 1.3991 };

test('naira rates are worked out from the US dollar rates', () => {
  const byCurrency = Object.fromEntries(planRates(SOURCE, {}).map(d => [d.currency, d]));
  assert.equal(byCurrency.USD.ngnPerUnit, 1348.02);
  assert.equal(byCurrency.GBP.ngnPerUnit, Math.round((1348.02 / 0.7429) * 100) / 100);
  assert.ok(Object.values(byCurrency).every(d => d.status === 'apply'));
});

test('a big move in a day or an impossible rate is held, not applied', () => {
  const [usd] = planRates({ ...SOURCE, NGN: 2000 }, { USD: 1348 });
  assert.equal(usd.status, 'held');
  assert.match(usd.reason, /Moved more than 15%/);
  assert.equal(planRates({ ...SOURCE, NGN: 50 }, {})[0].status, 'held');
  assert.equal(planRates({ NGN: 1348 }, {}).find(d => d.currency === 'GBP').status, 'held');
});

function harness(over = {}) {
  const calls = { applied: [], logged: [] };
  const handler = createHandler({
    checkSecret: async c => c === 'good',
    fetchRates: async () => ({ result: 'success', rates: SOURCE }),
    store: {
      current: async () => ({ USD: 1340 }),
      apply: async rows => { calls.applied.push(...rows); },
      log: async rows => { calls.logged.push(...rows); },
    },
    logError: () => {},
    ...over,
  });
  return { handler, calls };
}
const post = (secret = 'good') => new Request('https://x.test/fx-rates', { method: 'POST', headers: { 'x-cron-secret': secret } });

test('only the scheduled job can run it', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(post('bad'))).status, 401);
  assert.equal((await handler(new Request('https://x.test/fx-rates', { method: 'POST' }))).status, 401);
  assert.equal(calls.applied.length, 0);
});

test('a run applies good rates and logs every decision', async () => {
  const { handler, calls } = harness();
  const res = await handler(post());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { applied: 4, held: 0 });
  assert.equal(calls.logged.length, 4);
});

test('a failed source changes nothing', async () => {
  const { handler, calls } = harness({ fetchRates: async () => ({ result: 'error' }) });
  assert.equal((await handler(post())).status, 502);
  assert.equal(calls.applied.length, 0);
});
