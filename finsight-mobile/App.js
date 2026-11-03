import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StatusBar, AppState } from 'react-native';
import AsyncStorage from './services/dataStore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import OnboardingScreen from './screens/OnboardingScreen';
import PinScreen from './screens/PinScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider, ToastProvider, useAppFonts } from './components/ui';
import AppNavigator from './navigation/AppNavigator';
import { hasPin, wipeAllData } from './services/pinStore';
import { isRepeatAlert } from './services/alerts';
import { DATA_LOCKED } from './services/dataStore';
import DataLockedScreen from './screens/DataLockedScreen';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from './constants/tokens';
import { checkAndSendDigests } from './services/notificationService';
import { drainPendingTransactions } from './services/notificationPermission';
import { isPickingMedia } from './services/appState';

const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

// ── Transaction parser from notification/SMS text ─────────────────────────────
export function parseTransactionFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // ── Must be a genuine bank notification ──────────────────────────────────────
  // Require a known bank name OR bank-specific structural keywords.
  // Generic words like "payment", "transaction", "account" are NOT enough —
  // they appear in Jumia, subscription, and OTP notifications too.
  const bankNames = ['access bank','zenith','gtbank','gtb','first bank','firstbank',
    'uba','fidelity','sterling','kuda','opay','palmpay','moniepoint','carbon','wema',
    'stanbic','polaris','union bank','fcmb','ecobank','providus','jaiz','keystone'];
  const hasBankName = bankNames.some(b => lower.includes(b));
  const hasBankPattern = /\b(acct|a\/c|avail(?:able)?\s*bal|new\s*bal|bal[:\s]|trf|ref\s*no|DR[:\s]|CR[:\s]|debited|credited|withdrawal)\b/i.test(text);
  if (!hasBankName && !hasBankPattern) return null;

  let amount = 0;
  const amtPatterns = [
    /[N₦]\s*([\d,]+(?:\.\d{2})?)/i,
    /([\d,]+(?:\.\d{2})?)\s*(?:naira|NGN)/i,
    /(?:amount|sum)[:\s]*([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const p of amtPatterns) {
    const m = text.match(p);
    if (m) { amount = parseInt(m[1].replace(/,/g,'')); break; }
  }
  if (amount < 10) return null;

  // Credit = money coming IN to your account
  const isCredit = /credit(?:ed)?|received|salary|refund|CR\b|deposit|inflow|lodgement|cashback/i.test(text);
  // Debit = money going OUT (including transfers you sent)
  const isDebit = /debit(?:ed)?|withdrawn?|paid|DR\b|charged|\bsent\b|transfer(?:red)?\s*to|trf\s*to|transfer out/i.test(text);
  const type = isCredit && !isDebit ? 'credit' : 'debit';

  let desc = '';
  const descPatterns = [
    /(?:at|from|to|for|narr(?:ation)?)[:\s]+([^.\n,]{3,50})/i,
    /(?:description|ref)[:\s]+([^.\n,]{3,50})/i,
  ];
  for (const p of descPatterns) {
    const m = text.match(p); if (m) { desc = m[1].trim(); break; }
  }
  if (!desc) desc = text.split('\n')[0].trim().slice(0, 50);

  const bankMap = {
    'access':'Access Bank','zenith':'Zenith Bank','gtb':'GTBank','gtbank':'GTBank',
    'first bank':'First Bank','firstbank':'First Bank','uba':'UBA',
    'fidelity':'Fidelity Bank','sterling':'Sterling Bank','kuda':'Kuda Bank',
    'opay':'OPay','palmpay':'PalmPay','moniepoint':'Moniepoint','carbon':'Carbon','wema':'Wema Bank',
  };
  let bank = null;
  for (const [k,v] of Object.entries(bankMap)) { if (lower.includes(k)) { bank=v; break; } }

  const catMap = [
    [['shoprite','grocery','market','food','eat','restaurant'],'Food'],
    [['uber','bolt','transport','fuel','petrol'],'Transport'],
    [['netflix','spotify','dstv','showmax','cinema'],'Entertainment'],
    [['electricity','nepa','ikedc','ekedc','water'],'Utilities'],
    [['hospital','pharmacy','health','doctor'],'Health'],
    [['savings','cowrywise','piggyvest','save'],'Savings'],
    [['salary','credit alert','payment received','payroll'],'Income'],
    [['transfer','sent','trf'],'Transfer'],
  ];
  let cat = 'Other';
  for (const [kws,c] of catMap) { if (kws.some(k=>lower.includes(k))) { cat=c; break; } }
  if (type==='credit' && cat==='Other') cat='Income';

  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    desc: desc || 'Bank Transaction',
    amount, type, cat, bank,
    source: 'push',
    capturedAt: Date.now(),
    date: new Date().toLocaleDateString('en-NG'),
  };
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const fontsReady = useAppFonts();
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [dataLocked, setDataLocked] = useState(false);
  const appState = useRef(AppState.currentState);
  const notifListener = useRef();
  const backgroundedAt = useRef(null);

  useEffect(() => {
    initApp();
    setupNotifications();
    const sub = AppState.addEventListener('change', handleAppState);
    return () => { sub.remove(); if (notifListener.current) notifListener.current.remove(); };
  }, []);

  async function initApp() {
    try {
      // If the PIN can't be read, stay locked: a storage error must not open the app.
      const pinSet = await hasPin().catch(() => true);
      const [u, th, bio] = await Promise.all([
        AsyncStorage.getItem('finsight_user'),
        AsyncStorage.getItem('finsight_theme'),
        AsyncStorage.getItem('finsight_biometric'),
      ]);
      if (th) setTheme(th);
      if (bio === 'true') setBiometricEnabled(true);
      if (pinSet) setLocked(true);
      if (u) { const p=JSON.parse(u); if (p?.setupComplete) setUser(p); }
  
      // Use u directly — no second fetch needed
      if (u) {
        const parsed = JSON.parse(u);
        const name = parsed?.name?.split(' ')[0] || 'there';
        checkAndSendDigests(name);
      }
      await drainNativeQueue();
    } catch(e){
      // Never fall through to onboarding here: it would overwrite the unreadable data.
      if (e?.code === DATA_LOCKED) setDataLocked(true);
    }
    setLoading(false);
  }

  async function setupNotifications() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      notifListener.current = Notifications.addNotificationReceivedListener(async notif => {
        const title = notif.request.content.title || '';
        const body  = notif.request.content.body  || '';
        // Skip our own internal notifications (budget alerts, digests, etc.)
        if (/budget (exceeded|warning|alert)|finsight/i.test(title) ||
            /over your.*budget|% of your.*budget|daily digest|weekly digest/i.test(body)) return;
        const text = `${title} ${body}`;
        const tx = parseTransactionFromText(text);
        if (!tx) return;
        const raw = await AsyncStorage.getItem('finsight_transactions');
        const existing = raw ? JSON.parse(raw) : [];
        if (!isRepeatAlert(existing, tx)) await AsyncStorage.setItem('finsight_transactions', JSON.stringify([tx,...existing]));
      });
    } catch(e){}
  }

  // Merge any transactions captured by BankNotificationService (native) into AsyncStorage.
  // The service can't write to AsyncStorage directly (v2 uses SQLite), so it queues to
  // SharedPreferences. We drain that queue here and merge into JS storage.
  async function drainNativeQueue() {
    try {
      const pending = await drainPendingTransactions();
      if (!pending.length) return;
      const raw = await AsyncStorage.getItem('finsight_transactions');
      const existing = raw ? JSON.parse(raw) : [];
      // Deduplicate by ID only — the native service already handles same-amount
      // dedup within its own queue. Using amount+source was too aggressive and
      // caused legitimate same-amount transactions to be silently dropped.
      const existingIds = new Set(existing.map(e => e.id));
      const toAdd = pending.filter(pt => !existingIds.has(pt.id));
      if (toAdd.length) {
        await AsyncStorage.setItem('finsight_transactions', JSON.stringify([...toAdd, ...existing]));
      }
    } catch(e){}
  }

  function handleAppState(next) {
    // Going to background — record the time, but only if a system picker isn't open.
    // Image/file pickers briefly background the app; we don't want that to trigger a lock.
    if (appState.current === 'active' && next.match(/inactive|background/)) {
      if (!isPickingMedia()) {
        backgroundedAt.current = Date.now();
      }
    }
    // Coming to foreground
    if (next === 'active') {
      drainNativeQueue();
      const bg = backgroundedAt.current;
      backgroundedAt.current = null;
      // If we recorded a background time and a picker isn't responsible, check timeout.
      if (bg !== null && !isPickingMedia()) {
        checkLockTimeout(Date.now() - bg);
      }
    }
    appState.current = next;
  }

  // Locks the app if the user has a PIN and the elapsed background time exceeds their
  // chosen timeout. Timeout values (stored as 'finsight_lock_timeout', minutes):
  //   0  → Immediately (default)
  //  >0  → After N minutes
  //  -1  → Never (until next cold open)
  async function checkLockTimeout(elapsedMs) {
    try {
      const [pinSet, raw] = await Promise.all([
        hasPin().catch(() => true),
        AsyncStorage.getItem('finsight_lock_timeout'),
      ]);
      if (!pinSet) return;
      const minutes = raw !== null ? parseInt(raw, 10) : 0;
      if (minutes === -1) return;                        // Never
      // Require at least 5 seconds in background to avoid locking on tab switches
      // or brief system events (e.g. permission dialogs, notifications)
      const lockAfterMs = minutes === 0 ? 5000 : minutes * 60 * 1000;
      if (elapsedMs >= lockAfterMs) setLocked(true);
    } catch (e) {}
  }

  const toggleTheme = async () => {
    const next = theme==='dark' ? 'light' : 'dark';
    setTheme(next);
    await AsyncStorage.setItem('finsight_theme', next);
  };

  if (loading || !fontsReady) return (
    <LinearGradient colors={gradients.warm} start={{ x:0, y:0 }} end={{ x:1, y:1 }} style={{ flex:1 }} />
  );

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar barStyle={theme==='dark'?'light-content':'dark-content'} translucent backgroundColor="transparent"/>
      <ThemeProvider scheme={theme}>
      <ToastProvider>
      <NavigationContainer>
        {dataLocked ? (
          <DataLockedScreen
            onRetry={() => { setDataLocked(false); setLoading(true); initApp(); }}
            onStartOver={async () => { await wipeAllData(); setDataLocked(false); setUser(null); setLocked(false); }}
          />
        ) : !user ? (
          <Stack.Navigator screenOptions={{ headerShown:false }}>
            <Stack.Screen name="Onboarding">
              {p=><OnboardingScreen {...p} onComplete={async(ud)=>{
                await AsyncStorage.setItem('finsight_user', JSON.stringify(ud));
                setUser(ud); setLocked(false);
              }}/>}
            </Stack.Screen>
          </Stack.Navigator>
        ) : locked ? (
          <PinScreen mode="unlock"
            biometricEnabled={biometricEnabled}
            onSuccess={()=>setLocked(false)}
            onForgot={async()=>{
              await wipeAllData();
              setUser(null); setLocked(false);
            }}
          />
        ) : (
          <AppNavigator theme={theme} toggleTheme={toggleTheme} user={user} setUser={setUser}/>
        )}
      </NavigationContainer>
      </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
