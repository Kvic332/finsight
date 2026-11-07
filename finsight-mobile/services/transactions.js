import AsyncStorage from './dataStore';

const KEY = 'finsight_transactions';

export async function loadTransactions() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function save(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export const saveTransactions = save;

// Foreign money also carries currency, originalAmount, fxRate, fxSource and an
// optional walletId; amount is always the naira value.
const FOREIGN_KEYS = ['currency', 'originalAmount', 'fxRate', 'fxSource', 'walletId'];

export async function addTransaction({ desc, amount, type, cat, ...rest }) {
  const list = await loadTransactions();
  const foreign = Object.fromEntries(FOREIGN_KEYS.filter(k => rest[k] !== undefined).map(k => [k, rest[k]]));
  const tx = {
    id: Date.now().toString(),
    desc, amount, type, cat,
    ...foreign,
    source: 'manual',
    date: new Date().toLocaleDateString('en-NG'),
  };
  await save([tx, ...list]);
  return tx;
}

export async function updateTransaction(id, changes) {
  const list = await loadTransactions();
  return save(list.map(t => (t.id === id ? { ...t, ...changes } : t)));
}

export async function deleteTransaction(id) {
  const list = await loadTransactions();
  return save(list.filter(t => t.id !== id));
}
