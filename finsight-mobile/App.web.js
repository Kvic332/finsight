import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './constants/tokens';
import { Icon, ThemeProvider, ToastProvider, useAppFonts } from './components/ui';
import AppNavigator from './navigation/AppNavigator';

// The web build only previews the design while building it. It runs the real
// screens on made-up data; bank capture, voice and biometrics stay in App.js.
const USER = { name: 'Ada Obi', income: 450000, salaryDay: 25, goals: [], setupComplete: true };

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
  const c = colors[scheme];

  useEffect(() => {
    AsyncStorage.setItem('finsight_transactions', JSON.stringify(SAMPLE)).finally(() => setSeeded(true));
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
                <AppNavigator
                  theme={scheme}
                  toggleTheme={() => setScheme(s => (s === 'dark' ? 'light' : 'dark'))}
                  user={USER}
                  setUser={() => {}}
                />
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
