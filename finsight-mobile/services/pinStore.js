import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { deleteSecure, getSecure, setSecure } from './secureStorage';
import { deleteDataKey } from './dataStore';
import { nextAttemptState, secondsLeft } from './pinPolicy';

const PIN_KEY = 'finsight_pin_hash';
const ATTEMPTS_KEY = 'finsight_pin_attempts';
// Older versions saved the PIN itself in plain storage.
const LEGACY_KEY = 'finsight_pin';

function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function digest(salt, pin) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

async function writePin(pin) {
  const salt = toHex(Crypto.getRandomBytes(16));
  const hash = await digest(salt, pin);
  await setSecure(PIN_KEY, JSON.stringify({ salt, hash }));
}

async function migrateLegacyPin() {
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacy) return;
  await writePin(legacy);
  await AsyncStorage.removeItem(LEGACY_KEY);
}

async function readAttempts() {
  const raw = await getSecure(ATTEMPTS_KEY);
  return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
}

// Throws if storage can't be read. Callers must treat that as locked, never as
// "no PIN set".
export async function hasPin() {
  await migrateLegacyPin();
  return !!(await getSecure(PIN_KEY));
}

export async function savePin(pin) {
  await writePin(pin);
  await deleteSecure(ATTEMPTS_KEY);
  await AsyncStorage.removeItem(LEGACY_KEY);
}

export async function removePin() {
  await deleteSecure(PIN_KEY);
  await deleteSecure(ATTEMPTS_KEY);
  await AsyncStorage.multiRemove([LEGACY_KEY, 'finsight_biometric']);
}

export async function lockWaitSeconds() {
  return secondsLeft((await readAttempts()).lockedUntil);
}

// Returns { ok } or { ok: false, waitSeconds }.
export async function checkPin(pin) {
  await migrateLegacyPin();
  const state = await readAttempts();
  const wait = secondsLeft(state.lockedUntil);
  if (wait) return { ok: false, waitSeconds: wait };

  const stored = await getSecure(PIN_KEY);
  if (!stored) return { ok: false, waitSeconds: 0 };
  const { salt, hash } = JSON.parse(stored);
  if ((await digest(salt, pin)) === hash) {
    await deleteSecure(ATTEMPTS_KEY);
    return { ok: true };
  }
  const next = nextAttemptState(state.attempts);
  await setSecure(ATTEMPTS_KEY, JSON.stringify(next));
  return { ok: false, waitSeconds: secondsLeft(next.lockedUntil) };
}

// Removes everything FinSight keeps on this phone.
export async function wipeAllData() {
  await removePin();
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('finsight_'));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  await deleteDataKey();
}
