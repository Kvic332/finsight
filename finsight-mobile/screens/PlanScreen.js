import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../constants/tokens';
import { Gradient, SegmentedControl, Text, useTheme } from '../components/ui';
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
      <Gradient style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: space.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <Text variant="title" family="bold" color="#FFFFFF" accessibilityRole="header">Plan</Text>
      </Gradient>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={['Budget', 'Savings', 'Debts'].map(option => ({ value: option, label: option }))}
        />
      </View>
      {/* The Payday plan now opens from Home, so an old link to it lands on Budget. */}
      {view === 'Savings' ? <SavingsScreen user={user} setUser={setUser} />
        : view === 'Debts' ? <DebtsScreen user={user} />
        : <BudgetScreen user={user} />}
    </View>
  );
}
