import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { deleteSecure, getSecure, setSecure } from './secureStorage';
import {
  base64ToBytes, bytesToBase64, decryptText, encryptText, isEncrypted, KEY_BYTES, NONCE_BYTES,
} from './dataCipher';

// Same interface as AsyncStorage, but money and profile data is encrypted before
// it's written. Everything else, such as the theme, passes straight through.
const SENSITIVE = new Set([
  'finsight_transactions', 'finsight_user', 'finsight_budgets', 'finsight_savings', 'finsight_investments',
  'finsight_debts', 'finsight_payee_rules', 'finsight_wallets',
]);
const KEY_NAME = 'finsight_data_key';

export const DATA_LOCKED = 'DATA_LOCKED';

let cachedKey = null;

async function loadKey() {
  if (cachedKey) return cachedKey;
  const stored = await getSecure(KEY_NAME);
  if (stored) cachedKey = base64ToBytes(stored);
  return cachedKey;
}

async function loadOrCreateKey() {
  const existing = await loadKey();
  if (existing) return existing;
  await setSecure(KEY_NAME, bytesToBase64(Crypto.getRandomBytes(KEY_BYTES)));
  return loadKey();
}

// Returns text that's safe to store. If encryption fails or can't be read back,
// the data is kept unencrypted: losing someone's records would be far worse.
async function seal(value) {
  try {
    const key = await loadOrCreateKey();
    const sealed = encryptText(key, Crypto.getRandomBytes(NONCE_BYTES), value);
    return decryptText(key, sealed) === value ? sealed : value;
  } catch (e) {
    return value;
  }
}

function lockedError() {
  const error = new Error('Stored data could not be decrypted');
  error.code = DATA_LOCKED;
  return error;
}

async function open(name, raw) {
  if (raw === null || raw === undefined || !SENSITIVE.has(name)) return raw;
  if (!isEncrypted(raw)) {
    // Written by an older version: upgrade it in place.
    const sealed = await seal(raw);
    if (sealed !== raw) await AsyncStorage.setItem(name, sealed);
    return raw;
  }
  const key = await loadKey().catch(() => null);
  if (!key) throw lockedError();
  try {
    return decryptText(key, raw);
  } catch (e) {
    throw lockedError();
  }
}

const dataStore = {
  async getItem(name) {
    return open(name, await AsyncStorage.getItem(name));
  },
  async setItem(name, value) {
    return AsyncStorage.setItem(name, SENSITIVE.has(name) ? await seal(value) : value);
  },
  removeItem: name => AsyncStorage.removeItem(name),
  getAllKeys: () => AsyncStorage.getAllKeys(),
  multiRemove: names => AsyncStorage.multiRemove(names),
  async multiGet(names) {
    const pairs = await AsyncStorage.multiGet(names);
    return Promise.all(pairs.map(async ([name, raw]) => [name, await open(name, raw)]));
  },
  async multiSet(pairs) {
    const sealed = await Promise.all(pairs.map(async ([name, value]) => [name, SENSITIVE.has(name) ? await seal(value) : value]));
    return AsyncStorage.multiSet(sealed);
  },
};

export async function deleteDataKey() {
  cachedKey = null;
  await deleteSecure(KEY_NAME);
}

export default dataStore;
