// Daily market exchange rates into naira, for converting foreign money in the app.
// Pure logic lives here so it can be tested; index.ts does the fetching.

// open.er-api.com, free and without a key. For naira it reports the market rate
// (the NFEM, where the naira has floated since 2023).
export const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
export const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD'] as const;

// A rate outside this range, or a move bigger than this in a day, is more likely a
// bad reading than a real change, so it isn't applied.
export const NGN_MIN = 100;
export const NGN_MAX = 20000;
export const MAX_DAILY_MOVE = 0.15;

export type Decision = { currency: string; status: 'apply' | 'held'; ngnPerUnit?: number; reason?: string };

// rates: units per 1 USD, as the API gives them. previous: naira per unit now stored.
export function planRates(rates: Record<string, unknown>, previous: Record<string, number>): Decision[] {
  const ngn = Number(rates.NGN);
  return CURRENCIES.map(currency => {
    const perUsd = currency === 'USD' ? 1 : Number(rates[currency]);
    if (!(ngn > 0) || !(perUsd > 0)) return { currency, status: 'held', reason: 'Missing from the source' };
    const ngnPerUnit = Math.round((ngn / perUsd) * 100) / 100;
    if (ngnPerUnit < NGN_MIN || ngnPerUnit > NGN_MAX) {
      return { currency, status: 'held', ngnPerUnit, reason: `₦${ngnPerUnit} is outside ₦${NGN_MIN}-₦${NGN_MAX}` };
    }
    const before = previous[currency];
    if (before > 0 && Math.abs(ngnPerUnit - before) / before > MAX_DAILY_MOVE) {
      return { currency, status: 'held', ngnPerUnit, reason: `Moved more than ${MAX_DAILY_MOVE * 100}% from ₦${before}` };
    }
    return { currency, status: 'apply', ngnPerUnit };
  });
}

export type Store = {
  current(): Promise<Record<string, number>>;
  apply(decisions: Decision[], fetchedAt: string): Promise<void>;
  log(decisions: Decision[]): Promise<void>;
};

type Deps = {
  checkSecret(candidate: string): Promise<boolean>;
  fetchRates(): Promise<{ result?: string; rates?: Record<string, unknown> }>;
  store: Store;
  logError(event: string, detail?: string): void;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Called by the database's scheduled job.
export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'method' });
    const candidate = req.headers.get('x-cron-secret') || '';
    if (!candidate || !(await deps.checkSecret(candidate).catch(() => false))) return json(401, { error: 'unauthorised' });
    try {
      const body = await deps.fetchRates();
      if (body.result !== 'success' || !body.rates) {
        deps.logError('fx_source_failed');
        return json(502, { error: 'source_failed' });
      }
      const decisions = planRates(body.rates, await deps.store.current());
      const applied = decisions.filter(d => d.status === 'apply');
      if (applied.length) await deps.store.apply(applied, new Date().toISOString());
      await deps.store.log(decisions);
      return json(200, { applied: applied.length, held: decisions.length - applied.length });
    } catch (e) {
      deps.logError('fx_import_failed', e instanceof Error ? e.message : String(e));
      return json(500, { error: 'failed' });
    }
  };
}
