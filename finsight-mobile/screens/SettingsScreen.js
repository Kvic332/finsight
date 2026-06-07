import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Switch, Alert, Modal, Image, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import { DARK, LIGHT } from '../constants/theme';
import BankImportScreen from './BankImportScreen';
import CloudAccountScreen from './CloudAccountScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import { onAuthChange, checkIsAdmin } from '../services/cloudSync';
import PinScreen from './PinScreen';
import { scheduleDailyReminder, cancelDailyReminder } from '../services/notificationService';
import { isNotificationAccessGranted, openNotificationAccessSettings, requestBatteryOptimizationExemption } from '../services/notificationPermission';
import { setPickingMedia } from '../services/appState';
import { exportCSV, exportPDF } from '../services/exportService';

// ── Module-level constants ─────────────────────────────────────────────────────
const NIGERIAN_BANKS = [
  'GTBank','Access Bank','Zenith Bank','First Bank','UBA','Fidelity Bank',
  'Sterling Bank','Kuda Bank','OPay','PalmPay','Moniepoint','Carbon',
  'Wema Bank','Stanbic IBTC','Union Bank','Polaris Bank','Providus Bank',
  'VFD MFB','FCMB','Ecobank','Renmoney','Fairmoney','PiggyVest','Cowrywise',
];
const EMPLOYMENT_TYPES  = ['Salary Earner','Business Owner','Freelancer','Student','Retired','Other'];
const SEX_OPTIONS       = ['Male','Female','Prefer not to say'];

const LOCK_TIMEOUT_OPTIONS = [
  { label: 'Immediately',    value: 0  },
  { label: 'After 1 minute', value: 1  },
  { label: 'After 5 minutes',value: 5  },
  { label: 'After 15 minutes',value: 15 },
  { label: 'After 1 hour',   value: 60 },
  { label: 'Never',          value: -1 },
];

// DOB picker constants
const MONTHS     = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
const MONTH_VALS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const DAYS       = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const NOW_YEAR   = new Date().getFullYear();
const YEARS      = Array.from({ length: 80 }, (_, i) => String(NOW_YEAR - i));

// ── Standalone helpers (OUTSIDE component — prevents re-mount flicker) ─────────

function SettingRow({ T, s, icon, title, subtitle, onPress, right, danger }) {
  return (
    <TouchableOpacity style={[s.row, { borderBottomColor: T.line }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.rowIcon, { backgroundColor: danger ? T.rose + '22' : T.surface2 }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: danger ? T.rose : T.ink }]}>{title}</Text>
        {subtitle ? <Text style={[s.rowSub, { color: T.mute }]}>{subtitle}</Text> : null}
      </View>
      {right || <Text style={[s.rowArrow, { color: T.mute2 }]}>›</Text>}
    </TouchableOpacity>
  );
}

function SectionHeader({ T, s, title }) {
  return <Text style={[s.sectionHeader, { color: T.mute }]}>{title}</Text>;
}

function ModalShell({ T, s, visible, title, onClose, onSave, saveLabel = 'Save', children }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]}>
        <View style={[s.modalHeader, { borderBottomColor: T.line }]}>
          <Text style={[s.modalTitle, { color: T.ink }]}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={[s.modalClose, { color: T.mute }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {children}
        </ScrollView>
        {onSave && (
          <View style={[s.modalFooter, { borderTopColor: T.line }]}>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: T.lime }]} onPress={onSave}>
              <Text style={s.saveBtnText}>{saveLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Field({ T, s, label, children }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[s.fieldLabel, { color: T.mute }]}>{label}</Text>
      {children}
    </View>
  );
}

function FInput({ T, s, value, onChangeText, placeholder, keyboard = 'default' }) {
  return (
    <TextInput
      style={[s.input, { backgroundColor: T.surface2, borderColor: T.line, color: T.ink }]}
      value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={T.mute} keyboardType={keyboard}
      autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
    />
  );
}

function ChipSelector({ T, s, options, selected, onSelect }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = selected === opt;
        return (
          <TouchableOpacity key={opt} onPress={() => onSelect(active ? '' : opt)}
            style={[s.chip, { backgroundColor: active ? T.lime : T.surface2, borderColor: active ? T.limeDeep : T.line }]}>
            <Text style={[s.chipText, { color: active ? '#0E120F' : T.ink }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Date of Birth — 3-column scrollable picker ─────────────────────────────────
// Stored as "DD/MM/YYYY". Auto-scrolls to current selection on open.
const ITEM_H = 44; // row height for scroll calculation

function DOBPicker({ T, value, onChange }) {
  const parts = (value || '').split('/');
  const [selDay,   setSelDay]   = useState(parts[0] || '');
  const [selMonth, setSelMonth] = useState(parts[1] || '');
  const [selYear,  setSelYear]  = useState(parts[2] || '');

  const dayRef   = useRef(null);
  const monthRef = useRef(null);
  const yearRef  = useRef(null);

  // Re-sync + auto-scroll when value prop changes (modal re-opened)
  useEffect(() => {
    const p = (value || '').split('/');
    const d = p[0] || '';
    const m = p[1] || '';
    const y = p[2] || '';
    setSelDay(d); setSelMonth(m); setSelYear(y);

    // Scroll each column to show the selected item
    setTimeout(() => {
      if (d && dayRef.current) {
        const idx = DAYS.indexOf(d);
        if (idx >= 0) dayRef.current.scrollTo({ y: idx * ITEM_H, animated: false });
      }
      if (m && monthRef.current) {
        const idx = MONTH_VALS.indexOf(m);
        if (idx >= 0) monthRef.current.scrollTo({ y: idx * ITEM_H, animated: false });
      }
      if (y && yearRef.current) {
        const idx = YEARS.indexOf(y);
        if (idx >= 0) yearRef.current.scrollTo({ y: idx * ITEM_H, animated: false });
      }
    }, 120); // slight delay so the ScrollView has rendered
  }, [value]);

  function notify(d, m, y) {
    if (d && m && y) onChange(`${d}/${m}/${y}`);
  }

  const colBox = {
    borderWidth: 1, borderColor: T.line, borderRadius: 12, height: 190,
    backgroundColor: T.surface,
  };

  return (
    <View>
      {/* Column headers */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
        <Text style={{ flex: 1,   fontSize: 10, color: T.mute, fontWeight: '700', letterSpacing: 1, textAlign: 'center' }}>DAY</Text>
        <Text style={{ flex: 1.7, fontSize: 10, color: T.mute, fontWeight: '700', letterSpacing: 1, textAlign: 'center' }}>MONTH</Text>
        <Text style={{ flex: 1.1, fontSize: 10, color: T.mute, fontWeight: '700', letterSpacing: 1, textAlign: 'center' }}>YEAR</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {/* Day */}
        <ScrollView ref={dayRef} style={[{ flex: 1 }, colBox]} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {DAYS.map(d => (
            <TouchableOpacity key={d} onPress={() => { setSelDay(d); notify(d, selMonth, selYear); }}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center',
                backgroundColor: selDay === d ? T.limeDeep + '30' : 'transparent' }}>
              <Text style={{ fontSize: 15, fontWeight: selDay === d ? '800' : '400',
                color: selDay === d ? T.limeDeep : T.ink }}>
                {parseInt(d, 10)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Month */}
        <ScrollView ref={monthRef} style={[{ flex: 1.7 }, colBox]} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {MONTH_VALS.map((m, i) => (
            <TouchableOpacity key={m} onPress={() => { setSelMonth(m); notify(selDay, m, selYear); }}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center',
                backgroundColor: selMonth === m ? T.limeDeep + '30' : 'transparent' }}>
              <Text style={{ fontSize: 13, fontWeight: selMonth === m ? '800' : '400',
                color: selMonth === m ? T.limeDeep : T.ink }}>
                {MONTHS[i]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Year */}
        <ScrollView ref={yearRef} style={[{ flex: 1.1 }, colBox]} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {YEARS.map(y => (
            <TouchableOpacity key={y} onPress={() => { setSelYear(y); notify(selDay, selMonth, y); }}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center',
                backgroundColor: selYear === y ? T.limeDeep + '30' : 'transparent' }}>
              <Text style={{ fontSize: 14, fontWeight: selYear === y ? '800' : '400',
                color: selYear === y ? T.limeDeep : T.ink }}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selected date preview */}
      <View style={{
        marginTop: 12, paddingVertical: 10, paddingHorizontal: 16,
        backgroundColor: (selDay && selMonth && selYear) ? T.limeDeep + '18' : T.surface2,
        borderRadius: 12, alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 14, fontWeight: '700',
          color: (selDay && selMonth && selYear) ? T.limeDeep : T.mute,
        }}>
          {(selDay && selMonth && selYear)
            ? `${MONTHS[parseInt(selMonth, 10) - 1]} ${parseInt(selDay, 10)}, ${selYear}`
            : 'Tap a day, month, and year above'}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen({ theme, toggleTheme, user, setUser }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const s = styles(T);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBanks,       setShowBanks]       = useState(false);
  const [showGoals,       setShowGoals]       = useState(false);
  const [showIncome,      setShowIncome]      = useState(false);
  const [showSalaryDay,   setShowSalaryDay]   = useState(false);
  const [showPinSetup,    setShowPinSetup]    = useState(false);
  const [showLockTimeout, setShowLockTimeout] = useState(false);
  const [biometricEnabled,  setBiometricEnabled]  = useState(false);
  const [biometricAvailable,setBiometricAvailable] = useState(false);
  const [exporting,        setExporting]        = useState(false);
  const [showBankImport,   setShowBankImport]   = useState(false);
  const [showCloud,        setShowCloud]        = useState(false);
  const [cloudUser,        setCloudUser]        = useState(null);
  const [showAdmin,        setShowAdmin]        = useState(false);
  const [isAdmin,          setIsAdmin]          = useState(false);

  const [notifAccessGranted, setNotifAccessGranted] = useState(false);
  const [reminderEnabled,    setReminderEnabled]    = useState(false);
  const [reminderHour,       setReminderHour]       = useState(21);
  const [reminderMinute,     setReminderMinute]     = useState(0);
  const [showTimePicker,     setShowTimePicker]     = useState(false);
  const [pickerHour,         setPickerHour]         = useState(21);
  const [pickerMinute,       setPickerMinute]       = useState(0);

  const [editData, setEditData] = useState({
    name:'', email:'', phone:'', dob:'', sex:'',
    nationality:'Nigerian', occupation:'', employmentType:'',
    income:'', salaryDay:'25', photo: null,
  });
  const [selectedBanks,  setSelectedBanks]  = useState([]);
  const [goals,          setGoals]          = useState([]);
  const [newGoalName,    setNewGoalName]    = useState('');
  const [newGoalTarget,  setNewGoalTarget]  = useState('');
  const [incomeInput,    setIncomeInput]    = useState('');
  const [salaryDayInput, setSalaryDayInput] = useState('25');
  const [lockTimeout,    setLockTimeout]    = useState(0);
  const [tempLockTimeout,setTempLockTimeout]= useState(0);

  useEffect(() => {
    checkNotifAccess();
    loadSettings();
    checkBiometricAvailability();
    const unsub = onAuthChange(async u => {
      setCloudUser(u);
      if (u) { const admin = await checkIsAdmin(); setIsAdmin(admin); }
      else setIsAdmin(false);
    });

    // Re-check notification access when user returns from Android settings
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkNotifAccess();
    });

    return () => { unsub(); appStateSub.remove(); };
  }, []);

  async function checkBiometricAvailability() {
    try {
      const hasHw      = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHw && isEnrolled);
      const saved = await AsyncStorage.getItem('finsight_biometric');
      setBiometricEnabled(saved === 'true');
    } catch {}
  }

  async function toggleBiometric(val) {
    if (!val) {
      // Turning off — always allowed
      setBiometricEnabled(false);
      await AsyncStorage.setItem('finsight_biometric', 'false');
      return;
    }
    const pin = await AsyncStorage.getItem('finsight_pin');
    if (!pin) {
      Alert.alert(
        'PIN Required',
        'You need to set a PIN before enabling fingerprint unlock.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set PIN Now', onPress: () => setShowPinSetup(true) },
        ]
      );
      return;
    }
    // Verify fingerprint once before enabling
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm fingerprint to enable unlock',
        fallbackLabel: 'Use PIN instead',
      });
      if (result.success) {
        setBiometricEnabled(true);
        await AsyncStorage.setItem('finsight_biometric', 'true');
        Alert.alert('✅ Enabled', 'Fingerprint unlock is now active.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not verify fingerprint. Please try again.');
    }
  }

  async function loadSettings() {
    const raw = await AsyncStorage.getItem('finsight_lock_timeout');
    if (raw !== null) setLockTimeout(parseInt(raw, 10));

    setEditData({
      name:           user?.name || '',
      email:          user?.email || '',
      phone:          user?.phone || '',
      dob:            user?.dob || '',
      sex:            user?.sex || '',
      nationality:    user?.nationality || 'Nigerian',
      occupation:     user?.occupation || '',
      employmentType: user?.employmentType || '',
      income:         user?.income?.toString() || '',
      salaryDay:      user?.salaryDay?.toString() || '25',
      photo:          user?.photo || null,
    });
    setSelectedBanks(user?.banks || []);
    setGoals(user?.goals || []);
    setIncomeInput(user?.income?.toString() || '');
    setSalaryDayInput(user?.salaryDay?.toString() || '25');

    // Load saved reminder time
    const [rh, rm] = await Promise.all([
      AsyncStorage.getItem('finsight_reminder_hour'),
      AsyncStorage.getItem('finsight_reminder_minute'),
    ]);
    if (rh !== null) setReminderHour(parseInt(rh, 10));
    if (rm !== null) setReminderMinute(parseInt(rm, 10));
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

  // Open Edit Profile — always reset form fields from the current saved user data
  function openEditProfile() {
    setEditData({
      name:           user?.name || '',
      email:          user?.email || '',
      phone:          user?.phone || '',
      dob:            user?.dob || '',
      sex:            user?.sex || '',
      nationality:    user?.nationality || 'Nigerian',
      occupation:     user?.occupation || '',
      employmentType: user?.employmentType || '',
      income:         user?.income?.toString() || '',
      salaryDay:      user?.salaryDay?.toString() || '25',
      photo:          user?.photo || null,
    });
    setShowEditProfile(true);
  }

  // ── Photo picker — suppress app-lock while the system picker is open ──────────
  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to set a profile picture.');
      return;
    }
    // Tell App.js not to lock when the picker backgrounds the app
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
      // Always re-enable lock (even if picker was cancelled)
      setPickingMedia(false);
    }
  }

  async function saveProfile() {
    if (!editData.name.trim()) { Alert.alert('Required', 'Please enter your full name.'); return; }
    await saveUser({ ...editData, income: parseInt(editData.income.replace(/,/g,'')) || user?.income || 0 });
    setShowEditProfile(false);
    Alert.alert('✅ Saved', 'Profile updated successfully.');
  }

  async function saveBanks() {
    await saveUser({ banks: selectedBanks });
    setShowBanks(false);
    Alert.alert('✅ Saved', `${selectedBanks.length} bank(s) saved.`);
  }

  async function addGoal() {
    if (!newGoalName.trim() || !newGoalTarget.trim()) {
      Alert.alert('Required', 'Enter goal name and target amount.'); return;
    }
    const updated = [...goals, { id: Date.now().toString(), name: newGoalName, target: parseInt(newGoalTarget.replace(/,/g,'')), saved: 0 }];
    setGoals(updated);
    setNewGoalName(''); setNewGoalTarget('');
    await saveUser({ goals: updated });
  }

  async function deleteGoal(id) {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    await saveUser({ goals: updated });
  }

  async function saveIncome() {
    const val = parseInt(incomeInput.replace(/,/g,''));
    if (!val || val < 1) { Alert.alert('Invalid', 'Enter a valid income amount.'); return; }
    await saveUser({ income: val });
    setShowIncome(false);
    Alert.alert('✅ Saved', `Monthly income set to ₦${val.toLocaleString()}`);
  }

  async function saveSalaryDay() {
    const day = parseInt(salaryDayInput);
    if (!day || day < 1 || day > 31) { Alert.alert('Invalid', 'Enter a day between 1 and 31.'); return; }
    await saveUser({ salaryDay: day.toString() });
    setShowSalaryDay(false);
    Alert.alert('✅ Saved', `Salary day set to day ${day}`);
  }

  async function saveLockTimeout() {
    await AsyncStorage.setItem('finsight_lock_timeout', tempLockTimeout.toString());
    setLockTimeout(tempLockTimeout);
    setShowLockTimeout(false);
    const label = LOCK_TIMEOUT_OPTIONS.find(o => o.value === tempLockTimeout)?.label || 'Immediately';
    Alert.alert('✅ Saved', `App will lock: ${label}`);
  }

  async function handleExport(format) {
    if (exporting) return;
    try {
      setExporting(true);
      const raw = await AsyncStorage.getItem('finsight_transactions');
      const transactions = raw ? JSON.parse(raw) : [];
      if (!transactions.length) {
        Alert.alert('No Data', 'You have no transactions to export yet.'); return;
      }
      if (format === 'csv') {
        await exportCSV(transactions);
      } else {
        await exportPDF(transactions, user);
      }
    } catch (e) {
      Alert.alert('Export Failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function removePin() {
    Alert.alert('Remove PIN', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem('finsight_pin');
        Alert.alert('Done', 'PIN removed.');
      }},
    ]);
  }

  async function clearAllData() {
    Alert.alert('Clear All Data', 'This will delete everything and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear Everything', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove(['finsight_transactions','finsight_user','finsight_pin','finsight_theme','finsight_lock_timeout']);
        setUser(null);
      }},
    ]);
  }

  const firstName = user?.name?.split(' ')[0] || 'User';
  const initial   = firstName[0]?.toUpperCase() || 'U';
  const lockLabel = LOCK_TIMEOUT_OPTIONS.find(o => o.value === lockTimeout)?.label || 'Immediately';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        <View style={s.header}>
          <Text style={[s.eyebrow, { color: T.mute }]}>PREFERENCES</Text>
          <Text style={[s.title, { color: T.ink }]}>Settings</Text>
        </View>

        {/* Profile Card */}
        <TouchableOpacity style={[s.profileCard, { backgroundColor: T.surface, borderColor: T.line }]}
          onPress={openEditProfile} activeOpacity={0.8}>
          <View style={[s.avatar, { backgroundColor: T.ink }]}>
            {user?.photo
              ? <Image source={{ uri: user.photo }} style={s.avatarImg} />
              : <Text style={[s.avatarText, { color: T.lime }]}>{initial}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.profileName, { color: T.ink }]}>{user?.name || 'Tap to set up profile'}</Text>
            <Text style={[s.profileEmail, { color: T.mute }]}>
              {user?.employmentType || user?.email || 'No email set'}
            </Text>
            {user?.nationality ? <Text style={[s.profileEmail, { color: T.mute }]}>{user.nationality}</Text> : null}
            <View style={[s.profileBadge, { backgroundColor: T.lime + '22', borderColor: T.limeDeep }]}>
              <Text style={[s.profileBadgeText, { color: T.limeDeep }]}>Edit profile →</Text>
            </View>
          </View>
        </TouchableOpacity>

        <SectionHeader T={T} s={s} title="APPEARANCE" />
        <View style={[s.section, { backgroundColor: T.surface }]}>
          <SettingRow T={T} s={s} icon={theme==='dark'?'🌙':'☀️'} title="Theme"
            subtitle={theme==='dark'?'Dark mode active':'Light mode active'}
            right={<Switch value={theme==='dark'} onValueChange={toggleTheme}
              trackColor={{ false: T.line2, true: T.limeDeep }} thumbColor={T.surface} />} />
        </View>

        <SectionHeader T={T} s={s} title="SECURITY" />
        <View style={[s.section, { backgroundColor: T.surface }]}>
          <SettingRow T={T} s={s} icon="🔐" title="Set / Change PIN" subtitle="6-digit PIN to protect your data" onPress={() => setShowPinSetup(true)} />
          {biometricAvailable && (
            <SettingRow T={T} s={s} icon="🫆" title="Fingerprint unlock"
              subtitle={biometricEnabled ? 'Active — tap fingerprint to unlock' : 'Use fingerprint instead of PIN'}
              right={<Switch value={biometricEnabled} onValueChange={toggleBiometric}
                trackColor={{ false: T.line2, true: T.limeDeep }} thumbColor={T.surface} />} />
          )}
          <SettingRow T={T} s={s} icon="⏱️" title="Auto-lock timer" subtitle={lockLabel}
            onPress={() => { setTempLockTimeout(lockTimeout); setShowLockTimeout(true); }} />
          <SettingRow T={T} s={s} icon="🗑️" title="Remove PIN" subtitle="Disable PIN protection" onPress={removePin} />
        </View>

        <SectionHeader T={T} s={s} title="NOTIFICATIONS & REMINDERS" />
        <View style={[s.section, { backgroundColor: T.surface }]}>
          <SettingRow T={T} s={s}
            icon={notifAccessGranted ? '✅' : '🔔'}
            title="Auto-capture bank alerts"
            subtitle={notifAccessGranted ? 'Active — capturing GTBank, OPay, PalmPay etc.' : 'Tap to enable automatic detection'}
            onPress={async () => {
              const granted = await isNotificationAccessGranted();
              setNotifAccessGranted(granted);
              if (granted) {
                Alert.alert('✅ Already Active', 'FinSight is capturing bank notifications automatically.', [{ text: 'Great!' }]);
              } else {
                Alert.alert('🔔 Enable Bank Alert Capture',
                  'Allow FinSight to read bank notifications.\n\n1. Tap "Enable Now"\n2. Find FinSight\n3. Toggle ON',
                  [{ text: 'Cancel', style: 'cancel' },
                  { text: 'Enable Now →', onPress: async () => {
                    await openNotificationAccessSettings();
                    setTimeout(async () => {
                      const g = await isNotificationAccessGranted();
                      setNotifAccessGranted(g);
                      if (g) { requestBatteryOptimizationExemption(); Alert.alert('🎉 Activated!', 'FinSight will now capture all bank alerts!'); }
                    }, 3000);
                  }}]);
              }
            }} />
          <SettingRow T={T} s={s} icon="⏰" title="Daily reminder"
            subtitle={reminderEnabled ? `ARIA reminds you at ${String(reminderHour).padStart(2,'0')}:${String(reminderMinute).padStart(2,'0')} daily` : 'Get daily nudge to log expenses'}
            right={<Switch value={reminderEnabled} onValueChange={async val => {
              setReminderEnabled(val);
              if (val) {
                await scheduleDailyReminder(reminderHour, reminderMinute, firstName);
                Alert.alert('Reminder set!', `ARIA will remind you at ${String(reminderHour).padStart(2,'0')}:${String(reminderMinute).padStart(2,'0')}`);
              } else await cancelDailyReminder();
            }} trackColor={{ false: T.line2, true: T.limeDeep }} thumbColor={T.surface} />} />
          <SettingRow T={T} s={s} icon="🕘" title="Reminder time"
            subtitle={`Currently: ${String(reminderHour).padStart(2,'0')}:${String(reminderMinute).padStart(2,'0')}`}
            onPress={() => { setPickerHour(reminderHour); setPickerMinute(reminderMinute); setShowTimePicker(true); }} />
        </View>

        <SectionHeader T={T} s={s} title="FINANCIAL PROFILE" />
        <View style={[s.section, { backgroundColor: T.surface }]}>
          <SettingRow T={T} s={s} icon="🏦" title="My Banks"
            subtitle={selectedBanks.length ? selectedBanks.slice(0,3).join(', ')+(selectedBanks.length>3?` +${selectedBanks.length-3} more`:'') : 'No banks added'}
            onPress={() => setShowBanks(true)} />
          <SettingRow T={T} s={s} icon="🎯" title="Savings Goals"
            subtitle={`${goals.length} goal${goals.length!==1?'s':''} active`}
            onPress={() => setShowGoals(true)} />
          <SettingRow T={T} s={s} icon="💰" title="Monthly Income"
            subtitle={user?.income ? `₦${Number(user.income).toLocaleString()}` : 'Not set'}
            onPress={() => setShowIncome(true)} />
          <SettingRow T={T} s={s} icon="📅" title="Salary Day"
            subtitle={user?.salaryDay ? `Day ${user.salaryDay} of every month` : 'Not set'}
            onPress={() => setShowSalaryDay(true)} />
        </View>

        {isAdmin && (
          <>
            <SectionHeader T={T} s={s} title="ADMIN" />
            <View style={[s.section, { backgroundColor: T.surface }]}>
              <SettingRow T={T} s={s} icon="📡" title="Live Analytics Dashboard"
                subtitle="Real-time stats across all users"
                onPress={() => setShowAdmin(true)} />
            </View>
          </>
        )}

        <SectionHeader T={T} s={s} title="DATA" />
        <View style={[s.section, { backgroundColor: T.surface }]}>
          <SettingRow T={T} s={s} icon="☁️" title="Cloud Account & Backup"
            subtitle={cloudUser ? `Signed in as ${cloudUser.email}` : 'Back up & restore your data'}
            onPress={() => setShowCloud(true)} />
          <SettingRow T={T} s={s} icon="📊" title="Export as CSV"
            subtitle={exporting ? 'Preparing export…' : 'Spreadsheet · opens in Excel, Google Sheets'}
            onPress={() => handleExport('csv')} />
          <SettingRow T={T} s={s} icon="📄" title="Export as PDF"
            subtitle={exporting ? 'Preparing export…' : 'Formatted statement · share or save to Drive'}
            onPress={() => handleExport('pdf')} />
          <SettingRow T={T} s={s} icon="📂" title="Import Bank Statement"
            subtitle="Upload CSV from GTBank, Kuda, PalmPay & more"
            onPress={() => setShowBankImport(true)} />
          <SettingRow T={T} s={s} icon="🔄" title="Clear Transactions" subtitle="Remove all transaction history"
            onPress={() => Alert.alert('Clear Transactions', 'Delete all transactions?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: async () => {
                await AsyncStorage.removeItem('finsight_transactions');
                Alert.alert('Done', 'All transactions cleared.');
              }},
            ])} />
          <SettingRow T={T} s={s} icon="🗑️" title="Delete Account" subtitle="Clear all data and start over" onPress={clearAllData} danger />
        </View>

        <SectionHeader T={T} s={s} title="ABOUT" />
        <View style={[s.section, { backgroundColor: T.surface }]}>
          <SettingRow T={T} s={s} icon="📖" title="How FinSight works" subtitle="Learn about FinScore, Broke Clock & ARIA"
            onPress={() => Alert.alert('FinSight', 'FinSight is a personal finance OS built for Nigerians.\n\n• FinScore: Composite health score\n• Broke Clock™: Predicts days until broke\n• ARIA: AI finance advisor powered by Claude')} />
          <SettingRow T={T} s={s} icon="🛡️" title="Privacy Policy" subtitle="How we handle your data"
            onPress={() => Alert.alert('Privacy', 'All data is stored locally on your device. We never sell your data.')} />
          <SettingRow T={T} s={s} icon="ℹ️" title="Version" subtitle="FinSight v1.0.0 · Built with ❤️ in Lagos" onPress={() => {}} />
        </View>
      </ScrollView>

      {/* ── EDIT PROFILE ──────────────────────────────────────────────────────── */}
      <ModalShell T={T} s={s} visible={showEditProfile} title="Edit Profile"
        onClose={() => setShowEditProfile(false)} onSave={saveProfile} saveLabel="Save Profile">

        {/* Photo */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            <View style={[s.photoPicker, { backgroundColor: T.surface2, borderColor: T.line }]}>
              {editData.photo
                ? <Image source={{ uri: editData.photo }} style={s.photoImg} />
                : <View style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 36 }}>📷</Text>
                    <Text style={[s.photoLabel, { color: T.mute }]}>Add photo</Text>
                  </View>}
            </View>
            <View style={[s.photoEdit, { backgroundColor: T.lime }]}>
              <Text style={{ fontSize: 12 }}>✏️</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[s.groupLabel, { color: T.mute }]}>PERSONAL INFORMATION</Text>
        <Field T={T} s={s} label="FULL NAME *">
          <FInput T={T} s={s} value={editData.name} onChangeText={v => setEditData(d=>({...d,name:v}))} placeholder="Your full name" />
        </Field>

        {/* DOB — 3-column wheel picker */}
        <Field T={T} s={s} label="DATE OF BIRTH">
          <DOBPicker T={T} value={editData.dob} onChange={v => setEditData(d => ({ ...d, dob: v }))} />
        </Field>

        <Field T={T} s={s} label="SEX">
          <ChipSelector T={T} s={s} options={SEX_OPTIONS} selected={editData.sex} onSelect={v => setEditData(d=>({...d,sex:v}))} />
        </Field>
        <Field T={T} s={s} label="NATIONALITY">
          <FInput T={T} s={s} value={editData.nationality} onChangeText={v => setEditData(d=>({...d,nationality:v}))} placeholder="e.g. Nigerian" />
        </Field>

        <Text style={[s.groupLabel, { color: T.mute, marginTop: 8 }]}>CONTACT</Text>
        <Field T={T} s={s} label="EMAIL">
          <FInput T={T} s={s} value={editData.email} onChangeText={v => setEditData(d=>({...d,email:v}))} placeholder="you@example.com" keyboard="email-address" />
        </Field>
        <Field T={T} s={s} label="PHONE NUMBER">
          <FInput T={T} s={s} value={editData.phone} onChangeText={v => setEditData(d=>({...d,phone:v}))} placeholder="+234 800 000 0000" keyboard="phone-pad" />
        </Field>

        <Text style={[s.groupLabel, { color: T.mute, marginTop: 8 }]}>EMPLOYMENT</Text>
        <Field T={T} s={s} label="EMPLOYMENT TYPE">
          <ChipSelector T={T} s={s} options={EMPLOYMENT_TYPES} selected={editData.employmentType} onSelect={v => setEditData(d=>({...d,employmentType:v}))} />
        </Field>
        <Field T={T} s={s} label="OCCUPATION / JOB TITLE">
          <FInput T={T} s={s} value={editData.occupation} onChangeText={v => setEditData(d=>({...d,occupation:v}))} placeholder="e.g. Software Engineer" />
        </Field>

        <Text style={[s.groupLabel, { color: T.mute, marginTop: 8 }]}>FINANCIAL</Text>
        <Field T={T} s={s} label="MONTHLY INCOME (₦)">
          <FInput T={T} s={s} value={editData.income} onChangeText={v => setEditData(d=>({...d,income:v}))} placeholder="e.g. 450000" keyboard="numeric" />
        </Field>
        <Field T={T} s={s} label="SALARY DAY (day of month)">
          <FInput T={T} s={s} value={editData.salaryDay} onChangeText={v => setEditData(d=>({...d,salaryDay:v}))} placeholder="e.g. 25" keyboard="numeric" />
        </Field>
      </ModalShell>

      {/* ── MY BANKS ──────────────────────────────────────────────────────────── */}
      <ModalShell T={T} s={s} visible={showBanks} title="My Banks"
        onClose={() => setShowBanks(false)} onSave={saveBanks} saveLabel="Save Banks">
        <Text style={[s.modalHint, { color: T.mute, marginBottom: 16 }]}>Select all banks you use:</Text>
        <View style={{ gap: 10 }}>
          {NIGERIAN_BANKS.map(bank => {
            const active = selectedBanks.includes(bank);
            return (
              <TouchableOpacity key={bank} activeOpacity={0.7}
                style={[s.bankRow, { backgroundColor: active ? T.lime+'22' : T.surface2, borderColor: active ? T.limeDeep : T.line }]}
                onPress={() => setSelectedBanks(prev => active ? prev.filter(b=>b!==bank) : [...prev,bank])}>
                <Text style={[s.bankName, { color: T.ink }]}>{bank}</Text>
                <Text style={{ fontSize: 18 }}>{active ? '✅' : '○'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ModalShell>

      {/* ── SAVINGS GOALS ─────────────────────────────────────────────────────── */}
      <ModalShell T={T} s={s} visible={showGoals} title="Savings Goals" onClose={() => setShowGoals(false)}>
        <Text style={[s.groupLabel, { color: T.mute }]}>ADD NEW GOAL</Text>
        <TextInput style={[s.input, { backgroundColor: T.surface2, borderColor: T.line, color: T.ink, marginBottom: 10 }]}
          placeholder="Goal name (e.g. New Laptop)" placeholderTextColor={T.mute}
          value={newGoalName} onChangeText={setNewGoalName} />
        <TextInput style={[s.input, { backgroundColor: T.surface2, borderColor: T.line, color: T.ink, marginBottom: 12 }]}
          placeholder="Target amount (₦)" placeholderTextColor={T.mute} keyboardType="numeric"
          value={newGoalTarget} onChangeText={setNewGoalTarget} />
        <TouchableOpacity style={[s.saveBtn, { backgroundColor: T.lime, marginBottom: 28 }]} onPress={addGoal}>
          <Text style={s.saveBtnText}>+ Add Goal</Text>
        </TouchableOpacity>
        {goals.length > 0 && <>
          <Text style={[s.groupLabel, { color: T.mute }]}>YOUR GOALS</Text>
          {goals.map(g => (
            <View key={g.id} style={[s.goalCard, { backgroundColor: T.surface2, borderColor: T.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.goalName, { color: T.ink }]}>{g.name}</Text>
                <Text style={[s.goalTarget, { color: T.mute }]}>Target: ₦{Number(g.target).toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={() => Alert.alert('Delete Goal', `Delete "${g.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteGoal(g.id) },
              ])}>
                <Text style={{ fontSize: 20 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>}
        {goals.length === 0 && (
          <Text style={[s.modalHint, { color: T.mute, textAlign: 'center', marginTop: 20 }]}>No goals yet. Add one above!</Text>
        )}
      </ModalShell>

      {/* ── MONTHLY INCOME ────────────────────────────────────────────────────── */}
      <ModalShell T={T} s={s} visible={showIncome} title="Monthly Income"
        onClose={() => setShowIncome(false)} onSave={saveIncome} saveLabel="Save Income">
        <Text style={[s.modalHint, { color: T.mute, marginBottom: 20 }]}>
          Used to calculate your FinScore, Broke Clock, and savings rate.
        </Text>
        <Field T={T} s={s} label="MONTHLY INCOME (₦)">
          <FInput T={T} s={s} value={incomeInput} onChangeText={setIncomeInput} placeholder="e.g. 450000" keyboard="numeric" />
        </Field>
        {incomeInput ? (
          <Text style={[s.modalHint, { color: T.limeDeep, marginTop: 4 }]}>
            = ₦{parseInt(incomeInput.replace(/,/g,'')||0).toLocaleString()} / month
          </Text>
        ) : null}
      </ModalShell>

      {/* ── SALARY DAY ────────────────────────────────────────────────────────── */}
      <ModalShell T={T} s={s} visible={showSalaryDay} title="Salary Day"
        onClose={() => setShowSalaryDay(false)} onSave={saveSalaryDay} saveLabel="Save">
        <Text style={[s.modalHint, { color: T.mute, marginBottom: 20 }]}>
          Which day of the month do you receive your salary or main income?
        </Text>
        <Field T={T} s={s} label="DAY OF MONTH (1 – 31)">
          <FInput T={T} s={s} value={salaryDayInput} onChangeText={setSalaryDayInput} placeholder="e.g. 25" keyboard="numeric" />
        </Field>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {[1,5,10,15,20,25,28,30].map(d => (
            <TouchableOpacity key={d} onPress={() => setSalaryDayInput(d.toString())}
              style={[s.chip, { backgroundColor: salaryDayInput===d.toString() ? T.lime : T.surface2, borderColor: salaryDayInput===d.toString() ? T.limeDeep : T.line }]}>
              <Text style={[s.chipText, { color: salaryDayInput===d.toString() ? '#0E120F' : T.ink }]}>Day {d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ModalShell>

      {/* ── AUTO-LOCK TIMER ───────────────────────────────────────────────────── */}
      <ModalShell T={T} s={s} visible={showLockTimeout} title="Auto-lock Timer"
        onClose={() => setShowLockTimeout(false)} onSave={saveLockTimeout} saveLabel="Save">
        <Text style={[s.modalHint, { color: T.mute, marginBottom: 20 }]}>
          How long should the app wait before asking for your PIN when you leave?
        </Text>
        <View style={{ gap: 10 }}>
          {LOCK_TIMEOUT_OPTIONS.map(opt => {
            const active = tempLockTimeout === opt.value;
            return (
              <TouchableOpacity key={opt.value} activeOpacity={0.7}
                style={[s.bankRow, { backgroundColor: active ? T.lime+'22' : T.surface2, borderColor: active ? T.limeDeep : T.line }]}
                onPress={() => setTempLockTimeout(opt.value)}>
                <Text style={[s.bankName, { color: T.ink }]}>{opt.label}</Text>
                <Text style={{ fontSize: 18 }}>{active ? '✅' : '○'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ModalShell>

      {/* ── TIME PICKER MODAL ─────────────────────────────────────────────────── */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center' }}>
          <View style={{ backgroundColor:T.surface, borderRadius:20, padding:24, width:'85%' }}>
            <Text style={{ color:T.text, fontSize:18, fontWeight:'800', marginBottom:20, textAlign:'center' }}>Set Reminder Time</Text>

            {/* Hour + Minute selectors */}
            <View style={{ flexDirection:'row', justifyContent:'center', alignItems:'flex-start', gap:16 }}>
              {/* Hours */}
              <View style={{ alignItems:'center', flex:1 }}>
                <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:8 }}>HOUR</Text>
                <View style={{ height:200, overflow:'hidden', borderRadius:12, backgroundColor:T.bg }}>
                  <ScrollView showsVerticalScrollIndicator={false} snapToInterval={44} decelerationRate="fast">
                    {Array.from({length:24},(_,i)=>i).map(h => (
                      <TouchableOpacity key={h} onPress={() => setPickerHour(h)}
                        style={{ height:44, justifyContent:'center', alignItems:'center',
                          backgroundColor: pickerHour===h ? T.lime+'33' : 'transparent',
                          borderRadius:8, marginHorizontal:4 }}>
                        <Text style={{ color: pickerHour===h ? T.lime : T.text, fontSize:20, fontWeight: pickerHour===h?'800':'400' }}>
                          {String(h).padStart(2,'0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <Text style={{ color:T.text, fontSize:28, fontWeight:'800', marginTop:90 }}>:</Text>

              {/* Minutes */}
              <View style={{ alignItems:'center', flex:1 }}>
                <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:8 }}>MINUTE</Text>
                <View style={{ height:200, overflow:'hidden', borderRadius:12, backgroundColor:T.bg }}>
                  <ScrollView showsVerticalScrollIndicator={false} snapToInterval={44} decelerationRate="fast">
                    {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                      <TouchableOpacity key={m} onPress={() => setPickerMinute(m)}
                        style={{ height:44, justifyContent:'center', alignItems:'center',
                          backgroundColor: pickerMinute===m ? T.lime+'33' : 'transparent',
                          borderRadius:8, marginHorizontal:4 }}>
                        <Text style={{ color: pickerMinute===m ? T.lime : T.text, fontSize:20, fontWeight: pickerMinute===m?'800':'400' }}>
                          {String(m).padStart(2,'0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            {/* Preview */}
            <Text style={{ color:T.textMuted, textAlign:'center', marginTop:16, fontSize:13 }}>
              Reminder at{' '}
              <Text style={{ color:T.lime, fontWeight:'800', fontSize:16 }}>
                {String(pickerHour).padStart(2,'0')}:{String(pickerMinute).padStart(2,'0')}
              </Text>
              {' '}({pickerHour<12 ? 'AM' : 'PM'})
            </Text>

            {/* Buttons */}
            <View style={{ flexDirection:'row', gap:12, marginTop:20 }}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}
                style={{ flex:1, padding:14, borderRadius:12, borderWidth:1, borderColor:T.line2, alignItems:'center' }}>
                <Text style={{ color:T.textMuted, fontWeight:'700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                  setReminderHour(pickerHour);
                  setReminderMinute(pickerMinute);
                  setShowTimePicker(false);
                  await AsyncStorage.setItem('finsight_reminder_hour', String(pickerHour));
                  await AsyncStorage.setItem('finsight_reminder_minute', String(pickerMinute));
                  if (reminderEnabled) {
                    await scheduleDailyReminder(pickerHour, pickerMinute, firstName);
                    Alert.alert('Reminder updated!', `ARIA will remind you at ${String(pickerHour).padStart(2,'0')}:${String(pickerMinute).padStart(2,'0')}`);
                  }
                }}
                style={{ flex:1, padding:14, borderRadius:12, backgroundColor:T.lime, alignItems:'center' }}>
                <Text style={{ color:'#0E120F', fontWeight:'800' }}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── BANK IMPORT ───────────────────────────────────────────────────────── */}
      <Modal visible={showBankImport} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowBankImport(false)}>
        <BankImportScreen theme={theme} onClose={() => setShowBankImport(false)} />
      </Modal>

      {/* ── CLOUD ACCOUNT ────────────────────────────────────────────────────── */}
      <Modal visible={showCloud} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowCloud(false)}>
        <CloudAccountScreen theme={theme} onBack={() => setShowCloud(false)} />
      </Modal>

      {/* ── ADMIN DASHBOARD ──────────────────────────────────────────────────── */}
      <Modal visible={showAdmin} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowAdmin(false)}>
        <AdminDashboardScreen theme={theme} onBack={() => setShowAdmin(false)} />
      </Modal>

      {/* ── PIN SETUP ─────────────────────────────────────────────────────────── */}
      {showPinSetup && (
        <View style={StyleSheet.absoluteFill}>
          <PinScreen theme={theme} mode="create"
            onSuccess={() => { setShowPinSetup(false); Alert.alert('PIN Set', 'Your PIN has been saved.'); }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe:             { flex: 1 },
  header:           { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  eyebrow:          { fontSize: 9, letterSpacing: 2.5, fontWeight: '700', marginBottom: 4 },
  title:            { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },

  // Profile card — more premium
  profileCard: {
    margin: 16, borderRadius: 22, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatar:           { width: 66, height: 66, borderRadius: 33, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:        { width: 66, height: 66, borderRadius: 33 },
  avatarText:       { fontSize: 25, fontWeight: '800' },
  profileName:      { fontSize: 18, fontWeight: '800', marginBottom: 2, letterSpacing: -0.3 },
  profileEmail:     { fontSize: 12, marginBottom: 6, fontWeight: '500' },
  profileBadge:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  profileBadgeText: { fontSize: 11, fontWeight: '700' },

  // Section groupings
  sectionHeader: {
    fontSize: 9, letterSpacing: 2.5, fontWeight: '700',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10,
  },
  section: {
    marginHorizontal: 16, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: T.line,
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1 },
  rowIcon:  { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  rowSub:   { fontSize: 12, marginTop: 2, lineHeight: 16 },
  rowArrow: { fontSize: 20, fontWeight: '300', opacity: 0.5 },

  // Modals
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1,
  },
  modalTitle:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalClose:   { fontSize: 20, padding: 4 },
  modalHint:    { fontSize: 13, lineHeight: 21 },
  modalFooter:  { padding: 20, borderTopWidth: 1 },
  saveBtn:      { borderRadius: 16, padding: 17, alignItems: 'center' },
  saveBtnText:  { color: '#0E120F', fontWeight: '800', fontSize: 16 },
  fieldLabel:   { fontSize: 9, letterSpacing: 2.5, fontWeight: '700', marginBottom: 8 },
  groupLabel:   { fontSize: 9, letterSpacing: 2.5, fontWeight: '700', marginBottom: 12 },
  input:        { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16, fontWeight: '500' },
  chip:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  chipText:     { fontSize: 13, fontWeight: '600' },

  photoPicker:  { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photoImg:     { width: 100, height: 100, borderRadius: 50 },
  photoLabel:   { fontSize: 11, fontWeight: '500' },
  photoEdit:    { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  bankRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1 },
  bankName:     { fontSize: 15, fontWeight: '600' },
  goalCard:     { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  goalName:     { fontSize: 15, fontWeight: '700', marginBottom: 2, letterSpacing: -0.2 },
  goalTarget:   { fontSize: 12 },
});
