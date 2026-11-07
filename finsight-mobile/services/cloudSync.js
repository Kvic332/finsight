import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, increment, deleteField,
  collection, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import AsyncStorage from './dataStore';
import { auth, db } from './firebase';
import { hashText, shouldAutoBackup } from './autoBackupRules';

// ── Auth ──────────────────────────────────────────────────────────────────────
// ARIA signs people in anonymously for its usage limits (see ariaClient.js).
// That isn't a FinSight account, so everything here treats it as signed out.

const accountUser = user => (user && !user.isAnonymous ? user : null);

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, user => callback(accountUser(user)));
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
  return accountUser(auth.currentUser);
}

// Removes the backup, the profile and the login, in that order. The login goes
// last because the database needs it: if a step fails, trying again still works.
export async function deleteAccount(password) {
  const user = currentUser();
  if (!user) throw new Error('Not signed in');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  await deleteDoc(backupDoc(user.uid));
  await deleteDoc(doc(db, 'users', user.uid));
  await deleteUser(user);
  await AsyncStorage.removeItem(BACKUP_STATE_KEY);
}

// ── Analytics tracking ────────────────────────────────────────────────────────
// Call this whenever a user interacts with a screen or feature.
// fieldName must be one of the analytics keys in the user document.

export async function trackEvent(fieldName) {
  try {
    const user = currentUser();
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
    const user = currentUser();
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
    const user = currentUser();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      'xp.total': totalXP,
      'xp.level': level,
    });
  } catch { /* offline */ }
}

// ── Full backup ───────────────────────────────────────────────────────────────
const backupDoc = uid => doc(db, 'users', uid, 'private', 'backup');

const BACKUP_KEYS = [
  'finsight_transactions',
  'finsight_budgets',
  'finsight_savings',
  'finsight_user',
  'finsight_xp',
  'finsight_xp_log',
  'finsight_investments',
  'finsight_debts',
  'finsight_payee_rules',
  'finsight_wallets',
  'finsight_owed_to_me',
];

// This phone's record of its last backup or restore: { uid, at, hash }. Kept on
// the phone only, and cleared with everything else when the phone is wiped.
const BACKUP_STATE_KEY = 'finsight_backup_state';
const AUTO_BACKUP_KEY = 'finsight_auto_backup';

async function collectBackup() {
  const pairs = await AsyncStorage.multiGet(BACKUP_KEYS);
  const backup = {};
  for (const [k, v] of pairs) {
    if (v !== null) backup[k] = v; // stored as raw strings
  }
  return backup;
}

const backupHash = backup => hashText(JSON.stringify(BACKUP_KEYS.map(k => backup[k] ?? null)));

async function rememberBackup(uid, backup) {
  await AsyncStorage.setItem(BACKUP_STATE_KEY, JSON.stringify({ uid, at: Date.now(), hash: backupHash(backup) }));
}

export async function getBackupState() {
  try {
    return JSON.parse(await AsyncStorage.getItem(BACKUP_STATE_KEY) || 'null');
  } catch { return null; }
}

// Uploads all local AsyncStorage data to Firestore under the user's document.
export async function backupToCloud() {
  const user = currentUser();
  if (!user) throw new Error('Not signed in');

  const backup = await collectBackup();

  // Kept apart from the profile so that only the owner can ever read it. Also
  // clears the copy older versions stored on the profile, which admins can see.
  await setDoc(backupDoc(user.uid), { data: backup });
  await updateDoc(doc(db, 'users', user.uid), {
    backup: deleteField(),
    lastBackup: serverTimestamp(),
  });
  await rememberBackup(user.uid, backup);

  return Object.keys(backup).length;
}

// ── Automatic backup ──────────────────────────────────────────────────────────
export async function isAutoBackupOn() {
  return (await AsyncStorage.getItem(AUTO_BACKUP_KEY)) !== 'off';
}

export async function setAutoBackup(on) {
  await AsyncStorage.setItem(AUTO_BACKUP_KEY, on ? 'on' : 'off');
}

let autoRunning = false;
const AUTO_TIMEOUT_MS = 30000;

// Runs when the app opens or comes back. Backs up at most once a day, only if
// something changed, and only on a phone that has backed up or restored for this
// account before. Never throws: a failed automatic backup is tried again later.
export async function runAutoBackup() {
  if (autoRunning) return false;
  autoRunning = true;
  try {
    await auth.authStateReady();
    const user = currentUser();
    if (!user) return false;
    const [enabled, state, backup] = await Promise.all([isAutoBackupOn(), getBackupState(), collectBackup()]);
    if (!shouldAutoBackup({ enabled, uid: user.uid, state, hash: backupHash(backup) })) return false;
    // Without a connection Firestore can wait indefinitely, so give up after a while.
    await Promise.race([
      backupToCloud(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Backup timed out')), AUTO_TIMEOUT_MS)),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    autoRunning = false;
  }
}

// ── Full restore ──────────────────────────────────────────────────────────────
// Downloads cloud backup and writes it back to AsyncStorage.
export async function restoreFromCloud() {
  const user = currentUser();
  if (!user) throw new Error('Not signed in');

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) throw new Error('No cloud data found for this account');

  const { backup: legacyBackup, lastBackup } = snap.data();
  const privateSnap = await getDoc(backupDoc(user.uid));
  const backup = privateSnap.exists() ? privateSnap.data().data : legacyBackup;
  if (!backup || Object.keys(backup).length === 0) {
    throw new Error('No backup data found. Back up first from your original device.');
  }

  const pairs = Object.entries(backup); // [[key, value], ...]
  await AsyncStorage.multiSet(pairs);
  // This phone now matches the backup, so automatic backups can start here.
  await rememberBackup(user.uid, backup);

  return {
    count: pairs.length,
    date: lastBackup?.toDate?.()?.toLocaleDateString('en-NG') || 'Unknown',
  };
}

// ── Get user profile from Firestore ──────────────────────────────────────────
export async function getCloudProfile() {
  const user = currentUser();
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data() : null;
}

// ── Check if current user is admin ───────────────────────────────────────────
export async function checkIsAdmin() {
  try {
    const user = currentUser();
    if (!user) return false;
    return (await getDoc(doc(db, 'admins', user.uid))).exists();
  } catch { return false; }
}

// ── Live listener for all users (admin only) ──────────────────────────────────
// Returns an unsubscribe function. Calls onChange(users[]) on every update.
export function subscribeAllUsers(onChange) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    const users = snap.docs.map(d => {
      const { backup, ...profile } = d.data();
      return { id: d.id, ...profile };
    });
    onChange(users);
  }, () => onChange([]));
}
