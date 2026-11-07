import AsyncStorage from './dataStore';
import { isForeign, nairaIncome, nairaRatesFromUsd } from './currency';

// Market exchange rates, kept on the phone so foreign amounts still convert offline.
// { rates: { USD: 1348.02, ... }, fetchedAt, source }
const RATES_KEY = 'finsight_fx_rates';
export const WALLETS_KEY = 'finsight_wallets';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';
const SOURCE_URL = 'https://open.er-api.com/v6/latest/USD';
const TIMEOUT_MS = 12000;
// Rates are refreshed at most this often; the server updates them once a day.
const REFRESH_MS = 6 * 60 * 60 * 1000;

async function getJson(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// FinSight's own daily rates first. If they can't be read, the same public source
// the server uses, so a missing server never leaves foreign money unconverted.
async function fetchMarketRates() {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const rows = await getJson(`${SUPABASE_URL}/rest/v1/fx_rates?select=currency,ngn_per_unit,fetched_at`,
        { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` });
      if (Array.isArray(rows) && rows.length) {
        return {
          rates: Object.fromEntries(rows.map(r => [r.currency, Number(r.ngn_per_unit)])),
          fetchedAt: rows.map(r => r.fetched_at).sort().pop(),
          source: 'FinSight daily market rates',
        };
      }
    } catch {
      // Falls through to the public source.
    }
  }
  const body = await getJson(SOURCE_URL);
  const rates = nairaRatesFromUsd(body?.rates);
  if (!Object.keys(rates).length) throw new Error('No usable rates');
  return { rates, fetchedAt: new Date().toISOString(), source: 'open.er-api.com' };
}

export async function loadRates() {
  try {
    const raw = await AsyncStorage.getItem(RATES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The saved rates, refreshed when they're old. Never throws: without a network the
// last saved rates are used, or null if there have never been any.
export async function currentRates({ force = false } = {}) {
  const saved = await loadRates();
  const fresh = saved?.fetchedAt && Date.now() - new Date(saved.fetchedAt).getTime() < REFRESH_MS;
  if (saved && fresh && !force) return saved;
  try {
    const next = await fetchMarketRates();
    await AsyncStorage.setItem(RATES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return saved;
  }
}

export async function loadWallets() {
  try {
    const raw = await AsyncStorage.getItem(WALLETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveWallets(wallets) {
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
}

// For someone paid in another currency: the naira value of their income follows
// the rate, so every screen that uses user.income stays right. Returns the updated
// user, or null when nothing changed.
export async function refreshForeignIncome(user) {
  if (!isForeign(user?.incomeCurrency) || !(Number(user?.incomeForeign) > 0)) return null;
  const saved = await currentRates();
  const naira = nairaIncome(user, saved?.rates);
  if (!naira || naira === Number(user.income)) return null;
  const updated = { ...user, income: naira };
  await AsyncStorage.setItem('finsight_user', JSON.stringify(updated));
  return updated;
}
