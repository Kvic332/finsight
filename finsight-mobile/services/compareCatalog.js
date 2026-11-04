const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';
const TIMEOUT_MS = 15000;

// Reads the view that shows only verified, sourced products. The key is the
// public one, which can't write anything or see internal notes. FX joins this
// list once its data is checked.
export async function fetchListings() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('The catalogue is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/compare_listings?select=*&category=in.(loan,savings,fund)`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`The catalogue returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
