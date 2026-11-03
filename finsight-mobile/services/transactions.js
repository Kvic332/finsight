import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finsight_transactions';

export async function loadTransactions() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function save(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export async function addTransaction({ desc, amount, type, cat }) {
  const list = await loadTransactions();
  const tx = {
    id: Date.now().toString(),
    desc, amount, type, cat,
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
