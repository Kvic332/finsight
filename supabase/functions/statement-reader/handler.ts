// PDF statement requests. Everything external is passed in, so this file can be
// tested without a network, an Anthropic key or a database. Statements hold full
// financial history, so nothing here stores or logs what's in them.

import type { Caller, QuotaResult } from '../aria/handler.ts';

export type RawStatement = {
  is_statement: boolean;
  opening_balance: number | null;
  closing_balance: number | null;
  transactions: { date: string; description: string; debit: number; credit: number }[];
};

export type ReadResult =
  | { status: 'ok'; statement: RawStatement }
  | { status: 'refused' | 'too_long' };

export type Deps = {
  verifyToken: (token: string) => Promise<Caller>;
  consumeQuota: (caller: Caller) => Promise<QuotaResult>;
  readPdf: (base64: string) => Promise<ReadResult>;
  logError: (event: string, status?: number) => void;
};

// About 8 MB of PDF once base64 adds its third. Larger files risk the function's time limit.
const MAX_BASE64_CHARS = 11_000_000;
const MAX_BODY_BYTES = MAX_BASE64_CHARS + 1_000;
const MAX_DESCRIPTION_CHARS = 200;
// Balances are in naira and kobo, so anything within a naira counts as matching.
const BALANCE_TOLERANCE = 1;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fail = (status: number, code: string) => json(status, { error: code });

export function inspectPdf(base64: string): 'ok' | 'invalid' | 'encrypted' {
  let text: string;
  try { text = atob(base64); } catch { return 'invalid'; }
  if (!text.startsWith('%PDF-')) return 'invalid';
  // Protected PDFs name their encryption dictionary, and Claude can't open them.
  return text.includes('/Encrypt') ? 'encrypted' : 'ok';
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const validAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

// The model's output is checked like any other input. A row that isn't clearly a
// dated debit or credit is counted as skipped, so the person is told about it.
export function cleanStatement(raw: RawStatement) {
  const rows: [string, string, number, number][] = [];
  let skipped = 0;
  for (const t of raw.transactions) {
    const oneSided = validAmount(t.debit) && validAmount(t.credit) && (t.debit > 0) !== (t.credit > 0);
    if (!oneSided || !validDate(t.date) || typeof t.description !== 'string') {
      skipped++;
      continue;
    }
    rows.push([t.date, t.description.slice(0, MAX_DESCRIPTION_CHARS), t.debit, t.credit]);
  }

  // True or false only when the statement gives both balances and every row was
  // read. It catches a misread amount, which nothing else would.
  let balanced: boolean | null = null;
  if (validAmount(raw.opening_balance) && validAmount(raw.closing_balance) && skipped === 0) {
    const net = rows.reduce((sum, r) => sum + r[3] - r[2], 0);
    balanced = Math.abs(raw.opening_balance + net - raw.closing_balance) <= BALANCE_TOLERANCE;
  }
  return { rows, skipped, balanced };
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed');

    const token = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/)?.[1];
    if (!token) return fail(401, 'unauthenticated');

    let caller: Caller;
    try {
      caller = await deps.verifyToken(token);
    } catch {
      return fail(401, 'unauthenticated');
    }

    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > MAX_BODY_BYTES) return fail(413, 'too_large');
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large');

    let pdf: unknown;
    try { pdf = JSON.parse(raw).pdf; } catch { return fail(400, 'invalid_request'); }
    if (typeof pdf !== 'string' || !pdf) return fail(400, 'invalid_request');
    if (pdf.length > MAX_BASE64_CHARS) return fail(413, 'too_large');

    // Checked before the quota, so a file that can't be read doesn't use it up.
    const inspected = inspectPdf(pdf);
    if (inspected === 'invalid') return fail(400, 'not_a_pdf');
    if (inspected === 'encrypted') return fail(422, 'password_protected');

    // If the limit can't be checked, stop: an open door here costs real money.
    let quota: QuotaResult;
    try {
      quota = await deps.consumeQuota(caller);
    } catch {
      deps.logError('quota_check_failed');
      return fail(503, 'unavailable');
    }
    if (quota !== 'ok') return fail(429, quota);

    let result: ReadResult;
    try {
      result = await deps.readPdf(pdf);
    } catch (err) {
      // Status only, never the request or reply, which hold the person's finances.
      deps.logError('model_call_failed', (err as { status?: number }).status);
      return fail(502, 'upstream_error');
    }
    if (result.status === 'too_long') return fail(422, 'too_long');
    if (result.status === 'refused' || !result.statement.is_statement) return fail(422, 'not_a_statement');

    return json(200, cleanStatement(result.statement));
  };
}
