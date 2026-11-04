import { NativeModules, Platform } from 'react-native';
import AsyncStorage from './dataStore';
import { mergeBankAlerts } from './alerts';
import { BANK_APPS, BANK_SENDERS } from './bankAlertParser';

const { NotificationPermission } = NativeModules;

// False on an APK built before the bridge was connected, which updates can still reach.
export function isCaptureSupported() {
  return Platform.OS === 'android' && !!NotificationPermission?.getPendingAlerts;
}

// ── Check if notification access is granted ───────────────────────────────────
export async function isNotificationAccessGranted() {
  if (!isCaptureSupported()) return false;
  try {
    return await NotificationPermission.isNotificationAccessGranted();
  } catch (e) {
    return false;
  }
}

// ── Open notification access settings ────────────────────────────────────────
export async function openNotificationAccessSettings() {
  if (!isCaptureSupported()) return;
  try {
    await NotificationPermission.openNotificationAccessSettings();
  } catch (e) {
    console.log('Error opening settings:', e);
  }
}

// ── Open this app's info page, where Android unblocks restricted settings ─────
export async function openAppInfo() {
  if (!isCaptureSupported()) return;
  try {
    await NotificationPermission.openAppInfo();
  } catch (e) {
    console.log('Error opening app info:', e);
  }
}

// ── Request battery optimization exemption ────────────────────────────────────
// Prevents the OS from killing BankNotificationService on aggressive-battery phones.
export async function requestBatteryOptimizationExemption() {
  if (!isCaptureSupported()) return;
  try {
    await NotificationPermission.requestBatteryOptimizationExemption();
  } catch (e) {}
}

// ── Bring queued bank alerts into the app ─────────────────────────────────────
// The Android service can't reach the encrypted store, so it queues alert text. The
// queue is only cleared once the transactions are saved, so a failed save loses
// nothing. This also runs when the app opens and returns, so it must not overlap.
let syncing = false;

export async function syncBankAlerts() {
  if (!isCaptureSupported() || syncing) return;
  syncing = true;
  try {
    await NotificationPermission.setCaptureSources(JSON.stringify(Object.keys(BANK_APPS)), JSON.stringify(BANK_SENDERS));
    const alerts = JSON.parse(await NotificationPermission.getPendingAlerts() || '[]');
    if (!alerts.length) return;
    const raw = await AsyncStorage.getItem('finsight_transactions');
    const { added, merged } = mergeBankAlerts(raw ? JSON.parse(raw) : [], alerts);
    if (added.length) await AsyncStorage.setItem('finsight_transactions', JSON.stringify(merged));
    await NotificationPermission.removePendingAlerts(JSON.stringify(alerts.map(a => a.id)));
  } catch (e) {
    // The alerts stay queued for the next try.
  } finally {
    syncing = false;
  }
}
