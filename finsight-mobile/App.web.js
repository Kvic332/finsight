import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './constants/tokens';
import { Icon, ThemeProvider, ToastProvider, useAppFonts } from './components/ui';
import AppNavigator from './navigation/AppNavigator';
import OnboardingScreen from './screens/OnboardingScreen';
import PinScreen from './screens/PinScreen';

// The web build only previews the design while building it. It runs the real
// screens on made-up data; bank capture, voice and biometrics stay in App.js.
const INITIAL_USER = { name: 'Ada Obi', income: 450000, salaryDay: 25, goals: [{ id: 'g1', name: 'Emergency Fund', target: 500000, saved: 185000 }, { id: 'g2', name: 'New Laptop', target: 350000, saved: 350000 }], setupComplete: true };

function dayString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const SAMPLE = [
  ['Shoprite Ikeja', 12400, 'debit', 'Food', 0],
  ['Bolt ride', 3200, 'debit', 'Transport', 0],
  ['IKEDC prepaid token', 15000, 'debit', 'Utilities', 1],
  ['Chicken Republic', 6800, 'debit', 'Food', 2],
  ['Netflix', 7500, 'debit', 'Entertainment', 4],
  ['Rent contribution', 80000, 'debit', 'Other', 6],
  ['Salary', 450000, 'credit', 'Income', 9],
].map(([desc, amount, type, cat, ago], i) => ({ id: String(i + 1), desc, amount, type, cat, source: 'manual', date: dayString(ago) }));

export default function WebPreview() {
  const fontsReady = useAppFonts();
  const [scheme, setScheme] = useState('light');
  const [seeded, setSeeded] = useState(false);
  const [user, setUser] = useState(INITIAL_USER);
  // Preview a single screen with ?view=onboarding or ?view=pin.
  const view = new URLSearchParams(window.location.search).get('view');
  const c = colors[scheme];

  useEffect(() => {
    AsyncStorage.multiSet([
      ['finsight_transactions', JSON.stringify(SAMPLE)],
      ['finsight_budgets', JSON.stringify([
        { id: 'b1', name: 'Food', cat: 'Food', limit: 60000, keywords: [] },
        { id: 'b2', name: 'Transport', cat: 'Transport', limit: 3500, keywords: [] },
        { id: 'b3', name: 'Netflix', cat: 'Entertainment', limit: 7000, keywords: ['netflix'] },
      ])],
    ]).finally(() => setSeeded(true));
  }, []);

  if (!fontsReady || !seeded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.canvas }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider scheme={scheme}>
        <View style={{ flex: 1, backgroundColor: c.sunken, alignItems: 'center' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 420, overflow: 'hidden' }}>
            <ToastProvider>
              <NavigationContainer>
                {view === 'onboarding' ? <OnboardingScreen onComplete={() => {}} />
                  : view === 'pin' ? <PinScreen mode="unlock" onSuccess={() => {}} onForgot={() => {}} />
                  : (
                    <AppNavigator
                      theme={scheme}
                      toggleTheme={() => setScheme(s => (s === 'dark' ? 'light' : 'dark'))}
                      user={user}
                      setUser={setUser}
                    />
                  )}
              </NavigationContainer>
            </ToastProvider>
            <Pressable
              onPress={() => setScheme(s => (s === 'dark' ? 'light' : 'dark'))}
              accessibilityRole="button"
              accessibilityLabel="Preview only: switch light or dark"
              style={{ position: 'absolute', right: 8, bottom: 96, padding: 8, borderRadius: 18, backgroundColor: c.surface, opacity: 0.85 }}
            >
              <Icon name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} />
            </Pressable>
          </View>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
