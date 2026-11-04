import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from './dataStore';
import { requestNotificationPermission } from './notificationService';
import { activeDebts, reminderBody, reminderTimes } from './debts';

const REMINDER_TYPE = 'debt_due';

// Run when the app opens, which also covers debts brought back from a backup.
export async function syncStoredDebtReminders() {
  try {
    const raw = await AsyncStorage.getItem('finsight_debts');
    if (raw) await syncDebtReminders(JSON.parse(raw));
  } catch (e) {
    // Handled like any other reminder failure.
  }
}

// Rebuilt from scratch on every change, so a paid or deleted debt can't still remind.
export async function syncDebtReminders(debts) {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter(n => n.content?.data?.type === REMINDER_TYPE)
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    const reminders = activeDebts(debts).flatMap(debt => reminderTimes(debt)
      .map(reminder => ({ ...reminder, lender: debt.lender })));
    if (!reminders.length || !(await requestNotificationPermission())) return;

    await Promise.all(reminders.map(({ at, daysBefore, lender }) => Notifications.scheduleNotificationAsync({
      content: {
        title: 'Loan payment coming up',
        body: reminderBody(lender, daysBefore),
        data: { type: REMINDER_TYPE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    })));
  } catch (e) {
    // Reminders help, but a failure here must never stop a debt being saved.
  }
}
