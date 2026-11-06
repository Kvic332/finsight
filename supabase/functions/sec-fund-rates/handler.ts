// Weekly money market fund yields from the SEC's published valuation report.
// Pure logic lives here so it can be tested; index.ts does the fetching.

export const SEC_NAV_PAGE =
  'https://sec.gov.ng/for-operators/keep-track-of-capital-market-data/net-asset-value-data/weekly-net-asset-value-for-cis/2026-weekly-nav-for-cis/';
const SEC_ORIGIN = 'https://sec.gov.ng';

// A yield outside this range, or a move bigger than this in a week, is more likely a
// misread than a real change, so it waits for a person.
export const YIELD_MIN_PCT = 5;
export const YIELD_MAX_PCT = 40;
export const MAX_WEEKLY_MOVE = 3;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export type ReportLink = { url: string; date: string };

// The newest "Net_Asset_Value_and_Unit_Price_as_at_23rd_October_2026.xlsx" link.
export function latestReportLink(html: string): ReportLink | null {
  const pattern = /(?:https:\/\/sec\.gov\.ng)?(\/documents\/\d+\/Net_Asset_Value_and_Unit_Price_as_at_(\d{1,2})(?:st|nd|rd|th)_([A-Za-z]+)_(\d{4})\.xlsx)/gi;
  let best: ReportLink | null = null;
  for (const m of html.matchAll(pattern)) {
    const month = MONTHS.indexOf(m[3].toLowerCase());
    if (month < 0) continue;
    const date = `${m[4]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    if (!best || date > best.date) best = { url: `${SEC_ORIGIN}${m[1]}`, date };
  }
  return best;
}

// Fund name to this week's yield in percent. The report shows last week's and this
// week's figures side by side; this week's "Yield (WTD)" is the second such column.
export function fundYields(rows: unknown[][]): Map<string, number> {
  const yields = new Map<string, number>();
  const headerIndex = rows.findIndex(r => r.some(c => /yield\s*\(wtd\)/i.test(String(c ?? ''))));
  if (headerIndex < 0) return yields;
  const header = rows[headerIndex].map(c => String(c ?? ''));
  const columns = header.map((h, i) => (/yield\s*\(wtd\)/i.test(h) ? i : -1)).filter(i => i >= 0);
  const fundCol = header.findIndex(h => /^fund$/i.test(h.trim()));
  if (columns.length < 2 || fundCol < 0) return yields;
  for (const row of rows.slice(headerIndex + 1)) {
    const name = String(row[fundCol] ?? '').trim();
    const value = Number(row[columns[1]]);
    if (name && Number.isFinite(value) && value > 0) yields.set(name.toLowerCase(), Math.round(value * 10000) / 100);
  }
  return yields;
}

export type Fund = { productId: string; name: string; currentPct: number | null; checkedAt: string | null };
export type Decision = { productId: string; name: string; status: 'apply' | 'held' | 'unmatched' | 'current'; pct?: number; reason?: string };

export function planFundUpdates(funds: Fund[], yields: Map<string, number>, reportDate: string): Decision[] {
  return funds.map(fund => {
    if (fund.checkedAt && fund.checkedAt.slice(0, 10) >= reportDate) return { productId: fund.productId, name: fund.name, status: 'current' };
    const pct = yields.get(fund.name.trim().toLowerCase());
    if (pct === undefined) return { productId: fund.productId, name: fund.name, status: 'unmatched', reason: 'Not found by name in the SEC report' };
    if (pct < YIELD_MIN_PCT || pct > YIELD_MAX_PCT) {
      return { productId: fund.productId, name: fund.name, status: 'held', pct, reason: `Yield ${pct}% is outside ${YIELD_MIN_PCT}-${YIELD_MAX_PCT}%` };
    }
    if (fund.currentPct !== null && Math.abs(pct - fund.currentPct) > MAX_WEEKLY_MOVE) {
      return { productId: fund.productId, name: fund.name, status: 'held', pct, reason: `Moved more than ${MAX_WEEKLY_MOVE} points from ${fund.currentPct}%` };
    }
    return { productId: fund.productId, name: fund.name, status: 'apply', pct };
  });
}

export type Store = {
  listFunds(): Promise<Fund[]>;
  applyRate(productId: string, pct: number, sourceUrl: string, reportDate: string): Promise<void>;
  logDecisions(reportDate: string, sourceUrl: string, decisions: Decision[]): Promise<void>;
};

type Deps = {
  // Whether a request carries the scheduled job's secret, kept in the database vault.
  checkSecret(candidate: string): Promise<boolean>;
  fetchText(url: string): Promise<string>;
  readReport(url: string): Promise<unknown[][]>;
  store: Store;
  logError(event: string, detail?: string): void;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Called by the database's scheduled job. Safe to run often: once the funds match
// the newest report it does nothing.
export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'method' });
    const candidate = req.headers.get('x-cron-secret') || '';
    if (!candidate || !(await deps.checkSecret(candidate).catch(() => false))) return json(401, { error: 'unauthorised' });
    try {
      const link = latestReportLink(await deps.fetchText(SEC_NAV_PAGE));
      if (!link) {
        deps.logError('sec_report_not_found');
        return json(502, { error: 'report_not_found' });
      }
      const funds = await deps.store.listFunds();
      if (funds.every(f => f.checkedAt && f.checkedAt.slice(0, 10) >= link.date)) return json(200, { report: link.date, applied: 0, held: 0, upToDate: true });
      const decisions = planFundUpdates(funds, fundYields(await deps.readReport(link.url)), link.date);
      for (const d of decisions) {
        if (d.status === 'apply' && d.pct !== undefined) await deps.store.applyRate(d.productId, d.pct, link.url, link.date);
      }
      await deps.store.logDecisions(link.date, link.url, decisions.filter(d => d.status !== 'current'));
      return json(200, {
        report: link.date,
        applied: decisions.filter(d => d.status === 'apply').length,
        held: decisions.filter(d => d.status === 'held').length,
        unmatched: decisions.filter(d => d.status === 'unmatched').length,
      });
    } catch (e) {
      deps.logError('sec_import_failed', e instanceof Error ? e.message : String(e));
      return json(500, { error: 'failed' });
    }
  };
}
