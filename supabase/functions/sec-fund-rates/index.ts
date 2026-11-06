import * as XLSX from 'npm:xlsx@0.18.5';
import { createHandler } from './handler.ts';
import { createStore } from './services.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const MAX_REPORT_BYTES = 5 * 1024 * 1024;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'FinSight fund rates (finsight)' } });
  if (!res.ok) throw new Error(`page returned ${res.status}`);
  return await res.text();
}

// Reads the "Weekly Valuation" sheet as rows of cells.
async function readReport(url: string): Promise<unknown[][]> {
  const res = await fetch(url, { headers: { 'User-Agent': 'FinSight fund rates (finsight)' } });
  if (!res.ok) throw new Error(`report returned ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_REPORT_BYTES) throw new Error('report too large');
  const book = XLSX.read(bytes, { type: 'array' });
  const sheet = book.Sheets['Weekly Valuation'] ?? book.Sheets[book.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
}

const supabaseUrl = required('SUPABASE_URL');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');

// The secret lives in the database vault; only the service role may ask about it.
async function checkSecret(candidate: string): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_sec_import_secret`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate }),
  });
  return res.ok && (await res.json()) === true;
}

Deno.serve(createHandler({
  checkSecret,
  fetchText,
  readReport,
  store: createStore(fetch, supabaseUrl, serviceKey),
  logError: (event, detail) => console.error(JSON.stringify({ event, detail })),
}));
