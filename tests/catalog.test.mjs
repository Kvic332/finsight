import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedAt, createHandler, StoreError } from '../supabase/functions/catalog-admin/handler.ts';
import { createAdminChecker, createStore } from '../supabase/functions/catalog-admin/services.ts';

const PROVIDER = '00000000-0000-0000-0000-00000000000a';
const PRODUCT = '10000000-0000-0000-0000-00000000000a';
// 12:00 in Lagos.
const NOW = new Date('2026-11-03T11:00:00Z');

const request = (body, headers = { authorization: 'Bearer good' }, method = 'POST') =>
  new Request('https://x.test/catalog-admin', {
    method, headers, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

function harness(over = {}, storeOver = {}) {
  const calls = { writes: [], logs: [], adminChecks: 0 };
  const record = name => async (...args) => { calls.writes.push({ name, args }); return { id: 'saved' }; };
  const handler = createHandler({
    verifyToken: async () => ({ uid: 'admin-1', isAnonymous: false }),
    isAdmin: async () => { calls.adminChecks++; return true; },
    now: () => NOW,
    logError: event => calls.logs.push(event),
    store: {
      listAll: async () => ({ providers: [] }),
      saveProvider: record('saveProvider'),
      saveProduct: record('saveProduct'),
      setStatus: record('setStatus'),
      productCategory: async () => 'loan',
      saveRate: record('saveRate'),
      addCheck: record('addCheck'),
      saveInflation: record('saveInflation'),
      ...storeOver,
    },
    ...over,
  });
  return { handler, calls };
}

const goodRate = {
  action: 'save_rate', product_id: PRODUCT, rate_min_pct: 4, rate_max_pct: 10, rate_period: 'monthly',
  source_url: 'https://lender.test/rates', checked_on: '2026-11-03',
};
const goodCheck = {
  action: 'add_check', provider_id: PROVIDER, regulator: 'FCCPC', status: 'verified',
  source_url: 'https://fccpc.test/register', checked_on: '2026-11-03',
};

// ── Access ────────────────────────────────────────────────────────────────────
test('only POST is allowed', async () => {
  const { handler } = harness();
  assert.equal((await handler(request(undefined, {}, 'GET'))).status, 405);
});

test('a missing or invalid token is rejected before the admin check', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(request({ action: 'list' }, {}))).status, 401);
  assert.equal(calls.adminChecks, 0);
  const bad = harness({ verifyToken: async () => { throw new Error('bad'); } });
  assert.equal((await bad.handler(request({ action: 'list' }))).status, 401);
  assert.equal(bad.calls.adminChecks, 0);
});

test('anonymous users are refused without an admin check', async () => {
  const { handler, calls } = harness({ verifyToken: async () => ({ uid: 'a', isAnonymous: true }) });
  assert.equal((await handler(request({ action: 'list' }))).status, 403);
  assert.equal(calls.adminChecks, 0);
});

test('signed-in users who are not admins can neither read nor write', async () => {
  const { handler, calls } = harness({ isAdmin: async () => false });
  assert.equal((await handler(request({ action: 'list' }))).status, 403);
  assert.equal((await handler(request(goodCheck))).status, 403);
  assert.equal(calls.writes.length, 0);
});

test('if admin status cannot be confirmed, the request stops', async () => {
  const { handler, calls } = harness({ isAdmin: async () => { throw new Error('down'); } });
  assert.equal((await handler(request({ action: 'list' }))).status, 503);
  assert.deepEqual(calls.logs, ['admin_check_failed']);
  assert.equal(calls.writes.length, 0);
});

test('the admin check asks Firestore with the caller\'s own token', async () => {
  const seen = [];
  const answer = status => async (url, init) => { seen.push({ url, init }); return new Response('{}', { status }); };
  assert.equal(await createAdminChecker(answer(200), 'proj')('u/1', 'tok'), true);
  assert.equal(await createAdminChecker(answer(404), 'proj')('u1', 'tok'), false);
  assert.equal(await createAdminChecker(answer(403), 'proj')('u1', 'tok'), false);
  await assert.rejects(createAdminChecker(answer(500), 'proj')('u1', 'tok'));
  assert.match(seen[0].url, /projects\/proj\/.*\/admins\/u%2F1$/);
  assert.equal(seen[0].init.headers.Authorization, 'Bearer tok');
});

// ── Requests ──────────────────────────────────────────────────────────────────
test('bad bodies and unknown actions are rejected', async () => {
  const { handler } = harness();
  for (const body of ['not json', '[]', 'null', { action: 'drop_everything' }, {}]) {
    assert.equal((await handler(request(body))).status, 400);
  }
  assert.equal((await handler(request('x'.repeat(33_000)))).status, 413);
});

test('providers need a name and a safe link, and extra fields are dropped', async () => {
  const { handler, calls } = harness();
  const good = { action: 'save_provider', name: ' Lender ', website_url: 'https://lender.test', status: 'published', id: null, boost: 9 };
  assert.equal((await handler(request(good))).status, 200);
  assert.deepEqual(calls.writes[0].args, [null, { name: 'Lender', website_url: 'https://lender.test', logo_url: null }]);
  for (const website_url of ['javascript:alert(1)', 'http://lender.test', 'https://', 'https://a:b@lender.test', '']) {
    assert.equal((await handler(request({ ...good, website_url }))).status, 400, website_url);
  }
  assert.equal((await handler(request({ ...good, name: '  ' }))).status, 400);
});

test('saving a provider never changes whether it is published', async () => {
  const { handler, calls } = harness();
  await handler(request({ action: 'save_provider', id: PROVIDER, name: 'L', website_url: 'https://l.test', status: 'published' }));
  assert.equal('status' in calls.writes[0].args[1], false);
});

test('a new product needs a provider and category, which an edit cannot change', async () => {
  const { handler, calls } = harness();
  const fields = { action: 'save_product', name: 'Quick loan', min_amount: 1000, max_amount: 5000, key_terms: ['No collateral'] };
  assert.equal((await handler(request(fields))).status, 400);
  assert.equal((await handler(request({ ...fields, provider_id: PROVIDER, category: 'gold' }))).status, 400);
  assert.equal((await handler(request({ ...fields, provider_id: PROVIDER, category: 'loan' }))).status, 200);
  assert.equal(calls.writes[0].args[1].category, 'loan');

  await handler(request({ ...fields, id: PRODUCT, provider_id: PROVIDER, category: 'fx' }));
  assert.equal('category' in calls.writes[1].args[1], false);
  assert.equal('provider_id' in calls.writes[1].args[1], false);
});

test('product amounts and tenors must make sense', async () => {
  const { handler } = harness();
  const base = { action: 'save_product', id: PRODUCT, name: 'P' };
  for (const extra of [
    { min_amount: 10, max_amount: 5 }, { min_amount: -1 }, { min_amount: '5' }, { min_tenor_days: 1.5 },
    { min_tenor_days: 30, max_tenor_days: 7 }, { currency: 'naira' }, { key_terms: 'x' }, { referral_url: 'http://x.test' },
  ]) {
    assert.equal((await handler(request({ ...base, ...extra }))).status, 400, JSON.stringify(extra));
  }
});

test('status changes accept only known statuses', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(request({ action: 'set_product_status', id: PRODUCT, status: 'published' }))).status, 200);
  assert.deepEqual(calls.writes[0].args, ['products', PRODUCT, 'published']);
  assert.equal((await handler(request({ action: 'set_provider_status', id: PROVIDER, status: 'boosted' }))).status, 400);
});

test('a missing record returns 404', async () => {
  const { handler } = harness({}, { setStatus: async () => null, productCategory: async () => null });
  assert.equal((await handler(request({ action: 'set_product_status', id: PRODUCT, status: 'draft' }))).status, 404);
  assert.equal((await handler(request(goodRate))).status, 404);
});

// ── Rates ─────────────────────────────────────────────────────────────────────
test('a rate takes its category from the database and its author from the token', async () => {
  const { handler, calls } = harness();
  const res = await handler(request({ ...goodRate, category: 'fx', updated_by: 'someone-else' }));
  assert.equal(res.status, 200);
  const row = calls.writes[0].args[0];
  assert.equal(row.category, 'loan');
  assert.equal(row.updated_by, 'admin-1');
  assert.equal(row.buy_rate, null);
});

test('a rate needs a source, a date and sensible values', async () => {
  const { handler, calls } = harness();
  for (const extra of [
    { source_url: undefined }, { source_url: 'http://x.test' }, { checked_on: undefined }, { checked_on: '2026-11-04' },
    { checked_on: '2026-02-31' }, { checked_on: 'yesterday' }, { rate_min_pct: undefined }, { rate_min_pct: 1001 },
    { rate_min_pct: 11 }, { rate_period: 'weekly' }, { rate_min_pct: '4' },
  ]) {
    assert.equal((await handler(request({ ...goodRate, ...extra }))).status, 400, JSON.stringify(extra));
  }
  assert.equal(calls.writes.length, 0);
});

test('FX rates use buy and sell, and clear the percentage fields', async () => {
  const { handler, calls } = harness({}, { productCategory: async () => 'fx' });
  const base = { action: 'save_rate', product_id: PRODUCT, source_url: 'https://bdc.test', checked_on: '2026-11-03' };
  assert.equal((await handler(request({ ...base, buy_rate: 1500, sell_rate: 1600, rate_min_pct: 9, rate_period: 'annual' }))).status, 200);
  const row = calls.writes[0].args[0];
  assert.equal(row.rate_min_pct, null);
  assert.equal(row.rate_period, null);
  assert.equal((await handler(request(base))).status, 400);
  assert.equal((await handler(request({ ...base, buy_rate: 0 }))).status, 400);
  assert.equal((await handler(request({ ...base, buy_rate: 1600, sell_rate: 1500 }))).status, 400);
});

// ── Licence checks ────────────────────────────────────────────────────────────
test('a licence check records who made it and needs a source', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(request({ ...goodCheck, checked_by: 'someone-else' }))).status, 200);
  assert.equal(calls.writes[0].args[0].checked_by, 'admin-1');
  for (const extra of [{ source_url: undefined }, { regulator: 'NAFDAC' }, { status: 'pending' }, { provider_id: 'x' }]) {
    assert.equal((await handler(request({ ...goodCheck, ...extra }))).status, 400, JSON.stringify(extra));
  }
});

test('a licence that has already expired cannot be marked verified', async () => {
  const { handler } = harness();
  assert.equal((await handler(request({ ...goodCheck, expires_on: '2026-11-02' }))).status, 400);
  assert.equal((await handler(request({ ...goodCheck, expires_on: '2026-11-03' }))).status, 200);
  assert.equal((await handler(request({ ...goodCheck, status: 'revoked', expires_on: '2026-11-02' }))).status, 200);
});

test('dates use Lagos time, and today sits just behind the clock', () => {
  // 00:30 on the 4th in Lagos is still the 3rd in UTC.
  const lateNight = new Date('2026-11-03T23:30:00Z');
  assert.doesNotThrow(() => checkedAt('2026-11-04', lateNight));
  assert.throws(() => checkedAt('2026-11-05', lateNight));
  assert.ok(new Date(checkedAt('2026-11-03', NOW)) < NOW);
  assert.equal(checkedAt('2026-11-01', NOW), '2026-10-31T23:00:00.000Z');
});

// ── Inflation ─────────────────────────────────────────────────────────────────
const goodInflation = {
  action: 'save_inflation', month: '2026-09', headline_pct: 14.63, source_url: 'https://nbs.test/cpi', checked_on: '2026-11-03',
};

test('an inflation figure records its month, source and who saved it', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(request({ ...goodInflation, updated_by: 'someone-else' }))).status, 200);
  const row = calls.writes[0].args[0];
  assert.equal(row.month, '2026-09-01');
  assert.equal(row.headline_pct, 14.63);
  assert.equal(row.updated_by, 'admin-1');
});

test('an inflation figure needs a real past month, a sane value and a source', async () => {
  const { handler, calls } = harness();
  for (const extra of [
    { month: '2026-12' }, { month: '2026-13' }, { month: 'September' }, { headline_pct: undefined }, { headline_pct: '14' },
    { headline_pct: 501 }, { headline_pct: -1 }, { source_url: 'http://nbs.test' }, { checked_on: '2026-11-04' },
  ]) {
    assert.equal((await handler(request({ ...goodInflation, ...extra }))).status, 400, JSON.stringify(extra));
  }
  assert.equal(calls.writes.length, 0);
});

test('non-admins cannot change the inflation figure', async () => {
  const { handler, calls } = harness({ isAdmin: async () => false });
  assert.equal((await handler(request(goodInflation))).status, 403);
  assert.equal(calls.writes.length, 0);
});

// ── Database errors ───────────────────────────────────────────────────────────
test('database refusals become clear errors', async () => {
  const save = code => ({ saveProvider: async () => { throw new StoreError(code); } });
  const body = { action: 'save_provider', name: 'L', website_url: 'https://l.test' };
  const dup = await harness({}, save('duplicate')).handler(request(body));
  assert.equal(dup.status, 409);
  assert.deepEqual(await dup.json(), { error: 'duplicate' });
  assert.equal((await harness({}, save('rejected')).handler(request(body))).status, 400);
});

test('an unexpected failure is logged without details', async () => {
  const { handler, calls } = harness({}, { listAll: async () => { throw new Error('secret detail'); } });
  const res = await handler(request({ action: 'list' }));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'unavailable' });
  assert.deepEqual(calls.logs, ['store_failed']);
});

// ── Store ─────────────────────────────────────────────────────────────────────
function fakeRest(answer) {
  const seen = [];
  const fetchFn = async (url, init) => {
    seen.push({ url, init });
    const { status = 200, body = [] } = answer(url, init) || {};
    return new Response(JSON.stringify(body), { status });
  };
  return { store: createStore(fetchFn, 'https://db.test', 'service-key'), seen };
}

test('saving a rate replaces the current one by product', async () => {
  const { store, seen } = fakeRest(() => ({ body: [{ product_id: PRODUCT }] }));
  await store.saveRate({ product_id: PRODUCT });
  assert.match(seen[0].url, /rates\?on_conflict=product_id$/);
  assert.match(seen[0].init.headers.Prefer, /merge-duplicates/);
  assert.equal(seen[0].init.headers.apikey, 'service-key');
});

test('Postgres errors map to store errors', async () => {
  const failing = code => fakeRest(() => ({ status: 409, body: { code } })).store;
  await assert.rejects(failing('23505').saveProvider(null, {}), e => e.code === 'duplicate');
  await assert.rejects(failing('23514').saveProvider(null, {}), e => e.code === 'rejected');
  await assert.rejects(failing('42501').saveProvider(null, {}), e => !(e instanceof StoreError));
});

test('updating a record that does not exist returns nothing', async () => {
  const { store, seen } = fakeRest(() => ({ body: [] }));
  assert.equal(await store.setStatus('products', PRODUCT, 'draft'), null);
  assert.match(seen[0].url, /products\?id=eq\./);
  assert.equal(seen[0].init.method, 'PATCH');
});

test('the list includes what the app would actually show', async () => {
  const { store } = fakeRest(url => (url.includes('compare_listings') ? { body: [{ product_id: PRODUCT }] } : { body: [] }));
  const all = await store.listAll();
  assert.deepEqual(all.listed, [PRODUCT]);
  assert.deepEqual(Object.keys(all).sort(), ['checks', 'inflation', 'listed', 'products', 'providers', 'rates']);
  assert.equal(all.inflation, null);
});
