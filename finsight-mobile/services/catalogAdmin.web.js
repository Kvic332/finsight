// Stands in for the server in the design preview. Everything is made up and
// disappears on reload, and nothing is sent anywhere.
import { listingBlockers, todayInLagos } from './catalogRules';

let nextId = 1;
const newId = () => `preview-${nextId++}`;
const stamp = () => new Date().toISOString();

const db = {
  providers: [{ id: 'preview-provider', name: 'Sample Lender (preview)', website_url: 'https://example.com', logo_url: null, status: 'draft' }],
  products: [{
    id: 'preview-product', provider_id: 'preview-provider', category: 'loan', name: 'Sample quick loan', currency: 'NGN',
    min_amount: 5000, max_amount: 200000, min_tenor_days: 14, max_tenor_days: 90, fees: null, key_terms: [], referral_url: null, status: 'draft',
  }],
  rates: [],
  checks: [],
};

function listed() {
  return db.products
    .filter(product => !listingBlockers({
      provider: db.providers.find(p => p.id === product.provider_id),
      product,
      rate: db.rates.find(r => r.product_id === product.id),
      checks: db.checks.filter(c => c.provider_id === product.provider_id),
    }).length)
    .map(product => product.id);
}

function upsert(table, id, fields, defaults) {
  if (id) {
    const row = db[table].find(r => r.id === id);
    Object.assign(row, fields);
    return row;
  }
  const row = { id: newId(), status: 'draft', ...defaults, ...fields };
  db[table].push(row);
  return row;
}

export async function catalogAction(action, { id, ...payload } = {}) {
  switch (action) {
    case 'list':
      return { ...db, listed: listed() };
    case 'save_provider':
      return { row: upsert('providers', id, payload) };
    case 'save_product':
      return { row: upsert('products', id, payload) };
    case 'set_provider_status':
      return { row: upsert('providers', id, { status: payload.status }) };
    case 'set_product_status':
      return { row: upsert('products', id, { status: payload.status }) };
    case 'save_rate': {
      const { checked_on, ...rate } = payload;
      db.rates = db.rates.filter(r => r.product_id !== rate.product_id);
      const row = { ...rate, checked_at: checked_on === todayInLagos() ? stamp() : `${checked_on}T00:00:00+01:00` };
      db.rates.push(row);
      return { row };
    }
    case 'add_check': {
      const { checked_on, expires_on, ...check } = payload;
      const row = {
        ...check,
        id: newId(),
        checked_at: checked_on === todayInLagos() ? stamp() : `${checked_on}T00:00:00+01:00`,
        expires_at: expires_on ? `${expires_on}T23:59:59+01:00` : null,
      };
      db.checks.unshift(row);
      return { row };
    }
    default:
      throw new Error('Unknown action');
  }
}
