import React, { useState } from 'react';
import { Pressable, StatusBar, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../constants/tokens';
import {
  Gradient, Icon, IconButton, SegmentedControl, Text, tapFeedback, useTheme,
} from '../components/ui';
import HomeScreen from '../screens/HomeScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import GrowPreviewScreen from '../screens/GrowPreviewScreen';
import {
  ARIAScreen, BankImportScreen, BudgetScreen, DashboardScreen, InvestmentsScreen, SavingsScreen,
  SettingsScreen, SMSScreen,
} from './legacyScreens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Made-up provider data must never reach real users: only test builds see it.
const SHOW_GROW_PREVIEW = process.env.EXPO_PUBLIC_DESIGN_PREVIEW === '1';

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
        style={({ pressed }) => ({
          position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -30, top: -26,
          width: 60, height: 60, borderRadius: 30, overflow: 'hidden', opacity: pressed ? 0.85 : 1,
          shadowColor: '#D8145A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 14, elevation: 10,
        })}
      >
        <Gradient style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="add" size={30} color="#FFFFFF" />
        </Gradient>
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

function PlanScreen({ theme, user }) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState('Budget');
  const Screen = view === 'Budget' ? BudgetScreen : SavingsScreen;
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: space.xs }}>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[{ value: 'Budget', label: 'Budget' }, { value: 'Savings', label: 'Savings' }]}
        />
      </View>
      <SafeAreaProvider style={{ flex: 1 }}>
        <Screen theme={theme} user={user} />
      </SafeAreaProvider>
    </View>
  );
}

function MainTabs({ theme, user }) {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={props => <AppTabBar {...props} />}>
      <Tab.Screen name="Home">{p => <HomeScreen {...p} user={user} />}</Tab.Screen>
      <Tab.Screen name="Activity">{p => <ActivityScreen {...p} user={user} />}</Tab.Screen>
      <Tab.Screen name="Plan">{() => <PlanScreen theme={theme} user={user} />}</Tab.Screen>
      <Tab.Screen name="Grow">
        {p => (SHOW_GROW_PREVIEW ? <GrowPreviewScreen {...p} /> : <InvestmentsScreen {...p} theme={theme} user={user} />)}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator({ theme, toggleTheme, user, setUser }) {
  const back = (title, render) => p => <WithBack navigation={p.navigation} title={title}>{render(p)}</WithBack>;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">{() => <MainTabs theme={theme} user={user} />}</Stack.Screen>
      <Stack.Screen name="Add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        {p => <AddTransactionScreen {...p} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="ARIA">{back('Ask ARIA', p => <ARIAScreen {...p} theme={theme} user={user} />)}</Stack.Screen>
      <Stack.Screen name="Insights">{back('Insights', p => <DashboardScreen {...p} theme={theme} toggleTheme={toggleTheme} user={user} />)}</Stack.Screen>
      <Stack.Screen name="Settings">{back('Settings', p => <SettingsScreen {...p} theme={theme} toggleTheme={toggleTheme} user={user} setUser={setUser} />)}</Stack.Screen>
      <Stack.Screen name="ImportSMS">{back('Import bank SMS', p => <SMSScreen {...p} theme={theme} user={user} />)}</Stack.Screen>
      <Stack.Screen name="ImportStatement">
        {p => <BankImportScreen {...p} theme={theme} onClose={() => p.navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
