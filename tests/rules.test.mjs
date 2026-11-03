// Runs against the Firestore emulator: npm run test:rules
import test, { after, before, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment,
  serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finsight',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { name: 'Alice', email: 'a@x.test', analytics: { aria_messages: 0 } });
    await setDoc(doc(db, 'users/alice/private/backup'), { data: { finsight_transactions: '[]' } });
    await setDoc(doc(db, 'users/legacy'), { name: 'Old', backup: { finsight_transactions: '[]' } });
    await setDoc(doc(db, 'admins/root'), {});
  });
});

const person = (uid, provider = 'password') =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

// ── Reading profiles ──────────────────────────────────────────────────────────
test('people can read their own profile', () => assertSucceeds(getDoc(doc(person('alice'), 'users/alice'))));
test('people cannot read someone else', () => assertFails(getDoc(doc(person('bob'), 'users/alice'))));
test('signed-out visitors cannot read profiles', () => assertFails(getDoc(doc(nobody(), 'users/alice'))));
test('people cannot list all users', () => assertFails(getDocs(collection(person('bob'), 'users'))));
test('anonymous identities cannot list users', () => assertFails(getDocs(collection(person('anon1', 'anonymous'), 'users'))));
test('admins can list users', () => assertSucceeds(getDocs(collection(person('root'), 'users'))));

// ── Becoming an admin ─────────────────────────────────────────────────────────
test('setting isAdmin on your own profile is blocked', () =>
  assertFails(updateDoc(doc(person('alice'), 'users/alice'), { isAdmin: true })));
test('creating a profile with isAdmin is blocked', () =>
  assertFails(setDoc(doc(person('carl'), 'users/carl'), { name: 'C', email: 'c@x.test', isAdmin: true })));
test('adding yourself to admins is blocked', () =>
  assertFails(setDoc(doc(person('alice'), 'admins/alice'), {})));
test('even an admin cannot add admins from the app', () =>
  assertFails(setDoc(doc(person('root'), 'admins/alice'), {})));
test('an isAdmin field alone gives no access', async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/faker'), { isAdmin: true }));
  await assertFails(getDocs(collection(person('faker'), 'users')));
});
test('people can check their own admin status', () => assertSucceeds(getDoc(doc(person('root'), 'admins/root'))));
test('people cannot see who else is an admin', () => assertFails(getDoc(doc(person('alice'), 'admins/root'))));

// ── Writing profiles ──────────────────────────────────────────────────────────
test('sign-up can create the normal profile', () =>
  assertSucceeds(setDoc(doc(person('carl'), 'users/carl'), {
    name: 'C', email: 'c@x.test', createdAt: serverTimestamp(), lastSeen: serverTimestamp(),
    analytics: {}, finscore: { current: 0, history: [] }, xp: { total: 0, level: 1 }, lastBackup: null,
  })));
test('you cannot create a profile for someone else', () =>
  assertFails(setDoc(doc(person('bob'), 'users/carl'), { name: 'C' })));
test('anonymous identities cannot create profiles', () =>
  assertFails(setDoc(doc(person('anon1', 'anonymous'), 'users/anon1'), { name: 'A' })));
test('the app can record analytics, score and XP', () =>
  assertSucceeds(updateDoc(doc(person('alice'), 'users/alice'), {
    'analytics.aria_messages': increment(1), lastSeen: serverTimestamp(),
    finscore: { current: 70, history: [] }, xp: { total: 5, level: 1 },
  })));
test('you cannot edit someone else', () =>
  assertFails(updateDoc(doc(person('bob'), 'users/alice'), { name: 'Hacked' })));
test('admins cannot edit users', () =>
  assertFails(updateDoc(doc(person('root'), 'users/alice'), { name: 'Hacked' })));
test('email cannot be changed from the app', () =>
  assertFails(updateDoc(doc(person('alice'), 'users/alice'), { email: 'evil@x.test' })));

// ── Backups ───────────────────────────────────────────────────────────────────
test('owners can write and read their backup', async () => {
  const db = person('alice');
  await assertSucceeds(setDoc(doc(db, 'users/alice/private/backup'), { data: { a: '1' } }));
  await assertSucceeds(getDoc(doc(db, 'users/alice/private/backup')));
});
test('nobody else can read a backup', () => assertFails(getDoc(doc(person('bob'), 'users/alice/private/backup'))));
test('admins cannot read a backup', () => assertFails(getDoc(doc(person('root'), 'users/alice/private/backup'))));
test('nobody else can overwrite a backup', () =>
  assertFails(setDoc(doc(person('bob'), 'users/alice/private/backup'), { data: {} })));
test('anonymous identities have no backup', () =>
  assertFails(setDoc(doc(person('anon1', 'anonymous'), 'users/anon1/private/backup'), { data: {} })));
test('backups cannot be written to the old profile location', () =>
  assertFails(updateDoc(doc(person('alice'), 'users/alice'), { backup: { a: '1' } })));
test('an old backup on the profile can be removed', () =>
  assertSucceeds(updateDoc(doc(person('legacy'), 'users/legacy'), { backup: deleteField(), lastBackup: serverTimestamp() })));
test('an old backup on the profile cannot be changed', () =>
  assertFails(updateDoc(doc(person('legacy'), 'users/legacy'), { backup: { a: 'tampered' } })));
test('profiles with an old backup can still record analytics', () =>
  assertSucceeds(updateDoc(doc(person('legacy'), 'users/legacy'), { lastSeen: serverTimestamp() })));

// ── Everything else ───────────────────────────────────────────────────────────
test('owners can delete their account data', () => assertSucceeds(deleteDoc(doc(person('alice'), 'users/alice'))));
test('nobody else can delete it', () => assertFails(deleteDoc(doc(person('root'), 'users/alice'))));
test('unknown collections are closed', async () => {
  await assertFails(setDoc(doc(person('alice'), 'anything/x'), { a: 1 }));
  await assertFails(getDoc(doc(person('root'), 'anything/x')));
});
