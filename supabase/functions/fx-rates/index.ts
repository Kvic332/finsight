import { createHandler, RATES_URL, type Decision } from './handler.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const supabaseUrl = required('SUPABASE_URL');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

// The same scheduled-job secret as sec-fund-rates, kept in the database vault.
async function checkSecret(candidate: string): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_sec_import_secret`, {
    method: 'POST', headers, body: JSON.stringify({ candidate }),
  });
  return res.ok && (await res.json()) === true;
}

async function fetchRates() {
  const res = await fetch(RATES_URL, { headers: { 'User-Agent': 'FinSight exchange rates' } });
  if (!res.ok) throw new Error(`source returned ${res.status}`);
  return await res.json();
}

const store = {
  async current() {
    const res = await fetch(`${supabaseUrl}/rest/v1/fx_rates?select=currency,ngn_per_unit`, { headers });
    if (!res.ok) throw new Error(`read returned ${res.status}`);
    const rows = await res.json() as { currency: string; ngn_per_unit: number }[];
    return Object.fromEntries(rows.map(r => [r.currency, Number(r.ngn_per_unit)]));
  },
  async apply(decisions: Decision[], fetchedAt: string) {
    const rows = decisions.map(d => ({ currency: d.currency, ngn_per_unit: d.ngnPerUnit, source: 'open.er-api.com', fetched_at: fetchedAt }));
    const res = await fetch(`${supabaseUrl}/rest/v1/fx_rates?on_conflict=currency`, {
      method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`write returned ${res.status}`);
  },
  async log(decisions: Decision[]) {
    const rows = decisions.map(d => ({
      currency: d.currency, ngn_per_unit: d.ngnPerUnit ?? null, status: d.status === 'apply' ? 'applied' : 'held', reason: d.reason ?? null,
    }));
    await fetch(`${supabaseUrl}/rest/v1/fx_rate_imports`, { method: 'POST', headers, body: JSON.stringify(rows) });
  },
};

Deno.serve(createHandler({
  checkSecret,
  fetchRates,
  store,
  logError: (event, detail) => console.error(JSON.stringify({ event, detail })),
}));
