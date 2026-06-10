import { NativeModules, Platform } from 'react-native';

const { NotificationPermission } = NativeModules;

// ── Check if notification access is granted ───────────────────────────────────
export async function isNotificationAccessGranted() {
  if (Platform.OS !== 'android') return false;
  try {
    return await NotificationPermission.isNotificationAccessGranted();
  } catch (e) {
    return false;
  }
}

// ── Open notification access settings ────────────────────────────────────────
export async function openNotificationAccessSettings() {
  if (Platform.OS !== 'android') return;
  try {
    await NotificationPermission.openNotificationAccessSettings();
  } catch (e) {
    console.log('Error opening settings:', e);
  }
}

// ── Enable or disable the notification listener ───────────────────────────────
export async function setNotificationListenerEnabled(enabled) {
  if (Platform.OS !== 'android') return;
  try {
    await NotificationPermission.setNotificationListenerEnabled(enabled);
  } catch (e) {
    console.log('Error setting listener:', e);
  }
}

// ── Request battery optimization exemption ────────────────────────────────────
// Prevents the OS from killing BankNotificationService on aggressive-battery phones.
export async function requestBatteryOptimizationExemption() {
  if (Platform.OS !== 'android') return;
  try {
    await NotificationPermission.requestBatteryOptimizationExemption();
  } catch (e) {}
}

// ── Drain the pending transaction queue written by BankNotificationService ────
// AsyncStorage v2 uses SQLite so the native service can't write there directly.
// Instead it queues to SharedPreferences; this call reads + clears that queue
// and returns a parsed array of transaction objects (may be empty).
export async function drainPendingTransactions() {
  if (Platform.OS !== 'android') return [];
  try {
    const raw = await NotificationPermission.drainPendingTransactions();
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
