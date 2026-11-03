import React, { useState } from 'react';
import { Linking, ScrollView, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, Card, Gradient, Icon, IconTile, Sheet, Text, useTheme, useToast,
} from '../components/ui';

// Deliberately has no returns, risk ratings, user counts or licence claims. None
// of those have been verified. They arrive with Compare and Grow, once each one
// is checked against a real source.
const PLATFORMS = [
  { name: 'Cowrywise', about: 'Savings plans and mutual funds', icon: 'leaf-outline', url: 'https://cowrywise.com' },
  { name: 'PiggyVest', about: 'Savings plans and investments', icon: 'wallet-outline', url: 'https://piggyvest.com' },
  { name: 'FGN Savings Bond', about: 'Bonds issued by the Federal Government', icon: 'business-outline', url: 'https://dmo.gov.ng/fgn-savings-bond' },
  { name: 'Risevest', about: 'Dollar-based investments', icon: 'globe-outline', url: 'https://rise.capital' },
  { name: 'Stanbic IBTC', about: 'Managed funds', icon: 'stats-chart-outline', url: 'https://www.stanbicibtcassetmanagement.com' },
  { name: 'Renmoney', about: 'Fixed savings', icon: 'lock-closed-outline', url: 'https://renmoney.com' },
  { name: 'ARM Investment', about: 'Money market and mutual funds', icon: 'pie-chart-outline', url: 'https://arminvestmentapp.com' },
  { name: 'Bamboo', about: 'US and Nigerian stocks', icon: 'trending-up-outline', url: 'https://investbamboo.com' },
];

export default function InvestmentsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [leaving, setLeaving] = useState(null);

  function open() {
    const { url } = leaving;
    setLeaving(null);
    Linking.openURL(url).catch(() => toast.show("Couldn't open that website.", { tone: 'error' }));
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <Gradient style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 140 }} />
        <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.xs }}>
          <Text variant="title" family="bold" color="#FFFFFF" accessibilityRole="header">Grow</Text>
          <Text variant="label" color="#FFFFFF">Places to start exploring</Text>
        </View>
        <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
          <Card style={{ padding: space.lg, flexDirection: 'row', gap: space.md }}>
            <Icon name="information-circle-outline" size={22} color="accent" />
            <Text variant="label" family="regular" color="inkMuted" style={{ flex: 1, lineHeight: 20 }}>
              This is a starting list, not a recommendation. FinSight hasn't verified these services and doesn't earn from them. Check that a provider is licensed before you invest. You can lose money.
            </Text>
          </Card>
          {PLATFORMS.map(p => (
            <Card key={p.name} onPress={() => setLeaving(p)} accessibilityLabel={`${p.name}. ${p.about}. Open website`} style={{ padding: space.md + 2, borderRadius: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconTile name={p.icon} tone="accent" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" family="bold" numberOfLines={1}>{p.name}</Text>
                  <Text variant="label" family="regular" color="inkMuted" numberOfLines={1}>{p.about}</Text>
                </View>
                <Icon name="open-outline" size={18} color="inkSubtle" />
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      <Sheet
        visible={!!leaving}
        onClose={() => setLeaving(null)}
        title={leaving ? `Open ${leaving.name}?` : ''}
        footer={(
          <>
            <Button full title="Open website" icon="open-outline" onPress={open} />
            <Button full title="Stay here" variant="ghost" onPress={() => setLeaving(null)} />
          </>
        )}
      >
        <View style={{ backgroundColor: c.sunken, borderRadius: radius.md, padding: space.md }}>
          <Text variant="label" family="regular" color="inkMuted">
            You're leaving FinSight for a website we don't run. Check the provider's licence and terms before sending any money.
          </Text>
        </View>
      </Sheet>
    </View>
  );
}
