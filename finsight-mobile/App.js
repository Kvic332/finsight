import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StatusBar, AppState, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import DashboardScreen from './screens/DashboardScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import SavingsScreen from './screens/SavingsScreen';
import SMSScreen from './screens/SMSScreen';
import ARIAScreen from './screens/ARIAScreen';
import SettingsScreen from './screens/SettingsScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PinScreen from './screens/PinScreen';
import InvestmentsScreen from './screens/InvestmentsScreen';
import BudgetScreen from './screens/BudgetScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { checkAndSendDigests } from './services/notificationService';
import { drainPendingTransactions } from './services/notificationPermission';
import { isPickingMedia } from './services/appState';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

// ── Design Tokens ─────────────────────────────────────────────────────────────
import { DARK, LIGHT, CAT_COLORS, CAT_ICONS, INVESTMENTS } from './constants/theme';
export { DARK, LIGHT, CAT_COLORS, CAT_ICONS, INVESTMENTS };

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
    date: new Date().toLocaleDateString('en-NG'),
  };
}

// ── Tab Icon ──────────────────────────────────────────────────────────────────
function TabIcon({ name, focused, color }) {
  const map = {
    Dashboard:    focused ? 'grid'          : 'grid-outline',
    Transactions: focused ? 'receipt'       : 'receipt-outline',
    Savings:      focused ? 'wallet'        : 'wallet-outline',
    Budget:       focused ? 'pie-chart'     : 'pie-chart-outline',
    Invest:       focused ? 'trending-up'   : 'trending-up-outline',
    SMS:          focused ? 'chatbubble'    : 'chatbubble-outline',
    ARIA:         focused ? 'sparkles'      : 'sparkles-outline',
    Settings:     focused ? 'settings'      : 'settings-outline',
  };
  return <Ionicons name={map[name] || 'ellipse-outline'} size={22} color={color} />;
}

// ── Main Tabs ─────────────────────────────────────────────────────────────────
function MainTabs({ theme, toggleTheme, user, setUser }) {
  const T = theme==='dark' ? DARK : LIGHT;
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: T.surface,
        borderTopWidth: 1,
        borderTopColor: T.line,
        height: 64 + insets.bottom,
        paddingBottom: insets.bottom + 6,
        paddingTop: 10,
        // Shadow (iOS)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: theme === 'dark' ? 0.3 : 0.07,
        shadowRadius: 16,
        // Elevation (Android)
        elevation: 24,
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
      },
      tabBarActiveTintColor: T.lime,
      tabBarInactiveTintColor: T.mute,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2, marginTop: 2 },
      tabBarIcon: ({ color, focused }) => <TabIcon name={route.name} focused={focused} color={color} />,
    })}>
      <Tab.Screen name="Dashboard">{p=><DashboardScreen {...p} theme={theme} toggleTheme={toggleTheme} user={user}/>}</Tab.Screen>
      <Tab.Screen name="Transactions">{p=><TransactionsScreen {...p} theme={theme} user={user}/>}</Tab.Screen>
      <Tab.Screen name="Savings">{p=><SavingsScreen {...p} theme={theme} user={user}/>}</Tab.Screen>
      <Tab.Screen name="Budget">{p=><BudgetScreen {...p} theme={theme} user={user}/>}</Tab.Screen>
      <Tab.Screen name="Invest">{p=><InvestmentsScreen {...p} theme={theme} user={user}/>}</Tab.Screen>
      <Tab.Screen name="SMS">{p=><SMSScreen {...p} theme={theme} user={user}/>}</Tab.Screen>
      <Tab.Screen name="ARIA">{p=><ARIAScreen {...p} theme={theme} user={user}/>}</Tab.Screen>
      <Tab.Screen name="Settings">{p=><SettingsScreen {...p} theme={theme} toggleTheme={toggleTheme} user={user} setUser={setUser}/>}</Tab.Screen>
    </Tab.Navigator>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
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
      const [u, pin, th, bio] = await Promise.all([
        AsyncStorage.getItem('finsight_user'),
        AsyncStorage.getItem('finsight_pin'),
        AsyncStorage.getItem('finsight_theme'),
        AsyncStorage.getItem('finsight_biometric'),
      ]);
      if (th) setTheme(th);
      if (bio === 'true') setBiometricEnabled(true);
      if (pin) setLocked(true);
      if (u) { const p=JSON.parse(u); if (p?.setupComplete) setUser(p); }
  
      // Use u directly — no second fetch needed
      if (u) {
        const parsed = JSON.parse(u);
        const name = parsed?.name?.split(' ')[0] || 'there';
        checkAndSendDigests(name);
      }
      await drainNativeQueue();
    } catch(e){}
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
        const isDup = existing.some(e => e.amount===tx.amount && e.source==='push' &&
          (Date.now()-new Date(e.date).getTime()) < 120000);
        if (!isDup) await AsyncStorage.setItem('finsight_transactions', JSON.stringify([tx,...existing]));
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
      const [pin, raw] = await Promise.all([
        AsyncStorage.getItem('finsight_pin'),
        AsyncStorage.getItem('finsight_lock_timeout'),
      ]);
      if (!pin) return;
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

  const T = theme==='dark' ? DARK : LIGHT;

  if (loading) return (
    <View style={{ flex:1, backgroundColor:DARK.bg, justifyContent:'center', alignItems:'center', gap:16 }}>
      <View style={{ width:72, height:72, borderRadius:18, backgroundColor:DARK.surface, justifyContent:'center', alignItems:'center' }}>
        <Text style={{ fontSize:44, color:DARK.lime, fontStyle:'italic' }}>f</Text>
      </View>
      <Text style={{ fontSize:11, color:DARK.mute, letterSpacing:4, textTransform:'uppercase' }}>Loading</Text>
    </View>
  );

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar barStyle={theme==='dark'?'light-content':'dark-content'} backgroundColor={T.bg}/>
      <NavigationContainer>
        {!user ? (
          <Stack.Navigator screenOptions={{ headerShown:false }}>
            <Stack.Screen name="Onboarding">
              {p=><OnboardingScreen {...p} theme={theme} onComplete={async(ud)=>{
                await AsyncStorage.setItem('finsight_user', JSON.stringify(ud));
                setUser(ud); setLocked(false);
              }}/>}
            </Stack.Screen>
          </Stack.Navigator>
        ) : locked ? (
          <PinScreen theme={theme} mode="unlock"
            biometricEnabled={biometricEnabled}
            onSuccess={()=>setLocked(false)}
            onForgot={()=>Alert.alert('Reset PIN','This will log you out. Continue?',[
              {text:'Cancel',style:'cancel'},
              {text:'Reset',style:'destructive',onPress:async()=>{
                await AsyncStorage.multiRemove(['finsight_pin','finsight_user']);
                setUser(null); setLocked(false);
              }},
            ])}
          />
        ) : (
          <MainTabs theme={theme} toggleTheme={toggleTheme} user={user} setUser={setUser}/>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
