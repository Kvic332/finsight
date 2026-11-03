import React, { useEffect, useRef, useState } from 'react';
import {
  AppState, Image, Modal, Platform, Pressable, ScrollView, Switch, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '../services/dataStore';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import { radius, space } from '../constants/tokens';
import {
  Button, Card, Chip, ConfirmSheet, Icon, IconButton, IconTile, Input, ListRow, Sheet, Text, ThemeProvider,
  ToastProvider, tapFeedback, useTheme, useToast,
} from '../components/ui';
import BankImportScreen from './BankImportScreen';
import CloudAccountScreen from './CloudAccountScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import DesignGalleryScreen from './DesignGalleryScreen';
import PinScreen from './PinScreen';
import { onAuthChange, checkIsAdmin } from '../services/cloudSync';
import { scheduleDailyReminder, cancelDailyReminder } from '../services/notificationService';
import { isNotificationAccessGranted, openNotificationAccessSettings, requestBatteryOptimizationExemption } from '../services/notificationPermission';
import { setPickingMedia } from '../services/appState';
import { exportCSV, exportPDF } from '../services/exportService';
import { formatMoney, parseAmount } from '../services/format';
import { hasPin as readHasPin, removePin, wipeAllData } from '../services/pinStore';

const NIGERIAN_BANKS = [
  'GTBank', 'Access Bank', 'Zenith Bank', 'First Bank', 'UBA', 'Fidelity Bank',
  'Sterling Bank', 'Kuda Bank', 'OPay', 'PalmPay', 'Moniepoint', 'Carbon',
  'Wema Bank', 'Stanbic IBTC', 'Union Bank', 'Polaris Bank', 'Providus Bank',
  'VFD MFB', 'FCMB', 'Ecobank', 'Renmoney', 'Fairmoney', 'PiggyVest', 'Cowrywise',
];
const EMPLOYMENT_TYPES = ['Salary Earner', 'Business Owner', 'Freelancer', 'Student', 'Retired', 'Other'];
const SEX_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const LOCK_TIMEOUT_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: 'After 1 minute', value: 1 },
  { label: 'After 5 minutes', value: 5 },
  { label: 'After 15 minutes', value: 15 },
  { label: 'After 1 hour', value: 60 },
  { label: 'Never', value: -1 },
];
const COMMON_PAYDAYS = ['1', '5', '10', '15', '20', '25', '28', '30'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_VALS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const NOW_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => String(NOW_YEAR - i));
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const ITEM_H = 44;

const clock = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

function Section({ title, children }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" family="bold" color="inkMuted" accessibilityRole="header">{title}</Text>
      <Card padded={false} style={{ overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}

function Row({ icon, title, subtitle, onPress, right, danger, last }) {
  return (
    <ListRow
      leading={<IconTile name={icon} size={40} tone={danger ? 'negative' : 'accent'} />}
      title={title}
      subtitle={subtitle}
      value={right}
      chevron={!right && !!onPress}
      onPress={onPress}
      divider={!last}
      subtitleLines={2}
    />
  );
}

function Toggle({ value, onValueChange, label }) {
  const { c } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={label}
      trackColor={{ false: c.lineStrong, true: c.accent }}
      thumbColor="#FFFFFF"
    />
  );
}

// Full-screen form for longer tasks. Short ones use a Sheet.
function FormModal({ visible, title, onClose, onSave, saveLabel = 'Save', children }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm }}>
          <IconButton icon="close" label="Close" onPress={onClose} />
          <Text variant="bodyStrong" family="bold" accessibilityRole="header">{title}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: space.lg }}>
          {children}
        </ScrollView>
        {onSave ? <View style={{ padding: space.xl, paddingTop: space.sm }}><Button full title={saveLabel} onPress={onSave} /></View> : null}
      </SafeAreaView>
    </Modal>
  );
}

function Choice({ label, selected, onPress }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50,
        paddingHorizontal: space.md + 2, borderRadius: radius.md, borderWidth: selected ? 1.5 : 0, borderColor: c.accent,
        backgroundColor: selected ? c.accentSoft : pressed ? c.lineStrong : c.sunken,
      })}
    >
      <Text variant="bodyStrong" family={selected ? 'semibold' : 'medium'}>{label}</Text>
      {selected ? <Icon name="checkmark-circle" size={22} color="accent" /> : null}
    </Pressable>
  );
}

function PickerColumn({ title, items, labelOf, selected, onSelect, flex = 1, scrollRef }) {
  const { c } = useTheme();
  return (
    <View style={{ flex, gap: space.xs }}>
      <Text variant="caption" family="semibold" color="inkMuted" align="center">{title}</Text>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={{ height: 190, borderRadius: radius.md, backgroundColor: c.sunken }}
      >
        {items.map(item => {
          const on = selected === item;
          return (
            <Pressable
              key={item}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accentSoft : 'transparent' }}
            >
              <Text variant="bodyStrong" family={on ? 'bold' : 'regular'} color={on ? 'onAccentSoft' : 'ink'} tabular numberOfLines={1}>{labelOf(item)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Stored as DD/MM/YYYY.
function DOBPicker({ value, onChange }) {
  const parts = (value || '').split('/');
  const [day, setDay] = useState(parts[0] || '');
  const [month, setMonth] = useState(parts[1] || '');
  const [year, setYear] = useState(parts[2] || '');
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  useEffect(() => {
    const [d = '', m = '', y = ''] = (value || '').split('/');
    setDay(d); setMonth(m); setYear(y);
    const timer = setTimeout(() => {
      if (d) dayRef.current?.scrollTo({ y: DAYS.indexOf(d) * ITEM_H, animated: false });
      if (m) monthRef.current?.scrollTo({ y: MONTH_VALS.indexOf(m) * ITEM_H, animated: false });
      if (y) yearRef.current?.scrollTo({ y: YEARS.indexOf(y) * ITEM_H, animated: false });
    }, 120);
    return () => clearTimeout(timer);
  }, [value]);

  const notify = (d, m, y) => { if (d && m && y) onChange(`${d}/${m}/${y}`); };
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <PickerColumn title="Day" items={DAYS} labelOf={d => parseInt(d, 10)} selected={day} scrollRef={dayRef} onSelect={d => { setDay(d); notify(d, month, year); }} />
      <PickerColumn title="Month" flex={1.8} items={MONTH_VALS} labelOf={m => MONTHS[parseInt(m, 10) - 1]} selected={month} scrollRef={monthRef} onSelect={m => { setMonth(m); notify(day, m, year); }} />
      <PickerColumn title="Year" flex={1.1} items={YEARS} labelOf={y => y} selected={year} scrollRef={yearRef} onSelect={y => { setYear(y); notify(day, month, y); }} />
    </View>
  );
}

export default function SettingsScreen({ navigation, theme, toggleTheme, user, setUser }) {
  const { c } = useTheme();
  const toast = useToast();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBanks, setShowBanks] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [showSalaryDay, setShowSalaryDay] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showLockTimeout, setShowLockTimeout] = useState(false);
  const [showBankImport, setShowBankImport] = useState(false);
  const [showCloud, setShowCloud] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [about, setAbout] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cloudUser, setCloudUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [galleryScheme, setGalleryScheme] = useState('light');

  const [notifAccessGranted, setNotifAccessGranted] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(21);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [pickerHour, setPickerHour] = useState(21);
  const [pickerMinute, setPickerMinute] = useState(0);

  const [editData, setEditData] = useState({
    name: '', email: '', phone: '', dob: '', sex: '', nationality: 'Nigerian',
    occupation: '', employmentType: '', photo: null,
  });
  const [profileError, setProfileError] = useState('');
  const [selectedBanks, setSelectedBanks] = useState(user?.banks || []);
  const [incomeInput, setIncomeInput] = useState('');
  const [incomeError, setIncomeError] = useState('');
  const [salaryDayInput, setSalaryDayInput] = useState('25');
  const [salaryError, setSalaryError] = useState('');
  const [lockTimeout, setLockTimeout] = useState(0);
  const [tempLockTimeout, setTempLockTimeout] = useState(0);

  useEffect(() => {
    checkNotifAccess();
    loadSettings();
    checkBiometricAvailability();
    const unsub = onAuthChange(async u => {
      setCloudUser(u);
      setIsAdmin(u ? await checkIsAdmin() : false);
    });
    // Re-check when returning from Android's settings screen.
    const sub = AppState.addEventListener('change', next => { if (next === 'active') checkNotifAccess(); });
    return () => { unsub(); sub.remove(); };
  }, []);

  async function checkBiometricAvailability() {
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHw && isEnrolled);
      setBiometricEnabled((await AsyncStorage.getItem('finsight_biometric')) === 'true');
    } catch { /* no fingerprint hardware */ }
  }

  async function toggleBiometric(on) {
    if (!on) {
      setBiometricEnabled(false);
      await AsyncStorage.setItem('finsight_biometric', 'false');
      return;
    }
    if (!(await readHasPin().catch(() => false))) {
      setConfirm({
        title: 'Set a PIN first',
        body: 'Fingerprint unlock needs a PIN as a backup.',
        confirmLabel: 'Set PIN',
        onConfirm: () => setShowPinSetup(true),
      });
      return;
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm fingerprint to enable unlock',
        fallbackLabel: 'Use PIN instead',
      });
      if (result.success) {
        setBiometricEnabled(true);
        await AsyncStorage.setItem('finsight_biometric', 'true');
        toast.show('Fingerprint unlock is on', { tone: 'success' });
      }
    } catch (e) {
      toast.show("Couldn't verify your fingerprint. Try again.", { tone: 'error' });
    }
  }

  async function loadSettings() {
    const [lock, rh, rm, re, pinSet] = await Promise.all([
      AsyncStorage.getItem('finsight_lock_timeout'),
      AsyncStorage.getItem('finsight_reminder_hour'),
      AsyncStorage.getItem('finsight_reminder_minute'),
      AsyncStorage.getItem('finsight_reminder_enabled'),
      readHasPin().catch(() => true),
    ]);
    if (lock !== null) setLockTimeout(parseInt(lock, 10));
    if (rh !== null) setReminderHour(parseInt(rh, 10));
    if (rm !== null) setReminderMinute(parseInt(rm, 10));
    setReminderEnabled(re === 'true');
    setHasPin(pinSet);
  }

  async function checkNotifAccess() {
    const granted = await isNotificationAccessGranted();
    setNotifAccessGranted(granted);
    if (granted) requestBatteryOptimizationExemption();
  }

  async function saveUser(updates) {
    const updated = { ...user, ...updates };
    await AsyncStorage.setItem('finsight_user', JSON.stringify(updated));
    setUser(updated);
  }

  function openEditProfile() {
    setEditData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      dob: user?.dob || '',
      sex: user?.sex || '',
      nationality: user?.nationality || 'Nigerian',
      occupation: user?.occupation || '',
      employmentType: user?.employmentType || '',
      photo: user?.photo || null,
    });
    setProfileError('');
    setShowEditProfile(true);
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.show('Allow photo access in your phone settings to add a picture.', { tone: 'error' });
      return;
    }
    // The picker backgrounds the app, which must not trigger the PIN lock.
    setPickingMedia(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setEditData(d => ({ ...d, photo: `data:image/jpeg;base64,${result.assets[0].base64}` }));
      }
    } finally {
      setPickingMedia(false);
    }
  }

  async function saveProfile() {
    if (!editData.name.trim()) { setProfileError('Enter your name'); return; }
    await saveUser({ ...editData, name: editData.name.trim() });
    setShowEditProfile(false);
    toast.show('Profile updated', { tone: 'success' });
  }

  async function saveBanks() {
    await saveUser({ banks: selectedBanks });
    setShowBanks(false);
    toast.show(`${selectedBanks.length} ${selectedBanks.length === 1 ? 'bank' : 'banks'} saved`, { tone: 'success' });
  }

  async function saveIncome() {
    const value = parseAmount(incomeInput);
    if (!value) { setIncomeError('Enter your monthly income, like 450,000'); return; }
    await saveUser({ income: value });
    setShowIncome(false);
    toast.show(`Monthly income set to ${formatMoney(value)}`, { tone: 'success' });
  }

  async function saveSalaryDay() {
    const day = parseInt(salaryDayInput, 10);
    if (!(day >= 1 && day <= 31)) { setSalaryError('Enter a day from 1 to 31'); return; }
    await saveUser({ salaryDay: String(day) });
    setShowSalaryDay(false);
    toast.show(`Payday set to day ${day}`, { tone: 'success' });
  }

  async function clearSalaryDay() {
    await saveUser({ salaryDay: '' });
    setShowSalaryDay(false);
    toast.show('Payday removed. Figures now follow the calendar month.');
  }

  async function saveLockTimeout() {
    await AsyncStorage.setItem('finsight_lock_timeout', String(tempLockTimeout));
    setLockTimeout(tempLockTimeout);
    setShowLockTimeout(false);
    toast.show('Auto-lock updated', { tone: 'success' });
  }

  async function setReminder(on) {
    setReminderEnabled(on);
    await AsyncStorage.setItem('finsight_reminder_enabled', String(on));
    if (on) {
      await scheduleDailyReminder(reminderHour, reminderMinute, firstName);
      toast.show(`Daily reminder set for ${clock(reminderHour, reminderMinute)}`, { tone: 'success' });
    } else {
      await cancelDailyReminder();
    }
  }

  async function saveReminderTime() {
    setReminderHour(pickerHour);
    setReminderMinute(pickerMinute);
    setShowTimePicker(false);
    await AsyncStorage.multiSet([
      ['finsight_reminder_hour', String(pickerHour)],
      ['finsight_reminder_minute', String(pickerMinute)],
    ]);
    if (reminderEnabled) await scheduleDailyReminder(pickerHour, pickerMinute, firstName);
    toast.show(`Reminder time set to ${clock(pickerHour, pickerMinute)}`, { tone: 'success' });
  }

  async function handleExport(format) {
    if (exporting) return;
    try {
      setExporting(true);
      const raw = await AsyncStorage.getItem('finsight_transactions');
      const transactions = raw ? JSON.parse(raw) : [];
      if (!transactions.length) { toast.show('You have no transactions to export yet.'); return; }
      if (format === 'csv') await exportCSV(transactions);
      else await exportPDF(transactions, user);
    } catch (e) {
      toast.show("Couldn't create the export. Try again.", { tone: 'error' });
    } finally {
      setExporting(false);
    }
  }

  async function openCapture() {
    const granted = await isNotificationAccessGranted();
    setNotifAccessGranted(granted);
    if (granted) toast.show('Bank alert capture is already on', { tone: 'success' });
    else setShowCapture(true);
  }

  async function enableCapture() {
    setShowCapture(false);
    await openNotificationAccessSettings();
    setTimeout(async () => {
      const granted = await isNotificationAccessGranted();
      setNotifAccessGranted(granted);
      if (granted) {
        requestBatteryOptimizationExemption();
        toast.show('Bank alert capture is on', { tone: 'success' });
      }
    }, 3000);
  }

  function askRemovePin() {
    setConfirm({
      title: 'Remove your PIN?',
      body: 'Anyone holding your unlocked phone could open FinSight.',
      confirmLabel: 'Remove PIN',
      destructive: true,
      onConfirm: async () => {
        await removePin();
        setHasPin(false);
        setBiometricEnabled(false);
        toast.show('PIN removed');
      },
    });
  }

  function askClearTransactions() {
    setConfirm({
      title: 'Clear all transactions?',
      body: "This removes your whole transaction history from this phone. It can't be undone.",
      confirmLabel: 'Clear transactions',
      destructive: true,
      onConfirm: async () => {
        await AsyncStorage.removeItem('finsight_transactions');
        toast.show('Transactions cleared');
      },
    });
  }

  function askDeleteEverything() {
    setConfirm({
      title: 'Delete everything on this phone?',
      body: "This removes your profile, transactions, budgets, goals and PIN from this phone. It can't be undone. A cloud backup, if you made one, isn't affected.",
      confirmLabel: 'Delete everything',
      destructive: true,
      onConfirm: async () => {
        await cancelDailyReminder().catch(() => {});
        await wipeAllData();
        setUser(null);
      },
    });
  }

  const firstName = user?.name?.split(' ')[0] || 'there';
  const lockLabel = LOCK_TIMEOUT_OPTIONS.find(o => o.value === lockTimeout)?.label || 'Immediately';
  const goalCount = (user?.goals || []).length;
  const bankSummary = selectedBanks.length
    ? selectedBanks.slice(0, 3).join(', ') + (selectedBanks.length > 3 ? ` +${selectedBanks.length - 3} more` : '')
    : 'None added';

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, paddingBottom: space.huge, gap: space.xl }}>
        <Card onPress={openEditProfile} accessibilityLabel="Edit your profile" style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md + 2 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              {user?.photo
                ? <Image source={{ uri: user.photo }} accessibilityIgnoresInvertColors style={{ width: 60, height: 60 }} />
                : <Text variant="title" family="bold" color="onAccentSoft">{firstName[0]?.toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="heading" family="bold" numberOfLines={1}>{user?.name || 'Set up your profile'}</Text>
              <Text variant="label" family="regular" color="inkMuted" numberOfLines={1}>{user?.employmentType || user?.email || 'Add your details'}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color="inkSubtle" />
          </View>
        </Card>

        <Section title="Your money">
          <Row icon="cash-outline" title="Monthly income" subtitle={user?.income ? formatMoney(Number(user.income)) : 'Not set'}
            onPress={() => { setIncomeInput(user?.income ? String(user.income) : ''); setIncomeError(''); setShowIncome(true); }} />
          <Row icon="calendar-outline" title="Payday" subtitle={user?.salaryDay ? `Day ${user.salaryDay} of every month` : 'Not set'}
            onPress={() => { setSalaryDayInput(user?.salaryDay || '25'); setSalaryError(''); setShowSalaryDay(true); }} />
          <Row icon="flag-outline" title="Savings goals" subtitle={goalCount ? `${goalCount} ${goalCount === 1 ? 'goal' : 'goals'}` : 'None yet'}
            onPress={() => navigation?.navigate('Main', { screen: 'Plan', params: { view: 'Savings' } })} />
          <Row icon="business-outline" title="My banks" subtitle={bankSummary} onPress={() => setShowBanks(true)} last />
        </Section>

        <Section title="Alerts and reminders">
          <Row
            icon={notifAccessGranted ? 'checkmark-circle-outline' : 'notifications-outline'}
            title="Capture bank alerts"
            subtitle={notifAccessGranted ? 'On. Adds transactions from your bank notifications' : 'Add transactions from your bank notifications'}
            onPress={openCapture}
          />
          <Row icon="alarm-outline" title="Daily reminder" subtitle={reminderEnabled ? `Every day at ${clock(reminderHour, reminderMinute)}` : 'A nudge to log your spending'}
            right={<Toggle value={reminderEnabled} onValueChange={setReminder} label="Daily reminder" />} />
          <Row icon="time-outline" title="Reminder time" subtitle={clock(reminderHour, reminderMinute)}
            onPress={() => { setPickerHour(reminderHour); setPickerMinute(reminderMinute); setShowTimePicker(true); }} last />
        </Section>

        <Section title="Security">
          <Row icon="keypad-outline" title={hasPin ? 'Change PIN' : 'Set a PIN'} subtitle="6 digits to protect your data" onPress={() => setShowPinSetup(true)} last={!biometricAvailable && !hasPin} />
          {biometricAvailable ? (
            <Row icon="finger-print-outline" title="Fingerprint unlock" subtitle={biometricEnabled ? 'On' : 'Unlock without typing your PIN'}
              right={<Toggle value={biometricEnabled} onValueChange={toggleBiometric} label="Fingerprint unlock" />} last={!hasPin} />
          ) : null}
          {hasPin ? (
            <>
              <Row icon="lock-closed-outline" title="Auto-lock" subtitle={lockLabel} onPress={() => { setTempLockTimeout(lockTimeout); setShowLockTimeout(true); }} />
              <Row icon="lock-open-outline" title="Remove PIN" subtitle="Turn off PIN protection" onPress={askRemovePin} last />
            </>
          ) : null}
        </Section>

        <Section title="Appearance">
          <Row icon={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} title="Dark mode" subtitle={theme === 'dark' ? 'On' : 'Off'}
            right={<Toggle value={theme === 'dark'} onValueChange={toggleTheme} label="Dark mode" />} last />
        </Section>

        <Section title="Your data">
          <Row icon="cloud-outline" title="Cloud backup" subtitle={cloudUser ? `Signed in as ${cloudUser.email}` : 'Back up and restore your data'} onPress={() => setShowCloud(true)} />
          <Row icon="document-text-outline" title="Import a statement" subtitle="Excel or CSV from your bank" onPress={() => setShowBankImport(true)} />
          <Row icon="grid-outline" title="Export as CSV" subtitle={exporting ? 'Preparing your file' : 'Opens in Excel and Google Sheets'} onPress={() => handleExport('csv')} />
          <Row icon="document-outline" title="Export as PDF" subtitle={exporting ? 'Preparing your file' : 'A statement to share or save'} onPress={() => handleExport('pdf')} />
          <Row icon="trash-outline" title="Clear transactions" subtitle="Remove your transaction history" onPress={askClearTransactions} />
          <Row icon="warning-outline" title="Delete everything" subtitle="Remove all your data from this phone" onPress={askDeleteEverything} danger last />
        </Section>

        {isAdmin ? (
          <Section title="Admin">
            <Row icon="pulse-outline" title="Live analytics" subtitle="Stats across all users" onPress={() => setShowAdmin(true)} last />
          </Section>
        ) : null}

        {process.env.EXPO_PUBLIC_DESIGN_PREVIEW === '1' ? (
          <Section title="Test build">
            <Row icon="color-palette-outline" title="Component gallery" subtitle="Shared components, with sample data" onPress={() => setShowGallery(true)} last />
          </Section>
        ) : null}

        <Section title="About">
          <Row icon="help-circle-outline" title="How FinSight works" subtitle="FinScore, Broke Clock and ARIA"
            onPress={() => setAbout({
              title: 'How FinSight works',
              body: 'Left until payday is an estimate: your income, minus what you\'ve logged or imported since your last payday. It isn\'t your bank balance.\n\nBroke Clock shows how long your money lasts at your current spending.\n\nFinScore rates your spending, saving and tracking habits out of 100.\n\nARIA answers questions about your money using Claude, an AI model. It can make mistakes, and it isn\'t financial advice.',
            })} />
          <Row icon="shield-checkmark-outline" title="Your privacy" subtitle="Where your data goes"
            onPress={() => setAbout({
              title: 'Your privacy',
              body: 'Your transactions are stored on this phone.\n\nWhen you ask ARIA a question, a summary of your finances goes through our server to Anthropic, the AI provider, to get an answer.\n\nIf you create a cloud account, your backup and basic usage figures are stored with Google Firebase. Backups are only readable by your account.\n\nWe don\'t sell your data.',
            })} />
          <ListRow leading={<IconTile name="information-circle-outline" size={40} tone="accent" />} title="Version" subtitle="FinSight 1.0.0" divider={false} />
        </Section>
      </ScrollView>

      <FormModal visible={showEditProfile} title="Edit profile" onClose={() => setShowEditProfile(false)} onSave={saveProfile} saveLabel="Save profile">
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={editData.photo ? 'Change photo' : 'Add a photo'}>
            <View style={{ width: 92, height: 92, borderRadius: 46, overflow: 'hidden', backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>
              {editData.photo
                ? <Image source={{ uri: editData.photo }} accessibilityIgnoresInvertColors style={{ width: 92, height: 92 }} />
                : <Icon name="camera-outline" size={30} color="inkMuted" />}
            </View>
          </Pressable>
          <Text variant="label" family="semibold" color="accent" style={{ marginTop: space.sm }}>{editData.photo ? 'Change photo' : 'Add a photo'}</Text>
        </View>
        <Input label="Full name" placeholder="Your name" value={editData.name} error={profileError} onChangeText={v => { setEditData(d => ({ ...d, name: v })); setProfileError(''); }} />
        <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={editData.email} onChangeText={v => setEditData(d => ({ ...d, email: v }))} />
        <Input label="Phone number" placeholder="0800 000 0000" keyboardType="phone-pad" value={editData.phone} onChangeText={v => setEditData(d => ({ ...d, phone: v }))} />
        <View style={{ gap: space.sm }}>
          <Text variant="label">Employment</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {EMPLOYMENT_TYPES.map(o => <Chip key={o} label={o} selected={editData.employmentType === o} onPress={() => setEditData(d => ({ ...d, employmentType: d.employmentType === o ? '' : o }))} />)}
          </View>
        </View>
        <Input label="Job title" placeholder="Software engineer" value={editData.occupation} onChangeText={v => setEditData(d => ({ ...d, occupation: v }))} />
        <View style={{ gap: space.sm }}>
          <Text variant="label">Date of birth</Text>
          <DOBPicker value={editData.dob} onChange={v => setEditData(d => ({ ...d, dob: v }))} />
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="label">Sex</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {SEX_OPTIONS.map(o => <Chip key={o} label={o} selected={editData.sex === o} onPress={() => setEditData(d => ({ ...d, sex: d.sex === o ? '' : o }))} />)}
          </View>
        </View>
        <Input label="Nationality" placeholder="Nigerian" value={editData.nationality} onChangeText={v => setEditData(d => ({ ...d, nationality: v }))} />
      </FormModal>

      <FormModal visible={showBanks} title="My banks" onClose={() => setShowBanks(false)} onSave={saveBanks} saveLabel="Save banks">
        <Text color="inkMuted">Choose every bank you use. This helps recognise your alerts and gives ARIA better answers.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {NIGERIAN_BANKS.map(bank => (
            <Chip key={bank} label={bank} selected={selectedBanks.includes(bank)} onPress={() => setSelectedBanks(prev => (prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]))} />
          ))}
        </View>
      </FormModal>

      <Sheet visible={showIncome} onClose={() => setShowIncome(false)} title="Monthly income" footer={<Button full title="Save income" onPress={saveIncome} />}>
        <View style={{ gap: space.md }}>
          <Text color="inkMuted">FinSight uses this to work out what you can safely spend.</Text>
          <Input label="Amount" prefix="₦" placeholder="450,000" keyboardType="numeric" value={incomeInput} error={incomeError} onChangeText={v => { setIncomeInput(v); setIncomeError(''); }} />
        </View>
      </Sheet>

      <Sheet
        visible={showSalaryDay}
        onClose={() => setShowSalaryDay(false)}
        title="Payday"
        footer={(
          <>
            <Button full title="Save payday" onPress={saveSalaryDay} />
            {user?.salaryDay ? <Button full title="I don't have a fixed payday" variant="ghost" onPress={clearSalaryDay} /> : null}
          </>
        )}
      >
        <View style={{ gap: space.md }}>
          <Input label="Day of the month" placeholder="25" keyboardType="numeric" value={salaryDayInput} error={salaryError} hint="In shorter months, day 31 counts as the last day" onChangeText={v => { setSalaryDayInput(v); setSalaryError(''); }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {COMMON_PAYDAYS.map(d => <Chip key={d} label={`Day ${d}`} selected={salaryDayInput === d} onPress={() => { setSalaryDayInput(d); setSalaryError(''); }} />)}
          </View>
        </View>
      </Sheet>

      <Sheet visible={showLockTimeout} onClose={() => setShowLockTimeout(false)} title="Auto-lock" footer={<Button full title="Save" onPress={saveLockTimeout} />}>
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          <Text color="inkMuted">How long FinSight waits before asking for your PIN after you leave.</Text>
          {LOCK_TIMEOUT_OPTIONS.map(o => <Choice key={o.value} label={o.label} selected={tempLockTimeout === o.value} onPress={() => setTempLockTimeout(o.value)} />)}
        </View>
      </Sheet>

      <Sheet visible={showTimePicker} onClose={() => setShowTimePicker(false)} title="Reminder time" footer={<Button full title={`Set to ${clock(pickerHour, pickerMinute)}`} onPress={saveReminderTime} />}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <PickerColumn title="Hour" items={HOURS} labelOf={h => String(h).padStart(2, '0')} selected={pickerHour} onSelect={setPickerHour} />
          <PickerColumn title="Minute" items={MINUTES} labelOf={m => String(m).padStart(2, '0')} selected={pickerMinute} onSelect={setPickerMinute} />
        </View>
      </Sheet>

      <Sheet
        visible={showCapture}
        onClose={() => setShowCapture(false)}
        title="Capture bank alerts"
        footer={<Button full title="Open phone settings" onPress={enableCapture} />}
      >
        <View style={{ gap: space.sm }}>
          <Text color="inkMuted">FinSight can add transactions from your bank's notifications, so you don't have to type them.</Text>
          {['Tap Open phone settings', 'Find FinSight in the list', 'Turn it on, then come back'].map((step, i) => (
            <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="label" family="bold" color="onAccentSoft">{i + 1}</Text>
              </View>
              <Text style={{ flex: 1 }}>{step}</Text>
            </View>
          ))}
        </View>
      </Sheet>

      <Sheet visible={!!about} onClose={() => setAbout(null)} title={about?.title} footer={<Button full title="Done" variant="secondary" onPress={() => setAbout(null)} />}>
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <Text color="inkMuted">{about?.body}</Text>
        </ScrollView>
      </Sheet>

      <ConfirmSheet
        visible={!!confirm}
        destructive={confirm?.destructive}
        title={confirm?.title}
        body={confirm?.body}
        confirmLabel={confirm?.confirmLabel || ''}
        onConfirm={() => { const run = confirm.onConfirm; setConfirm(null); run(); }}
        onCancel={() => setConfirm(null)}
      />

      <Modal visible={showBankImport} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowBankImport(false)}>
        <BankImportScreen onClose={() => setShowBankImport(false)} />
      </Modal>
      <Modal visible={showCloud} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowCloud(false)}>
        <CloudAccountScreen onBack={() => setShowCloud(false)} />
      </Modal>
      <Modal visible={showGallery} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowGallery(false)}>
        <ThemeProvider scheme={galleryScheme}>
          <ToastProvider>
            <DesignGalleryScreen
              scheme={galleryScheme}
              onToggleScheme={() => setGalleryScheme(g => (g === 'dark' ? 'light' : 'dark'))}
              onClose={() => setShowGallery(false)}
            />
          </ToastProvider>
        </ThemeProvider>
      </Modal>
      <Modal visible={showAdmin} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowAdmin(false)}>
        <AdminDashboardScreen onBack={() => setShowAdmin(false)} />
      </Modal>
      <Modal visible={showPinSetup} animationType="slide" statusBarTranslucent onRequestClose={() => setShowPinSetup(false)}>
        <PinScreen
          mode="create"
          onCancel={() => setShowPinSetup(false)}
          onSuccess={() => { setShowPinSetup(false); setHasPin(true); toast.show('PIN saved', { tone: 'success' }); }}
        />
      </Modal>
    </View>
  );
}
