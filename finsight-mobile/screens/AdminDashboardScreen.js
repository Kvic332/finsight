import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from '../constants/tokens';
import {
  Badge, Card, EmptyState, IconButton, ProgressBar, Text, useTheme,
} from '../components/ui';
import { subscribeAllUsers } from '../services/cloudSync';

const FEATURES = [
  ['transactions_added', 'Transactions logged'],
  ['dashboard_views', 'Home and Insights views'],
  ['aria_messages', 'ARIA messages'],
  ['budget_interactions', 'Budget interactions'],
  ['savings_interactions', 'Savings interactions'],
  ['sms_imports', 'SMS imports'],
];

function daysSince(ts) {
  if (!ts) return Infinity;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const fmt = n => (n || 0).toLocaleString('en-NG');
const totalEvents = u => Object.values(u.analytics || {}).reduce((s, v) => s + (v || 0), 0);

function Stat({ label, value }) {
  return (
    <Card style={{ flex: 1, padding: space.md + 2 }}>
      <Text variant="title" family="bold" tabular numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text variant="caption" color="inkMuted">{label}</Text>
    </Card>
  );
}

export default function AdminDashboardScreen({ onBack }) {
  const { c } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);

  useEffect(() => subscribeAllUsers(data => {
    setUsers(data);
    setLoading(false);
    setUpdated(new Date().toLocaleTimeString('en-NG'));
  }), []);

  const activeWithin = days => users.filter(u => daysSince(u.lastSeen) <= days).length;
  const scores = users.map(u => u.finscore?.current || 0).filter(s => s > 0);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const sum = key => users.reduce((s, u) => s + (u.analytics?.[key] || 0), 0);
  const maxFeature = Math.max(1, ...FEATURES.map(([key]) => sum(key)));
  const ranked = [...users].sort((a, b) => totalEvents(b) - totalEvents(a));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}>
        <IconButton icon="arrow-back" label="Back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" family="bold" accessibilityRole="header">Live analytics</Text>
          {updated ? <Text variant="caption" color="inkMuted">Updated {updated}</Text> : null}
        </View>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />
        </View>
      ) : !users.length ? (
        <EmptyState icon="people-outline" title="No users to show" body="Either nobody has signed up yet, or this account doesn't have admin access." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Accounts" value={fmt(users.length)} />
              <Stat label="Active today" value={fmt(activeWithin(0))} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Active, 7 days" value={fmt(activeWithin(7))} />
              <Stat label="Active, 30 days" value={fmt(activeWithin(30))} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Average FinScore" value={average || '—'} />
              <Stat label="With a backup" value={fmt(users.filter(u => u.lastBackup).length)} />
            </View>
          </View>

          <View style={{ gap: space.sm }}>
            <Text variant="heading" family="bold" accessibilityRole="header">Feature use</Text>
            <Card style={{ padding: space.lg, gap: space.md }}>
              {FEATURES.map(([key, label]) => (
                <View key={key} style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="label" family="medium">{label}</Text>
                    <Text variant="label" family="bold" tabular>{fmt(sum(key))}</Text>
                  </View>
                  <ProgressBar value={sum(key) / maxFeature} label={`${label}: ${fmt(sum(key))}`} />
                </View>
              ))}
            </Card>
          </View>

          <View style={{ gap: space.sm }}>
            <Text variant="heading" family="bold" accessibilityRole="header">Accounts by activity</Text>
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {ranked.map((u, i) => {
                const days = daysSince(u.lastSeen);
                return (
                  <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2, borderBottomWidth: i < ranked.length - 1 ? 1 : 0, borderBottomColor: c.line }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyStrong" family="semibold" numberOfLines={1}>{u.name || 'No name'}</Text>
                      <Text variant="caption" color="inkMuted" numberOfLines={1}>{u.email}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Badge label={days === 0 ? 'Today' : days === Infinity ? 'Never' : `${days}d ago`} tone={days <= 7 ? 'positive' : 'neutral'} />
                      <Text variant="caption" color="inkMuted" tabular>{fmt(totalEvents(u))} actions</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
