import type { Decision, Fund, Store } from './handler.ts';

type Fetch = typeof fetch;
type Row = Record<string, unknown>;

const keyTerm = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `Yield reported to the SEC for the week ended ${label}. Past yields are not guaranteed.`;
};

// Writes go through the service role, the only role that can change the catalogue.
export function createStore(fetchFn: Fetch, supabaseUrl: string, serviceKey: string): Store {
  async function call(path: string, method = 'GET', body?: unknown): Promise<Row[]> {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`store returned ${res.status}`);
    return await res.json() as Row[];
  }

  return {
    async listFunds(): Promise<Fund[]> {
      const products = await call('products?category=eq.fund&status=eq.published&select=id,name,rates(rate_min_pct,checked_at)');
      return products.map(p => {
        const rate = (p.rates as Row[] | null)?.[0] ?? (p.rates as Row | null);
        return {
          productId: String(p.id),
          name: String(p.name),
          currentPct: rate && rate.rate_min_pct !== null && rate.rate_min_pct !== undefined ? Number(rate.rate_min_pct) : null,
          checkedAt: rate?.checked_at ? String(rate.checked_at) : null,
        };
      });
    },

    // The rates_record_history trigger keeps the previous figure.
    async applyRate(productId: string, pct: number, sourceUrl: string, reportDate: string) {
      await call(`rates?product_id=eq.${productId}&category=eq.fund`, 'PATCH', {
        rate_min_pct: pct,
        source_url: sourceUrl,
        checked_at: `${reportDate}T11:00:00Z`,
        updated_by: 'sec-import',
      });
      await call(`products?id=eq.${productId}`, 'PATCH', { key_terms: [keyTerm(reportDate)] });
    },

    async logDecisions(reportDate: string, sourceUrl: string, decisions: Decision[]) {
      if (!decisions.length) return;
      await call('fund_rate_imports', 'POST', decisions.map(d => ({
        product_id: d.productId,
        report_date: reportDate,
        source_url: sourceUrl,
        proposed_pct: d.pct ?? null,
        status: d.status === 'apply' ? 'applied' : d.status,
        reason: d.reason ?? null,
      })));
    },
  };
}
