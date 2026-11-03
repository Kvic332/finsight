import React, { useState } from 'react';
import { Pressable, ScrollView, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, Card, Gradient, Icon, Text, tapFeedback, useTheme, useToast,
} from '../components/ui';

// Design preview only. These providers and rates are made up, so this screen is
// only shown in test builds until real, verified data exists (see App navigator).
const SAMPLE = {
  Savings: [
    ['A', 'Provider A', '90 days · from ₦5,000', '18.50%', 'CBN licensed · 2d ago', true],
    ['B', 'Provider B', '180 days · from ₦10,000', '17.25%', 'CBN licensed · 5d ago', true],
    ['C', 'Provider C', 'Any time · from ₦1,000', '16.00%', 'CBN licensed · 1d ago', true],
    ['D', 'Provider D', '365 days · from ₦50,000', '15.50%', 'Rate may be old · 41d ago', false],
  ],
  Loans: [
    ['E', 'Provider E', 'Up to ₦500,000 · 6 months', '32.00%', 'FCCPC approved · 3d ago', true],
    ['F', 'Provider F', 'Up to ₦200,000 · 3 months', '41.00%', 'FCCPC approved · 1d ago', true],
  ],
  Funds: [
    ['G', 'Provider G', 'Money market · from ₦5,000', '19.20%', 'SEC registered · 4d ago', true],
    ['H', 'Provider H', 'Money market · from ₦10,000', '18.10%', 'SEC registered · 2d ago', true],
  ],
  FX: [
    ['I', 'Provider I', 'Buy ₦0,000 · Sell ₦0,000', '$1', 'Sample layout only', false],
  ],
};
const TABS = ['Loans', 'Savings', 'Funds', 'FX'];
const LOGO_TONES = [['#FFEEDD', '#A84607'], ['#FFE3EE', '#A30E42'], ['#F3E6FF', '#6A1FB0'], ['#E3F1FB', '#0F5FA3']];

export default function GrowPreviewScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tab, setTab] = useState('Savings');

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <Gradient style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 168 }} />
        <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, gap: space.xs }}>
          <Text variant="title" family="bold" color="#FFFFFF" accessibilityRole="header">Compare & Grow</Text>
          <Text variant="label" color="#FFFFFF">Licensed providers, ranked by rate</Text>
        </View>
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row', margin: space.xl, marginTop: space.lg, padding: space.xs,
            borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.2)',
          }}
        >
          {TABS.map(t => (
            <Pressable
              key={t}
              onPress={() => { tapFeedback(); setTab(t); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: t === tab }}
              style={{
                flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm,
                backgroundColor: t === tab ? '#FFFFFF' : 'transparent',
              }}
            >
              <Text variant="label" family="semibold" color={t === tab ? '#A30E42' : '#FFFFFF'}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: c.warningSoft, borderRadius: radius.md, padding: space.md }}>
            <Icon name="information-circle-outline" size={18} color="onWarningSoft" />
            <Text variant="label" color="onWarningSoft" style={{ flex: 1 }}>Design preview. These providers and rates are made up.</Text>
          </View>
          {SAMPLE[tab].map((p, i) => (
            <Card key={p[0]} style={{ padding: space.md + 2, borderRadius: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{
                  width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: LOGO_TONES[i % 4][0],
                }}>
                  <Text variant="heading" family="bold" color={LOGO_TONES[i % 4][1]}>{p[0]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" family="bold" numberOfLines={1}>{p[1]}</Text>
                  <Text variant="caption" color="inkMuted" numberOfLines={1}>{p[2]}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                    {p[5] ? <Icon name="shield-checkmark-outline" size={13} color="positive" /> : null}
                    <Text variant="caption" family="semibold" color={p[5] ? 'positive' : 'warning'} numberOfLines={1} style={{ fontSize: 12 }}>{p[4]}</Text>
                  </View>
                </View>
                <Text variant="heading" family="bold" tabular color={p[5] ? 'accent' : 'inkMuted'} style={{ fontSize: 20 }}>{p[3]}</Text>
              </View>
            </Card>
          ))}
          <Button full title="Compare providers" variant="secondary" onPress={() => toast.show('Comparing comes with real provider data')} />
        </View>
      </ScrollView>
    </View>
  );
}
