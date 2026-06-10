import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT } from '../constants/theme';

const INVESTMENTS = [
  {
    name: 'Cowrywise',
    tagline: 'Mutual Funds & Dollar Savings',
    return: '14–18%',
    returnLabel: 'p.a on naira funds',
    risk: 'Low',
    riskColor: '#34D399',
    riskBg: 'rgba(52,211,153,0.15)',
    min: '₦1,000',
    lock: '7 days',
    regulated: 'SEC Nigeria',
    since: '2017',
    users: '2M+',
    url: 'https://cowrywise.com',
    badge: '✅ SEC Regulated',
    badgeColor: '#34D399',
    highlight: true,
    features: ['Mutual funds', 'Dollar savings', 'Auto-invest', 'Goal-based saving'],
    description: 'Nigeria\'s most trusted investment platform. Fully regulated by SEC, offers naira and dollar mutual funds with competitive returns.',
  },
  {
    name: 'PiggyVest',
    tagline: 'Fixed Savings & Investments',
    return: '10–13%',
    returnLabel: 'p.a on fixed savings',
    risk: 'Low',
    riskColor: '#34D399',
    riskBg: 'rgba(52,211,153,0.15)',
    min: '₦1,000',
    lock: 'Flexible or fixed',
    regulated: 'CBN & SEC',
    since: '2016',
    users: '4M+',
    url: 'https://piggyvest.com',
    badge: '✅ CBN Licensed',
    badgeColor: '#34D399',
    highlight: false,
    features: ['SafeLock (fixed)', 'Flex dollar', 'Target savings', 'Invest (stocks & funds)'],
    description: 'Nigeria\'s largest savings app. CBN-licensed with multiple savings products. SafeLock offers guaranteed returns.',
  },
  {
    name: 'FGN Savings Bond',
    tagline: 'Federal Government Bond',
    return: '17–19%',
    returnLabel: 'p.a (current rates)',
    risk: 'Zero',
    riskColor: '#E8970A',
    riskBg: 'rgba(232,151,10,0.15)',
    min: '₦5,000',
    lock: '2–3 years',
    regulated: 'DMO Nigeria',
    since: '2003',
    users: 'Government backed',
    url: 'https://dmo.gov.ng/fgn-savings-bond',
    badge: '🏛️ Government Backed',
    badgeColor: '#E8970A',
    highlight: false,
    features: ['Zero default risk', 'Quarterly interest', 'Transferable', 'Tax exempt'],
    description: 'Direct obligation of the Federal Government. Highest safety rating possible — your principal is 100% guaranteed by Nigeria\'s sovereign.',
  },
  {
    name: 'Risevest',
    tagline: 'Dollar Investments & US Stocks',
    return: '10–15%',
    returnLabel: 'p.a in USD',
    risk: 'Medium',
    riskColor: '#7B7BFF',
    riskBg: 'rgba(123,123,255,0.15)',
    min: '$10',
    lock: '3 months',
    regulated: 'SEC Nigeria',
    since: '2019',
    users: '500K+',
    url: 'https://rise.capital',
    badge: '✅ SEC Regulated',
    badgeColor: '#7B7BFF',
    highlight: false,
    features: ['US stocks', 'Real estate', 'Fixed income', 'Dollar returns'],
    description: 'Invest in dollar-denominated assets — US stocks, real estate and fixed income. Returns are in USD, protecting against naira devaluation.',
  },
  {
    name: 'Stanbic IBTC Investment',
    tagline: 'Pension & Managed Funds',
    return: '12–22%',
    returnLabel: 'p.a depending on fund',
    risk: 'Low–High',
    riskColor: '#E8970A',
    riskBg: 'rgba(232,151,10,0.15)',
    min: '₦10,000',
    lock: 'Open-ended',
    regulated: 'SEC & CBN',
    since: '1991',
    users: 'Institutional',
    url: 'https://www.stanbicibtcassetmanagement.com',
    badge: '🏦 Bank Backed',
    badgeColor: '#E8970A',
    highlight: false,
    features: ['Pension management', 'Equity funds', 'Money market', 'Offshore funds'],
    description: 'Part of Standard Bank Group. Offers professional fund management backed by a 30+ year institutional track record in Nigeria.',
  },
  {
    name: 'Renmoney RenVault',
    tagline: 'Fixed Savings with Guaranteed Returns',
    return: '15–16%',
    returnLabel: 'p.a on fixed deposits',
    risk: 'Low',
    riskColor: '#34D399',
    riskBg: 'rgba(52,211,153,0.15)',
    min: '₦5,000',
    lock: '30–365 days',
    regulated: 'CBN Licensed',
    since: '2012',
    users: '1M+',
    url: 'https://renmoney.com',
    playStore: 'https://play.google.com/store/apps/details?id=com.renmoney.android',
    badge: '✅ CBN Licensed',
    badgeColor: '#34D399',
    highlight: false,
    isApp: true,
    features: ['Fixed deposit savings', 'Guaranteed returns', 'Flexible tenors', 'Easy withdrawal'],
    description: 'RenVault by Renmoney offers guaranteed fixed returns on your savings. Choose your lock-in period from 30 to 365 days and earn up to 16% p.a. CBN-licensed and operating since 2012.',
  },
  {
    name: 'ARM Investment',
    tagline: 'Money Market & Mutual Funds',
    return: '18–22%',
    returnLabel: 'p.a (Money Market Fund)',
    risk: 'Low',
    riskColor: '#34D399',
    riskBg: 'rgba(52,211,153,0.15)',
    min: '₦5,000',
    lock: 'Open-ended',
    regulated: 'SEC Nigeria',
    since: '1994',
    users: 'Institutional',
    url: 'https://arminvestmentapp.com',
    playStore: 'https://play.google.com/store/apps/details?id=com.arminvestments.app',
    badge: '✅ SEC Regulated',
    badgeColor: '#34D399',
    highlight: false,
    isApp: true,
    features: ['Money market fund', 'Fixed income fund', 'Equity fund', 'Pension management'],
    description: 'ARM Investment Managers is one of Nigeria\'s oldest and most respected fund managers with 30 years of experience. Their Money Market Fund consistently delivers 18–22% p.a. Fully SEC regulated.',
  },
  {
    name: 'Bamboo',
    tagline: 'US & Nigerian Stocks',
    return: 'Market returns',
    returnLabel: '(S&P 500 avg 10% p.a)',
    risk: 'Medium–High',
    riskColor: '#E54545',
    riskBg: 'rgba(229,69,69,0.15)',
    min: '$20',
    lock: 'None (liquid)',
    regulated: 'SEC Nigeria',
    since: '2020',
    users: '200K+',
    url: 'https://investbamboo.com',
    badge: '📈 Stocks & ETFs',
    badgeColor: '#E54545',
    highlight: false,
    features: ['US stocks', 'Nigerian stocks', 'ETFs', 'Fractional shares'],
    description: 'Trade US and Nigerian stocks from your phone. Full market exposure with fractional shares starting from just $20.',
  },
];

export default function InvestmentsScreen({ theme, user }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const [expanded, setExpanded] = useState(null);
  const [savedAmount, setSavedAmount] = useState(0);
  const s = styles(T);

  React.useEffect(() => {
    AsyncStorage.getItem('finsight_transactions').then(raw => {
      if (raw) {
        const txs = JSON.parse(raw);
        const saved = txs.filter(t => t.cat === 'Savings' && t.type === 'credit').reduce((a, t) => a + t.amount, 0);
        const income = user?.income || 0;
        const spend = txs.filter(t => t.type === 'debit').reduce((a, t) => a + t.amount, 0);
        const net = Math.max(0, income - spend);
        setSavedAmount(saved > 0 ? saved : net);
      }
    });
  }, []);

  function openPlatform(investment) {
    const buttons = [{ text: 'Cancel', style: 'cancel' }];
    if (investment.playStore) {
      buttons.push({
        text: '📲 Download App',
        onPress: () => Linking.openURL(investment.playStore).catch(() =>
          Linking.openURL(investment.url).catch(() =>
            Alert.alert('Error', 'Could not open the link.')
          )
        ),
      });
    }
    buttons.push({
      text: '🌐 Visit Website →',
      onPress: () => Linking.openURL(investment.url).catch(() =>
        Alert.alert('Error', 'Could not open the link. Try opening it manually.')
      ),
    });

    Alert.alert(
      `Open ${investment.name}?`,
      `FinSight does not earn commissions. This is for informational purposes only.`,
      buttons
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={[s.eyebrow, { color: T.mute }]}>PORTFOLIO</Text>
          <Text style={[s.title, { color: T.ink }]}>Investments</Text>
          <Text style={[s.sub, { color: T.mute }]}>
            Vetted Nigerian platforms · Tap to visit
          </Text>
        </View>

        {/* Available to invest card */}
        <View style={[s.availCard, { backgroundColor: '#13131F', borderWidth: 1, borderColor: '#6366F1' }]}>
          <Text style={[s.availLabel, { color: 'rgba(255,255,255,0.5)' }]}>AVAILABLE TO INVEST</Text>
          <Text style={[s.availAmt, { color: '#818CF8' }]}>
            ₦{savedAmount >= 1000000
              ? `${(savedAmount/1000000).toFixed(1)}M`
              : savedAmount >= 1000
              ? `${(savedAmount/1000).toFixed(0)}K`
              : savedAmount.toLocaleString()}
          </Text>
          <Text style={[s.availSub, { color: 'rgba(255,255,255,0.35)' }]}>
            Based on your current savings balance
          </Text>
        </View>

        {/* Investment cards */}
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {INVESTMENTS.map((inv, i) => {
            const isOpen = expanded === i;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.card,
                  { backgroundColor: T.surface },
                  inv.highlight && { borderColor: T.limeDeep, borderWidth: 1.5 },
                ]}
                onPress={() => setExpanded(isOpen ? null : i)}
                activeOpacity={0.8}
              >
                {/* Most trusted badge */}
                {inv.highlight && (
                  <View style={[s.topBadge, { backgroundColor: T.limeDeep }]}>
                    <Text style={s.topBadgeText}>⭐ MOST TRUSTED</Text>
                  </View>
                )}

                {/* Card header */}
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={[s.invName, { color: T.ink }]}>{inv.name}</Text>
                      <View style={[s.regBadge, { backgroundColor: inv.riskBg }]}>
                        <Text style={[s.regText, { color: inv.riskColor }]}>{inv.badge}</Text>
                      </View>
                    </View>
                    <Text style={[s.invTagline, { color: T.mute }]}>{inv.tagline}</Text>
                  </View>
                  <Text style={[s.chevron, { color: T.mute }]}>{isOpen ? '▲' : '▼'}</Text>
                </View>

                {/* Key metrics */}
                <View style={s.metrics}>
                  <View style={s.metric}>
                    <Text style={[s.metricLabel, { color: T.mute }]}>RETURN</Text>
                    <Text style={[s.metricVal, { color: inv.riskColor }]}>{inv.return}</Text>
                    <Text style={[s.metricSub, { color: T.mute2 }]}>{inv.returnLabel}</Text>
                  </View>
                  <View style={[s.metricDivider, { backgroundColor: T.line }]} />
                  <View style={s.metric}>
                    <Text style={[s.metricLabel, { color: T.mute }]}>MIN</Text>
                    <Text style={[s.metricVal, { color: T.ink }]}>{inv.min}</Text>
                    <Text style={[s.metricSub, { color: T.mute2 }]}>to start</Text>
                  </View>
                  <View style={[s.metricDivider, { backgroundColor: T.line }]} />
                  <View style={s.metric}>
                    <Text style={[s.metricLabel, { color: T.mute }]}>RISK</Text>
                    <Text style={[s.metricVal, { color: inv.riskColor }]}>{inv.risk}</Text>
                    <Text style={[s.metricSub, { color: T.mute2 }]}>profile</Text>
                  </View>
                  <View style={[s.metricDivider, { backgroundColor: T.line }]} />
                  <View style={s.metric}>
                    <Text style={[s.metricLabel, { color: T.mute }]}>USERS</Text>
                    <Text style={[s.metricVal, { color: T.ink }]}>{inv.users}</Text>
                    <Text style={[s.metricSub, { color: T.mute2 }]}>active</Text>
                  </View>
                </View>

                {/* Expanded details */}
                {isOpen && (
                  <View style={[s.expanded, { borderTopColor: T.line }]}>
                    <Text style={[s.description, { color: T.ink2 }]}>{inv.description}</Text>

                    {/* Features */}
                    <View style={s.features}>
                      {inv.features.map((f, fi) => (
                        <View key={fi} style={[s.featurePill, { backgroundColor: T.bg1, borderColor: T.line }]}>
                          <Text style={[s.featureText, { color: T.ink2 }]}>✓ {f}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Extra info */}
                    <View style={[s.infoRow, { backgroundColor: T.bg1, borderColor: T.line }]}>
                      <View style={s.infoItem}>
                        <Text style={[s.infoLabel, { color: T.mute }]}>REGULATED BY</Text>
                        <Text style={[s.infoVal, { color: T.ink }]}>{inv.regulated}</Text>
                      </View>
                      <View style={s.infoItem}>
                        <Text style={[s.infoLabel, { color: T.mute }]}>SINCE</Text>
                        <Text style={[s.infoVal, { color: T.ink }]}>{inv.since}</Text>
                      </View>
                      <View style={s.infoItem}>
                        <Text style={[s.infoLabel, { color: T.mute }]}>LOCK-IN</Text>
                        <Text style={[s.infoVal, { color: T.ink }]}>{inv.lock}</Text>
                      </View>
                    </View>

                    {/* CTA Button */}
                    <TouchableOpacity
                      style={[s.ctaBtn, { backgroundColor: T.lime }]}
                      onPress={() => openPlatform(inv)}
                      activeOpacity={0.85}
                    >
                      <Text style={s.ctaText}>
                        {inv.isApp ? `📲 Get ${inv.name} App →` : `Visit ${inv.name} →`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Disclaimer */}
        <View style={[s.disclaimer, { backgroundColor: T.surface, borderColor: T.line }]}>
          <Text style={[s.disclaimerTitle, { color: T.mute }]}>⚠️ Disclaimer</Text>
          <Text style={[s.disclaimerText, { color: T.mute }]}>
            All platforms listed are regulated by Nigerian authorities (SEC, CBN, or DMO). FinSight does not earn commissions or referral fees. This is for informational purposes only — always conduct your own research before investing. Past returns do not guarantee future performance.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 13, marginTop: 4 },

  availCard: {
    marginHorizontal: 16, marginBottom: 20,
    borderRadius: 20, padding: 22,
  },
  availLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 8 },
  availAmt: { fontSize: 44, fontWeight: '800', letterSpacing: -1, lineHeight: 46 },
  availSub: { fontSize: 12, marginTop: 6 },

  card: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  topBadge: {
    paddingHorizontal: 14, paddingVertical: 6,
    alignItems: 'center',
  },
  topBadgeText: { fontSize: 10, fontWeight: '800', color: '#0E120F', letterSpacing: 1 },

  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, paddingBottom: 12, gap: 8,
  },
  invName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  invTagline: { fontSize: 12, marginTop: 2 },
  regBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  regText: { fontSize: 10, fontWeight: '700' },
  chevron: { fontSize: 12, paddingTop: 4 },

  metrics: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingBottom: 16, alignItems: 'flex-start',
  },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 8, letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 },
  metricVal: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  metricSub: { fontSize: 9, marginTop: 2, textAlign: 'center' },
  metricDivider: { width: 1, height: 36, alignSelf: 'center', marginHorizontal: 4 },

  expanded: { borderTopWidth: 1, padding: 16, gap: 14 },
  description: { fontSize: 13, lineHeight: 20 },

  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featurePill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  featureText: { fontSize: 11, fontWeight: '500' },

  infoRow: {
    flexDirection: 'row', borderRadius: 12,
    padding: 12, borderWidth: 1, gap: 0,
  },
  infoItem: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 8, letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 },
  infoVal: { fontSize: 13, fontWeight: '700' },

  ctaBtn: {
    borderRadius: 14, padding: 14,
    alignItems: 'center', marginTop: 4,
  },
  ctaText: { color: '#0E120F', fontWeight: '800', fontSize: 15 },

  disclaimer: {
    margin: 16, borderRadius: 16,
    padding: 16, borderWidth: 1, marginTop: 8,
  },
  disclaimerTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  disclaimerText: { fontSize: 12, lineHeight: 18 },
});
