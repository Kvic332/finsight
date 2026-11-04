// Catalogue admin requests. Everything external is passed in, so this file can be
// tested without a network or a database. Only fields named here ever reach the
// database, and who made a change comes from the verified token, never the body.

import type { Caller } from '../aria/handler.ts';

export type Row = Record<string, unknown>;
export type Status = 'draft' | 'published' | 'archived';

export type Store = {
  listAll: () => Promise<Row>;
  saveProvider: (id: string | null, fields: Row) => Promise<Row | null>;
  saveProduct: (id: string | null, fields: Row) => Promise<Row | null>;
  setStatus: (table: 'providers' | 'products', id: string, status: Status) => Promise<Row | null>;
  productCategory: (id: string) => Promise<string | null>;
  saveRate: (row: Row) => Promise<Row>;
  addCheck: (row: Row) => Promise<Row>;
  saveInflation: (row: Row) => Promise<Row>;
};

export type Deps = {
  verifyToken: (token: string) => Promise<Caller>;
  isAdmin: (uid: string, token: string) => Promise<boolean>;
  store: Store;
  now: () => Date;
  logError: (event: string, code?: string) => void;
};

// Raised by the store when the database turns a write down.
export class StoreError extends Error {
  code: 'duplicate' | 'rejected';
  constructor(code: 'duplicate' | 'rejected') {
    super(code);
    this.code = code;
  }
}

class Invalid extends Error {}

const MAX_BODY_BYTES = 32_000;
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
// The database refuses a date ahead of its own clock, so allow for a small gap
// between that clock and this function's.
const CLOCK_MARGIN_MS = 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ['loan', 'savings', 'fund', 'fx'];
const STATUSES = ['draft', 'published', 'archived'];
const RATE_PERIODS = ['annual', 'monthly', 'daily', 'per_term'];
const REGULATORS = ['CBN', 'FCCPC', 'SEC'];
const CHECK_STATUSES = ['verified', 'revoked', 'not_found'];

function requiredText(v: unknown, max = 200): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Invalid();
  return v.trim();
}

function optionalText(v: unknown, max = 1000): string | null {
  if (v === undefined || v === null || v === '') return null;
  return requiredText(v, max);
}

function oneOf(v: unknown, allowed: string[]): string {
  if (typeof v !== 'string' || !allowed.includes(v)) throw new Invalid();
  return v;
}

function uuid(v: unknown): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Invalid();
  return v;
}

function httpsUrl(v: unknown): string {
  const raw = requiredText(v, 500);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Invalid(); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Invalid();
  return raw;
}

const optionalUrl = (v: unknown) => (v === undefined || v === null || v === '' ? null : httpsUrl(v));

function optionalNumber(v: unknown, max = Number.MAX_SAFE_INTEGER): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw new Invalid();
  return v;
}

function optionalInteger(v: unknown): number | null {
  const n = optionalNumber(v, 36_500);
  if (n !== null && !Number.isInteger(n)) throw new Invalid();
  return n;
}

function ordered(min: number | null, max: number | null) {
  if (min !== null && max !== null && min > max) throw new Invalid();
}

function calendarDate(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Invalid();
  // Rejects dates that roll over, such as 2026-02-31.
  const parsed = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v) throw new Invalid();
  return v;
}

const lagosToday = (now: Date) => new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);

// Today means right now, so a correction made later today outranks an earlier
// check. An earlier date means the start of that day in Lagos.
export function checkedAt(v: unknown, now: Date): string {
  const date = calendarDate(v);
  const today = lagosToday(now);
  if (date > today) throw new Invalid();
  if (date === today) return new Date(now.getTime() - CLOCK_MARGIN_MS).toISOString();
  return new Date(`${date}T00:00:00+01:00`).toISOString();
}

// A licence stays valid through the whole of its last day.
function expiresAt(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  return new Date(`${calendarDate(v)}T23:59:59+01:00`).toISOString();
}

export function providerFields(body: Row): Row {
  return {
    name: requiredText(body.name),
    website_url: httpsUrl(body.website_url),
    logo_url: optionalUrl(body.logo_url),
  };
}

export function productFields(body: Row): Row {
  const minAmount = optionalNumber(body.min_amount);
  const maxAmount = optionalNumber(body.max_amount);
  const minTenor = optionalInteger(body.min_tenor_days);
  const maxTenor = optionalInteger(body.max_tenor_days);
  ordered(minAmount, maxAmount);
  ordered(minTenor, maxTenor);
  const currency = body.currency === undefined ? 'NGN' : body.currency;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) throw new Invalid();
  const terms = body.key_terms === undefined ? [] : body.key_terms;
  if (!Array.isArray(terms) || terms.length > 10) throw new Invalid();
  return {
    name: requiredText(body.name),
    currency,
    min_amount: minAmount,
    max_amount: maxAmount,
    min_tenor_days: minTenor,
    max_tenor_days: maxTenor,
    fees: optionalText(body.fees),
    key_terms: terms.map(t => requiredText(t, 200)),
    referral_url: optionalUrl(body.referral_url),
  };
}

export function rateRow(body: Row, category: string, uid: string, now: Date): Row {
  const common = {
    product_id: uuid(body.product_id),
    category,
    source_url: httpsUrl(body.source_url),
    checked_at: checkedAt(body.checked_on, now),
    updated_by: uid,
  };
  if (category === 'fx') {
    const buy = optionalNumber(body.buy_rate);
    const sell = optionalNumber(body.sell_rate);
    if ((buy === null && sell === null) || buy === 0 || sell === 0) throw new Invalid();
    ordered(buy, sell);
    return { ...common, buy_rate: buy, sell_rate: sell, rate_min_pct: null, rate_max_pct: null, rate_period: null };
  }
  const min = optionalNumber(body.rate_min_pct, 1000);
  const max = optionalNumber(body.rate_max_pct, 1000);
  if (min === null) throw new Invalid();
  ordered(min, max);
  return {
    ...common,
    rate_min_pct: min,
    rate_max_pct: max,
    rate_period: oneOf(body.rate_period, RATE_PERIODS),
    buy_rate: null,
    sell_rate: null,
  };
}

export function checkRow(body: Row, uid: string, now: Date): Row {
  const status = oneOf(body.status, CHECK_STATUSES);
  const expires = expiresAt(body.expires_on);
  if (status === 'verified' && expires !== null && new Date(expires) <= now) throw new Invalid();
  return {
    provider_id: uuid(body.provider_id),
    regulator: oneOf(body.regulator, REGULATORS),
    licence_type: optionalText(body.licence_type, 200),
    licence_number: optionalText(body.licence_number, 200),
    status,
    source_url: httpsUrl(body.source_url),
    checked_at: checkedAt(body.checked_on, now),
    expires_at: expires,
    checked_by: uid,
    notes: optionalText(body.notes),
  };
}

export function inflationRow(body: Row, uid: string, now: Date): Row {
  if (typeof body.month !== 'string' || !/^\d{4}-\d{2}$/.test(body.month)) throw new Invalid();
  const month = calendarDate(`${body.month}-01`);
  if (month > lagosToday(now)) throw new Invalid();
  const pct = optionalNumber(body.headline_pct, 500);
  if (pct === null) throw new Invalid();
  return {
    month,
    headline_pct: pct,
    source_url: httpsUrl(body.source_url),
    checked_at: checkedAt(body.checked_on, now),
    updated_by: uid,
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fail = (status: number, code: string) => json(status, { error: code });

const found = (row: Row | null) => (row ? json(200, { row }) : fail(404, 'not_found'));

async function route(action: unknown, body: Row, uid: string, deps: Deps): Promise<Response> {
  const { store } = deps;
  const now = deps.now();
  switch (action) {
    case 'list':
      return json(200, await store.listAll());
    case 'save_provider': {
      const id = body.id === undefined || body.id === null ? null : uuid(body.id);
      return found(await store.saveProvider(id, providerFields(body)));
    }
    case 'save_product': {
      // A product's category is fixed once it exists, because its rate depends on it.
      const fields = productFields(body);
      if (body.id !== undefined && body.id !== null) return found(await store.saveProduct(uuid(body.id), fields));
      return found(await store.saveProduct(null, {
        ...fields,
        provider_id: uuid(body.provider_id),
        category: oneOf(body.category, CATEGORIES),
      }));
    }
    case 'set_provider_status':
      return found(await store.setStatus('providers', uuid(body.id), oneOf(body.status, STATUSES) as Status));
    case 'set_product_status':
      return found(await store.setStatus('products', uuid(body.id), oneOf(body.status, STATUSES) as Status));
    case 'save_rate': {
      const category = await store.productCategory(uuid(body.product_id));
      if (!category) return fail(404, 'not_found');
      return json(200, { row: await store.saveRate(rateRow(body, category, uid, now)) });
    }
    case 'add_check':
      return json(200, { row: await store.addCheck(checkRow(body, uid, now)) });
    case 'save_inflation':
      return json(200, { row: await store.saveInflation(inflationRow(body, uid, now)) });
    default:
      return fail(400, 'invalid_request');
  }
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
    if (caller.isAnonymous) return fail(403, 'forbidden');

    // If admin status can't be confirmed, stop: this function can change what
    // every user sees.
    let admin: boolean;
    try {
      admin = await deps.isAdmin(caller.uid, token);
    } catch {
      deps.logError('admin_check_failed');
      return fail(503, 'unavailable');
    }
    if (!admin) return fail(403, 'forbidden');

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail(413, 'too_large');

    let body: unknown;
    try { body = JSON.parse(raw); } catch { return fail(400, 'invalid_request'); }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'invalid_request');

    try {
      return await route((body as Row).action, body as Row, caller.uid, deps);
    } catch (err) {
      if (err instanceof Invalid) return fail(400, 'invalid_request');
      if (err instanceof StoreError) return fail(err.code === 'duplicate' ? 409 : 400, err.code);
      deps.logError('store_failed');
      return fail(503, 'unavailable');
    }
  };
}
