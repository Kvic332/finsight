import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Firebase config ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAFOJCBp6YlghjZGT2SW4UZuXYL0Wxc5Rg',
  authDomain:        'finsight-2f945.firebaseapp.com',
  projectId:         'finsight-2f945',
  storageBucket:     'finsight-2f945.firebasestorage.app',
  messagingSenderId: '1026599075171',
  appId:             '1:1026599075171:web:6a5bb2091cd502efbce756',
};

// ── Init (guard against double-init on hot reload) ────────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth with AsyncStorage persistence so the user stays logged in
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app); // already initialised (hot reload)
}

const db = getFirestore(app);

export { app, auth, db };
