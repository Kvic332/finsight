import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from '../components/ui';

function PhoneOnly({ name }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: c.canvas }}>
      <Text variant="heading" align="center">{name}</Text>
      <Text color="inkMuted" align="center">Not redesigned yet. Open this one in the phone app.</Text>
    </View>
  );
}

const stub = name => () => <PhoneOnly name={name} />;

export const DashboardScreen = stub('Insights');
export const BudgetScreen = stub('Budget');
export const SavingsScreen = stub('Savings');
export { default as InvestmentsScreen } from '../screens/GrowPreviewScreen';
export const SMSScreen = stub('Import bank SMS');
export const ARIAScreen = stub('ARIA');
export const SettingsScreen = stub('Settings');
export const BankImportScreen = stub('Upload a statement');
