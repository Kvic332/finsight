import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { space } from '../constants/tokens';
import { Icon, Text } from './ui';

// The full policy, once it's published at a public address. Until then the
// summary below stands on its own and no link is shown.
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || '';

// The short version of the privacy policy, in the same words wherever it's shown.
// Keep it in step with the policy itself.
export const PRIVACY_POINTS = [
  { icon: 'phone-portrait-outline', title: 'Your money data stays on your phone', body: 'Transactions, budgets and goals are stored on your phone, encrypted.' },
  { icon: 'cloud-upload-outline', title: 'Backups only if you turn them on', body: 'With an account, a copy is kept with Google Firebase so you can restore it on another phone.' },
  { icon: 'sparkles-outline', title: 'ARIA and statements use AI when you use them', body: 'Your question and a summary of your finances, or the statement you import, go to Anthropic to get the answer. Not kept by FinSight, and not used to train AI.' },
  { icon: 'notifications-outline', title: 'Bank alerts are read on your phone', body: 'Only if you allow it, and only from bank and money apps. Alert text never leaves your phone.' },
  { icon: 'bug-outline', title: 'Crash reports without personal details', body: 'Amounts, names and transactions are removed before a report is sent to Sentry.' },
  { icon: 'shield-checkmark-outline', title: 'Never sold, no ads', body: "We don't sell your data, show ads, or share it with lenders. FinSight can't move your money." },
];

export function PrivacySummary() {
  return (
    <View style={{ gap: space.md }}>
      {PRIVACY_POINTS.map(p => (
        <View key={p.title} style={{ flexDirection: 'row', gap: space.md }}>
          <Icon name={p.icon} size={20} color="accent" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" family="semibold">{p.title}</Text>
            <Text variant="label" family="regular" color="inkMuted">{p.body}</Text>
          </View>
        </View>
      ))}
      {PRIVACY_URL ? (
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link" hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text variant="label" family="semibold" color="accent">Read the full privacy policy</Text>
          <Icon name="open-outline" size={14} color="accent" />
        </Pressable>
      ) : null}
    </View>
  );
}
