import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp, increment,
  collection, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';

// ── Auth ──────────────────────────────────────────────────────────────────────

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signUp(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;

  // Create user document in Firestore
  await setDoc(doc(db, 'users', uid), {
    name,
    email,
    createdAt: serverTimestamp(),
    lastSeen:  serverTimestamp(),
    analytics: {
      dashboard_views:        0,
      transactions_added:     0,
      budget_interactions:    0,
      savings_interactions:   0,
      aria_messages:          0,
      sms_imports:            0,
      investments_views:      0,
      settings_interactions:  0,
    },
    finscore:    { current: 0, history: [] },
    xp:          { total: 0, level: 1 },
    lastBackup:  null,
  });

  return cred.user;
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  // Update last seen
  await updateDoc(doc(db, 'users', cred.user.uid), {
    lastSeen: serverTimestamp(),
  });
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export function currentUser() {
  return auth.currentUser;
}

// ── Analytics tracking ────────────────────────────────────────────────────────
// Call this whenever a user interacts with a screen or feature.
// fieldName must be one of the analytics keys in the user document.

export async function trackEvent(fieldName) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      [`analytics.${fieldName}`]: increment(1),
      lastSeen: serverTimestamp(),
    });
  } catch { /* offline — silently ignore */ }
}

// ── FinScore sync ─────────────────────────────────────────────────────────────
export async function syncFinScore(score) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const ref   = doc(db, 'users', user.uid);
    const snap  = await getDoc(ref);
    const existing = snap.exists() ? (snap.data().finscore?.history || []) : [];

    const today = new Date().toISOString().slice(0, 10);
    // Only add one entry per day
    const filtered = existing.filter(e => e.date !== today);
    const history  = [...filtered, { date: today, score }].slice(-30); // keep last 30 days

    await updateDoc(ref, {
      'finscore.current': score,
      'finscore.history': history,
    });
  } catch { /* offline */ }
}

// ── XP sync ───────────────────────────────────────────────────────────────────
export async function syncXP(totalXP, level) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      'xp.total': totalXP,
      'xp.level': level,
    });
  } catch { /* offline */ }
}

// ── Full backup ───────────────────────────────────────────────────────────────
// Uploads all local AsyncStorage data to Firestore under the user's document.
export async function backupToCloud() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const keys = [
    'finsight_transactions',
    'finsight_budgets',
    'finsight_savings',
    'finsight_user',
    'finsight_xp',
    'finsight_xp_log',
    'finsight_investments',
  ];

  const pairs = await AsyncStorage.multiGet(keys);
  const backup = {};
  for (const [k, v] of pairs) {
    if (v !== null) backup[k] = v; // stored as raw strings
  }

  await updateDoc(doc(db, 'users', user.uid), {
    backup,
    lastBackup: serverTimestamp(),
  });

  return Object.keys(backup).length;
}

// ── Full restore ──────────────────────────────────────────────────────────────
// Downloads cloud backup and writes it back to AsyncStorage.
export async function restoreFromCloud() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) throw new Error('No cloud data found for this account');

  const { backup, lastBackup } = snap.data();
  if (!backup || Object.keys(backup).length === 0) {
    throw new Error('No backup data found. Back up first from your original device.');
  }

  const pairs = Object.entries(backup); // [[key, value], ...]
  await AsyncStorage.multiSet(pairs);

  return {
    count: pairs.length,
    date: lastBackup?.toDate?.()?.toLocaleDateString('en-NG') || 'Unknown',
  };
}

// ── Get user profile from Firestore ──────────────────────────────────────────
export async function getCloudProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data() : null;
}

// ── Check if current user is admin ───────────────────────────────────────────
export async function checkIsAdmin() {
  try {
    const profile = await getCloudProfile();
    return profile?.isAdmin === true;
  } catch { return false; }
}

// ── Live listener for all users (admin only) ──────────────────────────────────
// Returns an unsubscribe function. Calls onChange(users[]) on every update.
export function subscribeAllUsers(onChange) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onChange(users);
  }, () => onChange([]));
}
