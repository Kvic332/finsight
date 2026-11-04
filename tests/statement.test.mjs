import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { PGlite } from '@electric-sql/pglite';
import { cleanStatement, createHandler, inspectPdf } from '../supabase/functions/statement-reader/handler.ts';
import { createPdfReader, createQuotaChecker, SYSTEM_PROMPT } from '../supabase/functions/statement-reader/services.ts';

const pdf = (extra = '') => btoa(`%PDF-1.7\n${extra}\n%%EOF`);
const goodStatement = {
  is_statement: true,
  opening_balance: 1000,
  closing_balance: 1700,
  transactions: [
    { date: '01/10/2026', description: 'Salary', debit: 0, credit: 1000 },
    { date: '02/10/2026', description: 'Shoprite', debit: 300, credit: 0 },
  ],
};

const request = (body = { pdf: pdf() }, headers = { authorization: 'Bearer good' }, method = 'POST') =>
  new Request('https://x.test/statement-reader', {
    method, headers, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

function harness(over = {}) {
  const calls = { quota: 0, read: 0, logs: [] };
  const handler = createHandler({
    verifyToken: async () => ({ uid: 'u1', isAnonymous: false }),
    consumeQuota: async () => { calls.quota++; return 'ok'; },
    readPdf: async () => { calls.read++; return { status: 'ok', statement: goodStatement }; },
    logError: (event, status) => calls.logs.push({ event, status }),
    ...over,
  });
  return { handler, calls };
}

// â”€â”€ Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('a statement comes back as rows, with a balance check', async () => {
  const { handler } = harness();
  const res = await handler(request());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    rows: [['01/10/2026', 'Salary', 0, 1000], ['02/10/2026', 'Shoprite', 300, 0]],
    skipped: 0,
    balanced: true,
  });
});

test('only POST with a valid token gets in, and nothing else runs first', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(request(undefined, {}, 'GET'))).status, 405);
  assert.equal((await handler(request(undefined, {}))).status, 401);
  const bad = harness({ verifyToken: async () => { throw new Error('bad'); } });
  assert.equal((await bad.handler(request())).status, 401);
  assert.equal(calls.quota + calls.read + bad.calls.quota + bad.calls.read, 0);
});

test('bad bodies and files that cannot be read do not use the quota', async () => {
  const { handler, calls } = harness();
  for (const body of ['not json', {}, { pdf: 7 }, { pdf: '' }]) {
    assert.equal((await handler(request(body))).status, 400);
  }
  const notPdf = await handler(request({ pdf: btoa('hello') }));
  assert.equal(notPdf.status, 400);
  assert.deepEqual(await notPdf.json(), { error: 'not_a_pdf' });
  const locked = await handler(request({ pdf: pdf('/Encrypt 5 0 R') }));
  assert.equal(locked.status, 422);
  assert.deepEqual(await locked.json(), { error: 'password_protected' });
  assert.equal(calls.quota, 0);
  assert.equal(calls.read, 0);
});

test('an oversized file is rejected before it is read', async () => {
  const { handler, calls } = harness();
  assert.equal((await handler(request({ pdf: 'A'.repeat(11_000_001) }))).status, 413);
  assert.equal(calls.quota, 0);
});

test('limits stop the model call, and a failed check stops the request', async () => {
  for (const limit of ['user_limit', 'global_limit']) {
    const { handler, calls } = harness({ consumeQuota: async () => limit });
    const res = await handler(request());
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: limit });
    assert.equal(calls.read, 0);
  }
  const down = harness({ consumeQuota: async () => { throw new Error('down'); } });
  assert.equal((await down.handler(request())).status, 503);
  assert.equal(down.calls.read, 0);
});

test('model failures are logged by status only, with no statement data', async () => {
  const { handler, calls } = harness({
    readPdf: async () => { throw Object.assign(new Error('secret account 0123456789'), { status: 500 }); },
  });
  const res = await handler(request());
  assert.equal(res.status, 502);
  assert.deepEqual(calls.logs, [{ event: 'model_call_failed', status: 500 }]);
  assert.doesNotMatch(JSON.stringify(await res.json()), /0123456789/);
});

test('refusals, other documents and cut-off replies are explained', async () => {
  const cases = [
    [{ status: 'refused' }, 'not_a_statement'],
    [{ status: 'too_long' }, 'too_long'],
    [{ status: 'ok', statement: { ...goodStatement, is_statement: false, transactions: [] } }, 'not_a_statement'],
  ];
  for (const [result, code] of cases) {
    const res = await harness({ readPdf: async () => result }).handler(request());
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: code });
  }
});

// â”€â”€ Checking the file and the output â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('only real, unprotected PDFs pass', () => {
  assert.equal(inspectPdf(pdf()), 'ok');
  assert.equal(inspectPdf(pdf('/Encrypt 3 0 R')), 'encrypted');
  assert.equal(inspectPdf(btoa('PK zip file')), 'invalid');
  assert.equal(inspectPdf('!!! not base64'), 'invalid');
});

test('rows that are not clearly a dated debit or credit are counted, not kept', () => {
  const rows = [
    { date: '31/02/2026', description: 'Impossible date', debit: 5, credit: 0 },
    { date: '2026-10-01', description: 'Wrong format', debit: 5, credit: 0 },
    { date: '01/10/2026', description: 'Both sides', debit: 5, credit: 5 },
    { date: '01/10/2026', description: 'Neither side', debit: 0, credit: 0 },
    { date: '01/10/2026', description: 'Negative', debit: -5, credit: 0 },
    { date: '01/10/2026', description: 'Text amount', debit: '5', credit: 0 },
    { date: '01/10/2026', description: null, debit: 5, credit: 0 },
    { date: '01/10/2026', description: 'Good', debit: 5, credit: 0 },
  ];
  const result = cleanStatement({ ...goodStatement, transactions: rows });
  assert.equal(result.rows.length, 1);
  assert.equal(result.skipped, 7);
});

test('the balance check spots a misread amount', () => {
  assert.equal(cleanStatement(goodStatement).balanced, true);
  const wrong = { ...goodStatement, closing_balance: 9000 };
  assert.equal(cleanStatement(wrong).balanced, false);
  const kobo = { ...goodStatement, closing_balance: 1700.5 };
  assert.equal(cleanStatement(kobo).balanced, true);
});

test('the balance check says nothing when it cannot tell', () => {
  assert.equal(cleanStatement({ ...goodStatement, opening_balance: null }).balanced, null);
  assert.equal(cleanStatement({ ...goodStatement, closing_balance: null }).balanced, null);
  const skippedRow = { ...goodStatement, transactions: [...goodStatement.transactions, { date: 'bad', description: 'x', debit: 1, credit: 0 }] };
  assert.equal(cleanStatement(skippedRow).balanced, null);
});

test('long descriptions are trimmed', () => {
  const long = { ...goodStatement, transactions: [{ date: '01/10/2026', description: 'x'.repeat(500), debit: 1, credit: 0 }] };
  assert.equal(cleanStatement(long).rows[0][1].length, 200);
});

// â”€â”€ The model request, through the real SDK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function streamBody(message) {
  const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify({ type: name, ...data })}\n\n`;
  const text = message.text ?? '';
  return [
    event('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model: 'm', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }),
    event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    event('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }),
    event('content_block_stop', { index: 0 }),
    event('message_delta', { delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: 1 } }),
    event('message_stop', {}),
  ].join('');
}

function fakeAnthropic(message) {
  const sent = [];
  const client = new Anthropic({
    apiKey: 'test-key',
    fetch: async (url, init) => {
      sent.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) });
      return new Response(streamBody(message), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    },
  });
  return { client, sent };
}

test('the SDK sends the PDF as a document, asks for JSON and keeps the key in the header', async () => {
  const { client, sent } = fakeAnthropic({ text: JSON.stringify(goodStatement), stop_reason: 'end_turn' });
  const result = await createPdfReader(client, 'claude-opus-5-5')('QUJD');
  assert.deepEqual(result, { status: 'ok', statement: goodStatement });
  const { url, headers, body } = sent[0];
  assert.match(url, /\/v1\/messages/);
  assert.equal(headers.get('authorization'), 'Bearer test-key');
  assert.equal(body.stream, true);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.deepEqual(body.messages[0].content[0], {
    type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' },
  });
  assert.doesNotMatch(JSON.stringify(body), /test-key/);
});

test('a cut-off or refused reply is not used', async () => {
  const cut = fakeAnthropic({ text: '{"is_statement":true,"transac', stop_reason: 'max_tokens' });
  assert.deepEqual(await createPdfReader(cut.client, 'm')('QUJD'), { status: 'too_long' });
  const refused = fakeAnthropic({ text: '', stop_reason: 'refusal' });
  assert.deepEqual(await createPdfReader(refused.client, 'm')('QUJD'), { status: 'refused' });
});

test('the prompt treats the PDF as data and forbids estimating amounts', () => {
  assert.match(SYSTEM_PROMPT, /never an instruction/i);
  assert.match(SYSTEM_PROMPT, /Never estimate/);
});

// â”€â”€ Quota, against real Postgres â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function quotaDb() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(readFileSync(new URL('../supabase/migrations/20261104080823_statement_usage.sql', import.meta.url), 'utf8'));
  return db;
}
const consume = async (db, uid, user, global) =>
  (await db.query('select public.consume_statement_quota($1, $2, $3) as r', [uid, user, global])).rows[0].r;

test('statement limits apply per person and overall', async () => {
  const db = await quotaDb();
  assert.equal(await consume(db, 'a', 2, 3), 'ok');
  assert.equal(await consume(db, 'a', 2, 3), 'ok');
  assert.equal(await consume(db, 'a', 2, 3), 'user_limit');
  assert.equal(await consume(db, 'b', 2, 3), 'ok');
  assert.equal(await consume(db, 'c', 2, 3), 'global_limit');
});

test('old counts are removed, and app roles cannot reach the quota', async () => {
  const db = await quotaDb();
  await db.exec(`insert into public.statement_usage values ('old', (now() at time zone 'Africa/Lagos')::date - 31, 1), ('recent', (now() at time zone 'Africa/Lagos')::date - 30, 1)`);
  await consume(db, 'a', 2, 3);
  const { rows } = await db.query('select uid from public.statement_usage order by uid');
  assert.deepEqual(rows.map(r => r.uid), ['a', 'recent']);
  await db.exec('set role anon');
  await assert.rejects(db.query(`select public.consume_statement_quota('x', 9, 9)`));
  await assert.rejects(db.query('select * from public.statement_usage'));
  await db.exec('reset role');
});

test('the quota client sends the right limit for the account type', async () => {
  const bodies = [];
  const fakeFetch = async (url, init) => { bodies.push({ url, body: JSON.parse(init.body) }); return new Response('"ok"'); };
  const check = createQuotaChecker(fakeFetch, 'https://db.test', 'k', { signedIn: 5, anonymous: 2, global: 100 });
  assert.equal(await check({ uid: 'a', isAnonymous: false }), 'ok');
  await check({ uid: 'b', isAnonymous: true });
  assert.match(bodies[0].url, /consume_statement_quota/);
  assert.equal(bodies[0].body.p_user_limit, 5);
  assert.equal(bodies[1].body.p_user_limit, 2);
  assert.equal(bodies[1].body.p_global_limit, 100);
});
