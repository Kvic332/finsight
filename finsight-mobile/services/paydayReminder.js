import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermission } from './notificationService';
import { paydayReminderTimes } from './paydayPlan';
import { paydaysOf } from './finance';

export const PAYDAY_REMINDER_TYPE = 'payday';

// Rebuilt from scratch on every change, so an old payday can't still remind.
// Pass null to clear them, such as when the app's data is wiped.
export async function syncPaydayReminder(user) {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter(n => n.content?.data?.type === PAYDAY_REMINDER_TYPE)
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    if (!user || user.paydayReminder === false) return;
    const times = paydayReminderTimes(paydaysOf(user));
    if (!times.length || !(await requestNotificationPermission())) return;

    await Promise.all(times.map(date => Notifications.scheduleNotificationAsync({
      content: {
        title: "It's payday",
        body: 'See how to split your pay before you start spending.',
        data: { type: PAYDAY_REMINDER_TYPE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    })));
  } catch (e) {
    // Reminders help, but a failure here must never stop the app or a save.
  }
}
