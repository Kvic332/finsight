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
import { DATA_LOCKED } from './services/dataStore';
import DataLockedScreen from './screens/DataLockedScreen';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from './constants/tokens';
import { checkAndSendDigests } from './services/notificationService';
import { syncBankAlerts } from './services/notificationPermission';
import { syncDebtReminders, syncStoredDebtReminders } from './services/debtReminders';
import { syncPaydayReminder } from './services/paydayReminder';
import { runAutoBackup } from './services/cloudSync';
import { isPickingMedia } from './services/appState';

const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

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
  const backgroundedAt = useRef(null);

  useEffect(() => {
    initApp();
    setupNotifications();
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
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
        syncPaydayReminder(parsed);
      }
      await syncBankAlerts();
      syncStoredDebtReminders();
      // After the bank alerts are in, so the backup includes them.
      runAutoBackup();
    } catch(e){
      // Never fall through to onboarding here: it would overwrite the unreadable data.
      if (e?.code === DATA_LOCKED) setDataLocked(true);
    }
    setLoading(false);
  }

  async function setupNotifications() {
    try {
      await Notifications.requestPermissionsAsync();
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
      syncBankAlerts().then(runAutoBackup);
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
            onStartOver={async () => { await syncDebtReminders([]); await syncPaydayReminder(null); await wipeAllData(); setDataLocked(false); setUser(null); setLocked(false); }}
          />
        ) : !user ? (
          <Stack.Navigator screenOptions={{ headerShown:false }}>
            <Stack.Screen name="Onboarding">
              {p=><OnboardingScreen {...p} onComplete={async(ud)=>{
                await AsyncStorage.setItem('finsight_user', JSON.stringify(ud));
                setUser(ud); setLocked(false);
                syncPaydayReminder(ud);
              }}/>}
            </Stack.Screen>
          </Stack.Navigator>
        ) : locked ? (
          <PinScreen mode="unlock"
            biometricEnabled={biometricEnabled}
            onSuccess={()=>setLocked(false)}
            onForgot={async()=>{
              await syncDebtReminders([]);
              await syncPaydayReminder(null);
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
