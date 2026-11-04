// Stands in for the catalogue in the design preview. Every provider and rate here
// is made up. Add ?catalog=empty or ?catalog=error to the address to see those states.
const daysAgo = days => new Date(Date.now() - days * 86400000).toISOString();

const badge = (regulator, days = 3) => ({
  regulator, licence_type: null, licence_number: null, source_url: 'https://example.com/register', checked_at: daysAgo(days),
});

function sample(id, category, provider, product, rate, terms = {}, badges = [badge(category === 'fund' ? 'SEC' : category === 'savings' ? 'CBN' : 'FCCPC')]) {
  const scale = { annual: 1, monthly: 12, daily: 365 }[rate.period];
  return {
    product_id: id,
    category,
    provider_id: provider,
    provider_name: `${provider} (sample)`,
    product_name: product,
    logo_url: null,
    link_url: 'https://example.com',
    is_referral: false,
    currency: 'NGN',
    min_amount: null,
    max_amount: null,
    min_tenor_days: null,
    max_tenor_days: null,
    fees: null,
    key_terms: [],
    rate_min_pct: rate.min,
    rate_max_pct: rate.max ?? null,
    rate_period: rate.period,
    annual_min_pct: scale ? rate.min * scale : null,
    annual_max_pct: scale ? (rate.max ?? rate.min) * scale : null,
    buy_rate: null,
    sell_rate: null,
    rate_source_url: 'https://example.com/rates',
    rate_checked_at: daysAgo(rate.age ?? 2),
    badges,
    ...terms,
  };
}

const SAMPLE = [
  sample('l1', 'loan', 'Provider A', 'Salary loan', { min: 3.5, max: 12, period: 'monthly' }, {
    min_amount: 10000, max_amount: 500000, min_tenor_days: 30, max_tenor_days: 180, fees: '1% processing fee', key_terms: ['No collateral', 'Paid monthly'], is_referral: true,
  }),
  sample('l2', 'loan', 'Provider B', 'Quick loan', { min: 5, max: 30, period: 'monthly' }, {
    min_amount: 2000, max_amount: 100000, min_tenor_days: 7, max_tenor_days: 60,
  }),
  sample('l3', 'loan', 'Provider C Bank', 'Personal loan', { min: 28, period: 'annual' }, {
    max_amount: 5000000, min_tenor_days: 90, max_tenor_days: 720, fees: '₦5,000 management fee',
  }, [badge('CBN')]),
  sample('l4', 'loan', 'Provider D', 'Short loan', { min: 10, period: 'per_term' }, { max_amount: 50000, max_tenor_days: 14 }),
  sample('s1', 'savings', 'Provider E Bank', 'Fixed deposit', { min: 12, max: 18.5, period: 'annual' }, {
    min_amount: 50000, min_tenor_days: 30, max_tenor_days: 365,
  }),
  sample('s2', 'savings', 'Provider F MFB', 'Target savings', { min: 16, period: 'annual', age: 41 }, { min_amount: 1000 }),
  sample('f1', 'fund', 'Provider G', 'Money market fund', { min: 19.2, period: 'annual' }, { min_amount: 5000, key_terms: ['Returns can change'] }),
  sample('f2', 'fund', 'Provider H', 'Dollar fund', { min: 6.5, period: 'annual' }, { currency: 'USD', min_amount: 100 }),
];

export async function fetchInflation() {
  return { month: '2026-09-01', headline_pct: 14.63, source_url: 'https://example.com/cpi' };
}

export async function fetchListings() {
  const mode = new URLSearchParams(window.location.search).get('catalog');
  if (mode === 'error') throw new Error('Preview error');
  return mode === 'empty' ? [] : SAMPLE;
}
