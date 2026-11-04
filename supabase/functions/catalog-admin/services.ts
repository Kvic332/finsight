// The real implementations behind handler.ts.

import { StoreError, type Row, type Status, type Store } from './handler.ts';

// Firestore decides, using the caller's own token. Its rules let people read
// only their own admins document, which only the Firebase console can create.
export function createAdminChecker(fetchFn: typeof fetch, projectId: string) {
  return async (uid: string, token: string): Promise<boolean> => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return true;
    if (res.status === 403 || res.status === 404) return false;
    throw new Error(`admin check returned ${res.status}`);
  };
}

export function createStore(fetchFn: typeof fetch, supabaseUrl: string, serviceKey: string): Store {
  async function call(path: string, method = 'GET', body?: unknown, prefer?: string): Promise<Row[]> {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const { code } = await res.json().catch(() => ({ code: '' })) as { code?: string };
      if (code === '23505') throw new StoreError('duplicate');
      // Constraint failures, and values that don't fit a column.
      if (code?.startsWith('23') || code?.startsWith('22')) throw new StoreError('rejected');
      throw new Error(`store returned ${res.status}`);
    }
    return await res.json() as Row[];
  }

  const insert = async (table: string, row: Row) =>
    (await call(table, 'POST', row, 'return=representation'))[0];

  const update = async (table: string, id: string, fields: Row) =>
    (await call(`${table}?id=eq.${id}`, 'PATCH', fields, 'return=representation'))[0] ?? null;

  return {
    async listAll() {
      const [providers, products, rates, checks, listed] = await Promise.all([
        call('providers?select=*&order=name'),
        call('products?select=*&order=name'),
        call('rates?select=*'),
        call('verifications?select=*&order=checked_at.desc,created_at.desc'),
        call('compare_listings?select=product_id'),
      ]);
      return { providers, products, rates, checks, listed: listed.map(r => r.product_id) };
    },
    saveProvider: (id, fields) => (id ? update('providers', id, fields) : insert('providers', fields)),
    saveProduct: (id, fields) => (id ? update('products', id, fields) : insert('products', fields)),
    setStatus: (table, id, status: Status) => update(table, id, { status }),
    async productCategory(id) {
      const [row] = await call(`products?select=category&id=eq.${id}`);
      return row ? row.category as string : null;
    },
    async saveRate(row) {
      const [saved] = await call('rates?on_conflict=product_id', 'POST', row, 'resolution=merge-duplicates,return=representation');
      return saved;
    },
    addCheck: row => insert('verifications', row),
  };
}
