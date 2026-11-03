import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from '../constants/tokens';
import { Button, ConfirmSheet, IconTile, Text, useTheme } from '../components/ui';

// Shown if stored data can't be decrypted, for example after the phone's secure
// storage was reset. The data is left untouched unless the user chooses otherwise.
export default function DataLockedScreen({ onRetry, onStartOver }) {
  const { c } = useTheme();
  const [confirm, setConfirm] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xxl, gap: space.md }}>
        <IconTile name="lock-closed-outline" size={64} tone="warning" />
        <Text variant="title" family="bold" align="center" accessibilityRole="header">We couldn't open your data</Text>
        <Text color="inkMuted" align="center">
          Your data is still on this phone, but FinSight can't unlock it right now. Restart your phone and try again.
        </Text>
      </View>
      <View style={{ padding: space.xl, gap: space.sm }}>
        <Button full title="Try again" onPress={onRetry} />
        <Button full title="Delete data and start again" variant="ghost" onPress={() => setConfirm(true)} />
      </View>
      <ConfirmSheet
        visible={confirm}
        destructive
        title="Delete your data?"
        body="This removes all your FinSight data from this phone. You can restore a cloud backup afterwards if you made one."
        confirmLabel="Delete data and start again"
        onConfirm={() => { setConfirm(false); onStartOver(); }}
        onCancel={() => setConfirm(false)}
      />
    </SafeAreaView>
  );
}
