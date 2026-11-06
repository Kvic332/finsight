import React, { useEffect, useState } from 'react';
import { Pressable, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import { Gradient, Text, tapFeedback, useTheme } from '../components/ui';
import BudgetScreen from './BudgetScreen';
import SavingsScreen from './SavingsScreen';
import DebtsScreen from './DebtsScreen';

export default function PlanScreen({ route, user, setUser }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState(route?.params?.view || 'Budget');

  // Settings can open this screen directly on Savings.
  useEffect(() => { if (route?.params?.view) setView(route.params.view); }, [route?.params?.view]);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Gradient style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md }}>
        <Text variant="title" family="bold" color="#FFFFFF" accessibilityRole="header">Plan</Text>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: space.xs, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.2)' }}>
          {['Budget', 'Savings', 'Debts'].map(option => (
            <Pressable
              key={option}
              onPress={() => { tapFeedback(); setView(option); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: option === view }}
              style={{
                flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm,
                backgroundColor: option === view ? '#FFFFFF' : 'transparent',
              }}
            >
              <Text variant="label" family="semibold" color={option === view ? '#A30E42' : '#FFFFFF'}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </Gradient>
      {/* The Payday plan now opens from Home, so an old link to it lands on Budget. */}
      {view === 'Savings' ? <SavingsScreen user={user} setUser={setUser} />
        : view === 'Debts' ? <DebtsScreen user={user} />
        : <BudgetScreen user={user} />}
    </View>
  );
}
