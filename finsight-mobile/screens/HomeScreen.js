import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, Card, CategoryTile, EmptyState, Gradient, Icon, ListRow, Money, Sheet, Text, tapFeedback,
  useTheme, useToast, IconTile,
} from '../components/ui';
import { computePaydayPlan, parseTxDate } from '../services/finance';
import { formatDayLabel, formatMoney } from '../services/format';
import { loadTransactions } from '../services/transactions';
import { checkAchievements, updateStreak } from '../services/notificationService';
import { awardXP, getXPState } from '../services/xpService';
import { syncFinScore, syncXP, trackEvent } from '../services/cloudSync';

function greeting(hour = new Date().getHours()) {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function ActionButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ alignItems: 'center', gap: space.xs + 2, flex: 1, opacity: pressed ? 0.75 : 1 })}
    >
      <Gradient style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color="#FFFFFF" />
      </Gradient>
      <Text variant="caption" family="semibold" numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// One tick per day of the pay period: past days, days covered at the current
// pace, and the days the money won't reach.
function Runway({ plan }) {
  const { length, elapsed } = plan.cycle;
  const short = Math.min(plan.shortDays, length - elapsed);
  return (
    <View
      accessible
      accessibilityLabel={`Day ${elapsed} of ${length} in this pay period${short ? `, ${short} days short of payday` : ''}`}
      style={{ flexDirection: 'row', gap: 3 }}
    >
      {Array.from({ length }, (_, i) => {
        const past = i < elapsed;
        const isShort = i >= length - short;
        return (
          <View key={i} style={{
            flex: 1, height: 8, borderRadius: 2,
            backgroundColor: isShort ? '#FFB020' : past ? 'rgba(255,255,255,0.35)' : '#FFFFFF',
          }} />
        );
      })}
    </View>
  );
}

function BrokeClock({ plan, onSetPayday }) {
  const { daysLeft, shortDays, cutPerDay, cycle } = plan;
  const hasPace = daysLeft !== null;
  const title = !hasPace ? 'Waiting for your spending'
    : daysLeft >= 365 ? 'Over a year of money left'
    : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} of money left`;
  let advice = 'Add what you spend and this will show how long your money lasts.';
  if (hasPace && !cycle.hasPayday) advice = 'Set your payday to see if your money will last.';
  else if (hasPace && shortDays > 0) advice = `Spend ${formatMoney(cutPerDay)} less a day to reach payday`;
  else if (hasPace) advice = 'At this pace, your money reaches payday.';

  const card = (
    <Gradient name="plum" style={{ borderRadius: 22, padding: space.lg + 2, gap: space.md - 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="label" color="#FFD9E8">Broke Clock</Text>
          <Text variant="heading" family="bold" color="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        </View>
        {hasPace && cycle.hasPayday ? (
          <View style={{ backgroundColor: shortDays > 0 ? '#FFB020' : '#DDF6E8', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text variant="caption" family="bold" color={shortDays > 0 ? '#3B0B3E' : '#08603B'}>
              {shortDays > 0 ? `${shortDays} ${shortDays === 1 ? 'day' : 'days'} short` : 'On track'}
            </Text>
          </View>
        ) : null}
      </View>
      <Runway plan={plan} />
      <Text variant="label" color="#FFFFFF">{advice}</Text>
    </Gradient>
  );
  if (hasPace && !cycle.hasPayday) {
    return <Pressable onPress={onSetPayday} accessibilityRole="button" accessibilityLabel="Set your payday in Settings">{card}</Pressable>;
  }
  return card;
}

export default function HomeScreen({ navigation, user }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [streak, setStreak] = useState({ count: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const firstName = user?.name?.split(' ')[0] || '';
  const plan = computePaydayPlan(user, transactions);
  // The pay-period score, so Home and Insights always show the same number.
  const { finScore } = plan;

  async function load() {
    const txs = await loadTransactions();
    setTransactions(txs);
    const updated = await updateStreak();
    setStreak(updated);
    const score = computePaydayPlan(user, txs).finScore;
    const { newlyEarned } = await checkAchievements(updated, txs, score);
    if (newlyEarned.length) toast.show(`Achievement unlocked: ${newlyEarned[0].title}`, { tone: 'success' });
    const opened = await awardXP('daily_open');
    if (updated.count >= 30) await awardXP('streak_30');
    else if (updated.count >= 7) await awardXP('streak_7');
    if (score >= 80) await awardXP('finscore_80');
    else if (score >= 70) await awardXP('finscore_70');
    if (opened.leveledUp) toast.show(`Level up: you're now ${opened.newLevel.title}`, { tone: 'success' });
    syncFinScore(score).catch(() => {});
    const xp = await getXPState();
    syncXP(xp.totalXP, xp.current.level).catch(() => {});
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

  const subtitle = !plan.cycle.hasPayday
    ? 'For the rest of this month'
    : plan.cycle.daysToGo === 1
      ? `${formatMoney(plan.safePerDay)} to spend before payday tomorrow`
      : `${formatMoney(plan.safePerDay)} a day for the next ${plan.cycle.daysToGo} days`;
  const recent = transactions.slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
      >
        <Gradient style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 188 }} />
        <View style={{
          paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: space.lg + 2,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color="#FFFFFF">{greeting()}</Text>
            <Text variant="title" family="bold" color="#FFFFFF" numberOfLines={1}>{firstName || 'Welcome'}</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.2)',
            })}
          >
            {firstName
              ? <Text variant="heading" family="bold" color="#FFFFFF">{firstName[0].toUpperCase()}</Text>
              : <Icon name="settings-outline" color="#FFFFFF" />}
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.xl, gap: space.md + 2 }}>
          <Card style={{ padding: space.xl }}>
            <Text variant="label" family="medium" color="inkMuted">
              {plan.cycle.hasPayday ? 'Left until payday' : 'Left this month'}
            </Text>
            <Money value={plan.left} variant="display" family="bold" adjustsFontSizeToFit style={{ fontSize: 40, lineHeight: 50, letterSpacing: -1 }} />
            <Text variant="label" family="medium" color="inkMuted">{subtitle}</Text>
            <View style={{ flexDirection: 'row', marginTop: space.lg + 2 }}>
              <ActionButton icon="add" label="Add" onPress={() => navigation.navigate('Add')} />
              <ActionButton icon="download-outline" label="Import" onPress={() => setShowImport(true)} />
              <ActionButton icon="pie-chart-outline" label="Budget" onPress={() => navigation.navigate('Plan')} />
              <ActionButton icon="chatbubble-ellipses-outline" label="Ask ARIA" onPress={() => navigation.navigate('ARIA')} />
            </View>
          </Card>

          <BrokeClock plan={plan} onSetPayday={() => navigation.navigate('Settings')} />

          <Pressable
            onPress={() => navigation.navigate('Insights')}
            accessibilityRole="button"
            accessibilityLabel={`FinScore ${finScore}. ${streak.count} day streak. See your insights.`}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="sparkles-outline" size={18} color="accent" />
            <Text variant="label" family="semibold" style={{ flex: 1 }}>
              FinScore {finScore}{streak.count > 0 ? ` · ${streak.count}-day streak` : ''}
            </Text>
            <Text variant="label" family="semibold" color="accent">Insights</Text>
            <Icon name="chevron-forward" size={16} color="accent" />
          </Pressable>

          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs }}>
              <Text variant="heading" family="bold" accessibilityRole="header">Recent activity</Text>
              {recent.length ? (
                <Pressable onPress={() => navigation.navigate('Activity')} accessibilityRole="button" hitSlop={10}>
                  <Text variant="label" family="semibold" color="accent">See all</Text>
                </Pressable>
              ) : null}
            </View>
            {recent.length ? recent.map(tx => (
              <TransactionRow key={tx.id} tx={tx} />
            )) : (
              <EmptyState
                icon="receipt-outline"
                title="Add your first transaction"
                body="Log what you spend, or import your bank alerts, and your figures will appear here."
                action={<Button title="Add transaction" variant="secondary" onPress={() => navigation.navigate('Add')} />}
              />
            )}
          </View>
        </View>
      </ScrollView>
      {/* Keeps scrolled content out from under the clock and battery icons. */}
      <Gradient pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top }} />

      <Sheet visible={showImport} onClose={() => setShowImport(false)} title="Import transactions">
        <Card padded={false} tone="sunken">
          <ListRow
            leading={<IconTile name="chatbubble-outline" tone="accent" />}
            title="Paste bank SMS"
            subtitle="Copy your bank alerts and paste them in"
            chevron
            onPress={() => { setShowImport(false); navigation.navigate('ImportSMS'); }}
          />
          <ListRow
            leading={<IconTile name="document-text-outline" tone="accent" />}
            title="Upload a statement"
            subtitle="PDF, Excel or CSV from your bank"
            chevron
            divider={false}
            onPress={() => { setShowImport(false); navigation.navigate('ImportStatement'); }}
          />
        </Card>
      </Sheet>
    </View>
  );
}

export function TransactionRow({ tx, onPress, showCategory }) {
  const when = formatDayLabel(parseTxDate(tx.date) || undefined);
  const money = tx.type === 'credit' ? tx.amount : -tx.amount;
  return (
    <ListRowFlat
      tx={tx}
      subtitle={showCategory ? tx.cat : when}
      money={money}
      onPress={onPress}
    />
  );
}

function ListRowFlat({ tx, subtitle, money, onPress }) {
  const { c } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 }}>
      <CategoryTile category={tx.cat} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" family="semibold" numberOfLines={1}>{tx.desc}</Text>
        <Text variant="label" family="regular" color="inkMuted" numberOfLines={1}>{subtitle}</Text>
      </View>
      <Money value={money} family="bold" tone="auto" showSign={money > 0} />
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={`${tx.desc}, ${formatMoney(money, { showSign: money > 0 })}`}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.sunken : 'transparent', borderRadius: radius.md })}
    >
      {content}
    </Pressable>
  );
}
