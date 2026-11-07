import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from './dataStore';
import { requestNotificationPermission } from './notificationService';
import { followUpBody, followUpTimes, OWED_KEY, openOwed } from './receivables';

const REMINDER_TYPE = 'owed_follow_up';

export async function loadOwed() {
  try {
    const raw = await AsyncStorage.getItem(OWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveOwed(list) {
  await AsyncStorage.setItem(OWED_KEY, JSON.stringify(list));
  syncOwedReminders(list);
}

// Run when the app opens, which also covers entries brought back from a backup.
export async function syncStoredOwedReminders() {
  syncOwedReminders(await loadOwed());
}

// Rebuilt from scratch on every change, so a paid or deleted entry can't still remind.
export async function syncOwedReminders(list) {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter(n => n.content?.data?.type === REMINDER_TYPE)
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    const reminders = openOwed(list).flatMap(entry => followUpTimes(entry).map(r => ({ ...r, entry })));
    if (!reminders.length || !(await requestNotificationPermission())) return;

    await Promise.all(reminders.map(({ at, after, entry }) => Notifications.scheduleNotificationAsync({
      content: {
        title: after === 0 ? 'Payment due to you today' : 'Still waiting to be paid',
        body: followUpBody(entry, after),
        data: { type: REMINDER_TYPE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    })));
  } catch (e) {
    // Reminders help, but a failure here must never stop an entry being saved.
  }
}
