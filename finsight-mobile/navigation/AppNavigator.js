import React, { useEffect } from 'react';
import { Platform, Pressable, StatusBar, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../constants/tokens';
import { PAYDAY_REMINDER_TYPE } from '../services/paydayReminder';
import {
  Icon, IconButton, Text, tapFeedback, useTheme,
} from '../components/ui';
import HomeScreen from '../screens/HomeScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import GrowScreen from '../screens/GrowScreen';
import PlanScreen from '../screens/PlanScreen';
import ARIAScreen from '../screens/ARIAScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SMSScreen from '../screens/SMSScreen';
import BankImportScreen from '../screens/BankImportScreen';
import ReviewTransactionsScreen from '../screens/ReviewTransactionsScreen';
import NewTransactionsScreen from '../screens/NewTransactionsScreen';
import PaydayScreen from '../screens/PaydayScreen';
import ForeignMoneyScreen from '../screens/ForeignMoneyScreen';
import BusinessScreen from '../screens/BusinessScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Activity: ['list', 'list-outline'],
  Plan: ['pie-chart', 'pie-chart-outline'],
  Grow: ['trending-up', 'trending-up-outline'],
};

function TabButton({ route, focused, onPress }) {
  const { c } = useTheme();
  const color = focused ? c.accent : c.inkMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={route.name}
      style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: space.xs }}
    >
      <Icon name={TAB_ICONS[route.name][focused ? 0 : 1]} size={22} color={color} />
      <Text variant="caption" family={focused ? 'bold' : 'medium'} color={color} style={{ fontSize: 12 }}>{route.name}</Text>
    </Pressable>
  );
}

function AppTabBar({ state, navigation }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const go = (route, index) => {
    tapFeedback();
    const focused = state.index === index;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };
  const tabs = state.routes.map((route, index) => (
    <TabButton key={route.key} route={route} focused={state.index === index} onPress={() => go(route, index)} />
  ));
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
      paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.sm), paddingHorizontal: space.sm,
      shadowColor: c.shadow, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 12,
    }}>
      {tabs.slice(0, 2)}
      <View style={{ width: 72 }} />
      {tabs.slice(2)}
      <Pressable
        onPress={() => { tapFeedback(); navigation.navigate('Add'); }}
        accessibilityRole="button"
        accessibilityLabel="Add a transaction"
        // A solid square-ish button on a ring of the bar's colour, so it sits in the
        // bar rather than floating over it.
        style={({ pressed }) => ({
          position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -32, top: -22,
          width: 64, height: 64, borderRadius: 22, padding: 5, backgroundColor: c.surface,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <View style={{
          flex: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent,
          shadowColor: c.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
        }}>
          <Icon name="add" size={28} color={c.onAccent} />
        </View>
      </Pressable>
    </View>
  );
}

// A back bar above a screen that hasn't been redesigned. The nested provider
// stops the older screen adding the status bar's height a second time.
function WithBack({ navigation, title, children }) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={{ paddingTop: insets.top, paddingHorizontal: space.xs, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: c.canvas }}>
        <IconButton icon="arrow-back" label="Back" onPress={() => navigation.goBack()} />
        <Text variant="bodyStrong" family="bold" accessibilityRole="header">{title}</Text>
      </View>
      <SafeAreaProvider style={{ flex: 1 }}>{children}</SafeAreaProvider>
    </View>
  );
}

// Opens the plan when a payday reminder is tapped. These screens only exist once
// the app is unlocked, so a tap made before the PIN is handled straight after it.
// Cleared once used, so a later unlock doesn't open the plan again.
function PaydayReminderTaps() {
  const navigation = useNavigation();
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (response?.notification?.request?.content?.data?.type !== PAYDAY_REMINDER_TYPE) return;
    Notifications.clearLastNotificationResponse();
    navigation.navigate('PaydayPlan');
  }, [response, navigation]);
  return null;
}

function MainTabs({ theme, user, setUser }) {
  return (
    <>
      <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={props => <AppTabBar {...props} />}>
        <Tab.Screen name="Home">{p => <HomeScreen {...p} user={user} setUser={setUser} />}</Tab.Screen>
        <Tab.Screen name="Activity">{p => <ActivityScreen {...p} user={user} />}</Tab.Screen>
        <Tab.Screen name="Plan">{p => <PlanScreen {...p} user={user} setUser={setUser} />}</Tab.Screen>
        <Tab.Screen name="Grow" component={GrowScreen} />
      </Tab.Navigator>
      {Platform.OS !== 'web' ? <PaydayReminderTaps /> : null}
    </>
  );
}

export default function AppNavigator({ theme, toggleTheme, user, setUser }) {
  const back = (title, render) => p => <WithBack navigation={p.navigation} title={title}>{render(p)}</WithBack>;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">{() => <MainTabs theme={theme} user={user} setUser={setUser} />}</Stack.Screen>
      <Stack.Screen name="Add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        {p => <AddTransactionScreen {...p} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="ARIA">{p => <ARIAScreen {...p} user={user} />}</Stack.Screen>
      <Stack.Screen name="Insights">{back('Insights', p => <DashboardScreen {...p} user={user} />)}</Stack.Screen>
      <Stack.Screen name="Settings">{back('Settings', p => <SettingsScreen {...p} theme={theme} toggleTheme={toggleTheme} user={user} setUser={setUser} />)}</Stack.Screen>
      <Stack.Screen name="ImportSMS">{back('Import bank SMS', p => <SMSScreen {...p} />)}</Stack.Screen>
      <Stack.Screen name="PaydayPlan">{back('Payday plan', p => <PaydayScreen {...p} user={user} setUser={setUser} />)}</Stack.Screen>
      <Stack.Screen name="Business">{back('Your business', p => <BusinessScreen {...p} user={user} setUser={setUser} />)}</Stack.Screen>
      <Stack.Screen name="ForeignMoney">{back('Foreign money', p => <ForeignMoneyScreen {...p} user={user} setUser={setUser} />)}</Stack.Screen>
      <Stack.Screen name="NewTransactions">{back('New from your bank', p => <NewTransactionsScreen {...p} user={user} />)}</Stack.Screen>
      <Stack.Screen name="ReviewTransactions">{back('Check imported transactions', p => <ReviewTransactionsScreen {...p} />)}</Stack.Screen>
      <Stack.Screen name="ImportStatement">
        {p => <BankImportScreen onClose={() => p.navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
