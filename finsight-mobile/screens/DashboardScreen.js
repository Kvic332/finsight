import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { radius, space } from '../constants/tokens';
import {
  Button, Card, CategoryTile, EmptyState, Gradient, Icon, IconTile, ProgressBar, Sheet, Text, useTheme,
  useToast,
} from '../components/ui';
import { computePeriodStats, periodLabel } from '../services/finance';
import { formatMoney, formatMoneyCompact } from '../services/format';
import { loadTransactions } from '../services/transactions';
import { checkAchievements, getStreak } from '../services/notificationService';
import { getLevelInfo, getXPState } from '../services/xpService';
import { trackEvent } from '../services/cloudSync';

const ACHIEVEMENTS = [
  ['first_log', 'First step', 'footsteps-outline'],
  ['ten_logs', 'Getting started', 'create-outline'],
  ['fifty_logs', 'Tracking pro', 'bar-chart-outline'],
  ['streak_3', 'Habit forming', 'flash-outline'],
  ['streak_7', 'One week strong', 'flame-outline'],
  ['streak_30', 'Monthly master', 'medal-outline'],
  ['streak_90', 'Quarterly champion', 'trophy-outline'],
  ['finscore_50', 'Average achieved', 'trending-up-outline'],
  ['finscore_70', 'Good shape', 'barbell-outline'],
  ['finscore_90', 'Financial elite', 'star-outline'],
  ['sms_import', 'SMS pro', 'chatbubble-ellipses-outline'],
];

function grade(score) {
  if (score >= 80) return { label: 'Excellent', tone: 'positive' };
  if (score >= 70) return { label: 'Good', tone: 'positive' };
  if (score >= 50) return { label: 'Average', tone: 'warning' };
  return { label: 'Needs work', tone: 'negative' };
}

const scoreTone = score => (score >= 70 ? 'positive' : score >= 50 ? 'warning' : 'negative');

function scoreParts({ spendScore, saveScore, txScore, investScore }) {
  return [
    { label: 'Spending', score: spendScore, about: 'How far your spending stays below your income.', tip: 'Cut your top one or two spending categories by a fifth.' },
    { label: 'Savings', score: saveScore, about: 'How much of your income goes to savings.', tip: 'Move money to savings on payday, before you start spending.' },
    { label: 'Tracking', score: txScore, about: 'How consistently you record and spread your spending.', tip: 'Log transactions every day, or turn on bank alert capture.' },
    { label: 'Building', score: investScore, about: 'Whether you have savings goals and put money towards them.', tip: 'Set a savings goal and make your first contribution.' },
  ];
}

function SpendChart({ data }) {
  const { c } = useTheme();
  const max = Math.max(...data.map(d => d.spend), 1);
  if (!data.some(d => d.spend > 0)) {
    return <Text color="inkMuted" align="center" style={{ paddingVertical: space.xl }}>No spending in the last 7 days</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: 150 }}>
      {data.map((item, i) => {
        const today = i === data.length - 1;
        const height = item.spend > 0 ? Math.max(6, (item.spend / max) * 96) : 4;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${item.day}: ${formatMoney(item.spend)}`}>
            <Text variant="caption" color={today ? 'accent' : 'inkMuted'} numberOfLines={1} adjustsFontSizeToFit>
              {item.spend > 0 ? formatMoneyCompact(item.spend).replace('₦', '') : ' '}
            </Text>
            <View style={{ width: '100%', height, marginVertical: space.xs, borderRadius: 6, overflow: 'hidden', backgroundColor: today ? 'transparent' : c.accentSoft }}>
              {today ? <Gradient fill /> : null}
            </View>
            <Text variant="caption" family={today ? 'bold' : 'regular'} color={today ? 'ink' : 'inkMuted'}>{item.day.slice(0, 3)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function DashboardScreen({ user }) {
  const { c } = useTheme();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [streak, setStreak] = useState({ count: 0, longest: 0 });
  const [earned, setEarned] = useState([]);
  const [xp, setXp] = useState(getLevelInfo(0));
  const [refreshing, setRefreshing] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);

  // The same pay period as Home and Activity.
  const stats = computePeriodStats(user, transactions);
  const when = periodLabel(stats.cycle);
  const { finScore, totalSpend, totalSaved, categoryTotals, spendTrend, income, scoreBreakdown } = stats;
  const parts = scoreParts(scoreBreakdown);
  const g = grade(finScore);
  const categories = Object.entries(categoryTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const weekTotal = spendTrend.reduce((s, d) => s + d.spend, 0);
  const tips = [...parts].sort((a, b) => a.score - b.score).slice(0, 2);

  async function load() {
    const txs = await loadTransactions();
    setTransactions(txs);
    const currentStreak = await getStreak();
    setStreak(currentStreak);
    const { earned: list } = await checkAchievements(currentStreak, txs, computePeriodStats(user, txs).finScore);
    setEarned(list);
    setXp(await getXPState());
  }

  useFocusEffect(useCallback(() => {
    load().catch(() => {});
    trackEvent('dashboard_views');
  }, [user]));

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  async function share() {
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your FinScore' });
      } else {
        await Share.share({ url: uri, message: 'My FinScore on FinSight' });
      }
    } catch (e) {
      toast.show("Couldn't create the image. Try again.", { tone: 'error' });
    }
    setSharing(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, paddingBottom: space.huge, gap: space.md + 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
      >
        <Card onPress={() => setShowScore(true)} accessibilityLabel={`FinScore ${finScore} out of 100, ${g.label}. See the breakdown`} style={{ padding: 0, overflow: 'hidden' }}>
          <Gradient style={{ padding: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text variant="label" color="#FFFFFF">{stats.cycle.hasPayday ? 'FinScore this pay period' : 'FinScore this month'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
                <Text variant="display" family="bold" color="#FFFFFF" tabular style={{ fontSize: 56, lineHeight: 64, letterSpacing: -1.5 }}>{finScore}</Text>
                <Text variant="bodyStrong" color="#FFFFFF">/ 100</Text>
              </View>
            </View>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs + 2 }}>
              <Text variant="label" family="bold" color="#A30E42">{g.label}</Text>
            </View>
          </Gradient>
          <View style={{ padding: space.lg + 2, gap: space.md }}>
            {parts.map(p => (
              <View key={p.label} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="label" family="medium">{p.label}</Text>
                  <Text variant="label" family="bold" tabular>{p.score}</Text>
                </View>
                <ProgressBar value={p.score / 100} tone={scoreTone(p.score)} label={`${p.label}: ${p.score} out of 100`} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label" family="semibold" color="accent">How to improve</Text>
              <Icon name="chevron-forward" size={16} color="accent" />
            </View>
          </View>
        </Card>

        <Button full title="Share my FinScore" variant="secondary" icon="share-social-outline" onPress={() => setShowShare(true)} />

        <Card style={{ padding: space.lg + 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.lg }}>
            <View>
              <Text variant="heading" family="bold" accessibilityRole="header">Last 7 days</Text>
              <Text variant="label" family="regular" color="inkMuted">Your daily spending</Text>
            </View>
            <Text variant="heading" family="bold" tabular>{formatMoney(weekTotal)}</Text>
          </View>
          <SpendChart data={spendTrend} />
        </Card>

        <Card style={{ padding: space.lg + 2 }}>
          <Text variant="heading" family="bold" accessibilityRole="header">Where your money went</Text>
          <Text variant="label" family="regular" color="inkMuted" style={{ marginBottom: space.md }}>{`${when[0].toUpperCase()}${when.slice(1)} · ${formatMoney(totalSpend)}`}</Text>
          {categories.length ? categories.slice(0, 6).map(([cat, amt]) => {
            const share_ = totalSpend > 0 ? amt / totalSpend : 0;
            return (
              <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
                <CategoryTile category={cat} size={40} />
                <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                    <Text variant="label" family="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{cat}</Text>
                    <Text variant="label" family="bold" tabular>{formatMoney(amt)}</Text>
                  </View>
                  <ProgressBar value={share_} label={`${cat}: ${Math.round(share_ * 100)}% of spending`} />
                </View>
              </View>
            );
          }) : <EmptyState icon="pie-chart-outline" title={`Nothing yet ${when}`} body="Your spending by category will appear here." />}
        </Card>

        <Card style={{ padding: space.lg + 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md }}>
            <IconTile name="ribbon-outline" tone="accent" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" family="bold">{xp.current.title}</Text>
              <Text variant="label" family="regular" color="inkMuted">
                Level {xp.current.level} · {xp.totalXP} XP{streak.count > 0 ? ` · ${streak.count}-day streak` : ''}
              </Text>
            </View>
          </View>
          <ProgressBar value={xp.pct / 100} height={8} label={`${xp.pct}% of the way to the next level`} />
          {xp.next ? (
            <Text variant="caption" color="inkMuted" style={{ marginTop: space.sm }}>
              {xp.xpForLevel - xp.xpInLevel} XP to {xp.next.title}
            </Text>
          ) : null}
        </Card>

        <View style={{ marginTop: space.xs }}>
          <Text variant="heading" family="bold" accessibilityRole="header" style={{ marginBottom: space.md }}>
            Achievements · {earned.length} of {ACHIEVEMENTS.length}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {ACHIEVEMENTS.map(([id, title, icon]) => {
              const has = earned.includes(id);
              return (
                <View
                  key={id}
                  accessible
                  accessibilityLabel={`${title}, ${has ? 'earned' : 'not earned yet'}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingHorizontal: space.md, paddingVertical: space.sm,
                    borderRadius: radius.pill, backgroundColor: has ? c.accentSoft : c.sunken,
                  }}
                >
                  <Icon name={icon} size={16} color={has ? 'onAccentSoft' : 'inkSubtle'} />
                  <Text variant="label" family={has ? 'semibold' : 'regular'} color={has ? 'onAccentSoft' : 'inkMuted'}>{title}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Sheet visible={showScore} onClose={() => setShowScore(false)} title="How your FinScore works">
        <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: space.md }}>
            {parts.map(p => (
              <View key={p.label}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodyStrong" family="semibold">{p.label}</Text>
                  <Text variant="bodyStrong" family="bold" tabular>{p.score}</Text>
                </View>
                <Text variant="label" family="regular" color="inkMuted">{p.about}</Text>
              </View>
            ))}
            <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.md, padding: space.lg, gap: space.sm }}>
              <Text variant="bodyStrong" family="bold" color="onAccentSoft">Start here</Text>
              {tips.map(t => <Text key={t.label} variant="label" family="regular" color="onAccentSoft">{t.tip}</Text>)}
            </View>
          </View>
        </ScrollView>
      </Sheet>

      <Modal visible={showShare} transparent animationType="fade" onRequestClose={() => setShowShare(false)}>
        <View style={{ flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <View ref={cardRef} collapsable={false} style={{ width: 320, borderRadius: radius.lg, overflow: 'hidden' }}>
            <Gradient style={{ padding: space.xl + 2 }}>
              <Text variant="heading" family="bold" color="#FFFFFF">FinSight</Text>
              <Text variant="label" color="#FFFFFF" style={{ marginTop: space.xl }}>{user?.name?.split(' ')[0] || 'My'} FinScore</Text>
              <Text variant="display" family="bold" color="#FFFFFF" tabular style={{ fontSize: 88, lineHeight: 96, letterSpacing: -2.5 }}>{finScore}</Text>
              <Text variant="bodyStrong" color="#FFFFFF">{g.label} · out of 100</Text>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xl }}>
                {[
                  ['Saved', formatMoneyCompact(totalSaved)],
                  ['Rate', `${income > 0 ? Math.round((totalSaved / income) * 100) : 0}%`],
                  ['Streak', `${streak.count}d`],
                ].map(([a, b]) => (
                  <View key={a} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.sm, padding: space.md - 2 }}>
                    <Text variant="caption" color="#FFFFFF">{a}</Text>
                    <Text variant="bodyStrong" family="bold" color="#FFFFFF" tabular numberOfLines={1} adjustsFontSizeToFit>{b}</Text>
                  </View>
                ))}
              </View>
            </Gradient>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, width: 320, marginTop: space.lg }}>
            <Pressable
              onPress={() => setShowShare(false)}
              accessibilityRole="button"
              style={{ flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: c.surface }}
            >
              <Text variant="bodyStrong" family="bold">Close</Text>
            </Pressable>
            <View style={{ flex: 2 }}><Button full title="Share" icon="share-social-outline" loading={sharing} onPress={share} /></View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
