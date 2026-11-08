import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Badge, Button, Card, CategoryTile, EmptyState, Gradient, HeroCard, Icon, Input, ListRow, Money, Sheet, Text, tapFeedback,
  useTheme, useToast, IconTile,
} from '../components/ui';
import { computePaydayPlan, computeStats, weeklySummary, expectedPay, makeBalanceCheck, paydaysOf, parseTxDate } from '../services/finance';
import { foreignNote, formatForeign, walletBalance, walletsInNaira } from '../services/currency';
import { currentRates, loadWallets } from '../services/fxStore';
import { latestBalances } from '../services/balances';
import AsyncStorage from '../services/dataStore';
import { DEFAULT_SAVE_PERCENT, planPayday, planPeriod } from '../services/paydayPlan';
import { formatDayLabel, formatMoney } from '../services/format';
import { loadTransactions } from '../services/transactions';
import { checkAchievements, updateStreak } from '../services/notificationService';
import { awardXP, getXPState } from '../services/xpService';
import { syncFinScore, syncXP, trackEvent } from '../services/cloudSync';
import { isTrackingOnly } from '../services/usage';
import { homeCards, startingCard } from '../services/homeCards';
import { isBusinessTx } from '../services/categories';
import { businessMonth } from '../services/business';
import { loadOwed } from '../services/owedReminders';
import { owedSummary } from '../services/receivables';

// The card is a plan for money that hasn't arrived yet, so it says so plainly
// and doesn't read as a second balance next to "Left until payday".
function nextPayLabel(period) {
  if (!period.hasPayday) return 'Plan for this month';
  if (period.payIn === 0) return "Plan for today's pay";
  const date = period.start.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  return `Plan for your ${date} pay`;
}

function greeting(hour = new Date().getHours()) {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function ActionButton({ icon, label, onPress }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ alignItems: 'center', gap: space.xs + 2, flex: 1, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft }}>
        <Icon name={icon} size={22} color="accent" />
      </View>
      <Text variant="caption" family="medium" color="inkMuted" numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// How much of this pay is left against how far through the period you are. The
// line marks today: money ahead of the line means it should last.
function PeriodBar({ plan }) {
  const { c } = useTheme();
  const { length, elapsed } = plan.cycle;
  const base = Math.max(plan.left, (plan.income || 0) + (plan.correction || 0));
  if (!(base > 0) || !(length > 0)) return null;
  const moneyLeft = Math.max(0, Math.min(1, plan.left / base));
  const timeLeft = Math.max(0, Math.min(1, 1 - elapsed / length));
  const ahead = moneyLeft >= timeLeft;
  return (
    <View style={{ gap: space.xs + 2, marginTop: space.md }}
      accessible accessibilityLabel={`${Math.round(moneyLeft * 100)}% of your money left, ${Math.round(timeLeft * 100)}% of the period to go`}>
      <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: c.sunken, overflow: 'hidden' }}>
        <View style={{ width: `${moneyLeft * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: ahead ? c.positive : c.warning }} />
        <View style={{ position: 'absolute', left: `${timeLeft * 100}%`, top: -2, bottom: -2, width: 2, backgroundColor: c.ink, opacity: 0.6 }} />
      </View>
      <Text variant="caption" color="inkMuted">
        {`${Math.round(moneyLeft * 100)}% of your money left · day ${elapsed} of ${length}`}
      </Text>
    </View>
  );
}

const HOME_CARD_KEY = 'finsight_home_card';
// Whether bank balances on Home are hidden (the eye button). Kept on the phone.
const HIDE_BALANCES_KEY = 'finsight_hide_bank_balances';

// What went out this month and how the pace compares with last month.
function SpendingCardBody({ stats }) {
  const daysSoFar = new Date().getDate();
  const perDay = stats.totalSpend / Math.max(1, daysSoFar);
  const change = stats.spendChange === null ? null : Math.round((stats.spendChange - 1) * 100);
  const pace = change === null
    ? (stats.totalSpend ? 'Nothing from last month to compare with yet' : 'Nothing recorded this month yet')
    : change === 0 ? 'The same pace as last month'
      : change < 0 ? `${-change}% less than last month's pace` : `${change}% more than last month's pace`;
  const top = Object.entries(stats.categoryTotals).sort((a, b) => b[1] - a[1])[0];
  return (
    <>
      <Text variant="label" family="medium" color="inkMuted">Spent this month</Text>
      <Money value={stats.totalSpend} variant="display" family="semibold" adjustsFontSizeToFit style={{ fontSize: 38, lineHeight: 48, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }} />
      <Text variant="label" family="medium" color="inkMuted">{`You've spent about ${formatMoney(Math.round(perDay))} a day${top ? `, most on ${top[0]}` : ''}`}</Text>
      <Text variant="label" family="semibold" color={change === null ? 'inkMuted' : change <= 0 ? 'positive' : 'negative'} style={{ marginTop: space.xs }}>{pace}</Text>
    </>
  );
}

// Where the money went this month, for someone only tracking spending.
function WhereItWent({ stats, transactions }) {
  const { c } = useTheme();
  const categories = Object.entries(stats.categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!categories.length) return null;
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <Text variant="label" family="semibold" color="inkMuted">Where it went this month</Text>
      {categories.map(([cat, amount]) => (
        <View key={cat} style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <CategoryTile category={cat} size={32} />
            <Text variant="bodyStrong" family="semibold" style={{ flex: 1 }}>{cat}</Text>
            <Text variant="caption" color="inkMuted">{`${Math.round((amount / stats.totalSpend) * 100)}%`}</Text>
            <Money value={amount} family="bold" />
          </View>
          <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: c.sunken, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(2, (amount / stats.totalSpend) * 100)}%`, height: '100%', backgroundColor: c.accent }} />
          </View>
        </View>
      ))}
      <Text variant="caption" color="inkMuted">{weeklySummary(transactions).text}</Text>
      {stats.biggest ? (
        <Text variant="caption" color="inkMuted">{`Biggest single expense: ${stats.biggest.desc}, ${formatMoney(stats.biggest.amount)}`}</Text>
      ) : null}
    </Card>
  );
}

// The top cards, side by side. Each snaps into place, the next one peeks in at
// the edge so it's clear there's more, and dots show which one is open.
function CardCarousel({ cards, render, onChange }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const gap = space.md;
  const peek = cards.length > 1 ? space.md : 0;
  const cardWidth = width - space.xl * 2 - peek;
  const step = cardWidth + gap;
  const keys = cards.map(card => card.key).join(',');

  // Opens on the card last looked at.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HOME_CARD_KEY).then(saved => {
      if (cancelled) return;
      const start = Math.max(0, cards.findIndex(card => card.key === startingCard(cards.map(k => k.key), saved)));
      setIndex(start);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: start * step, animated: false }));
      setReady(true);
    }).catch(() => setReady(true));
    return () => { cancelled = true; };
  }, [keys, step]);

  // Only a swipe by the user is remembered. Scrolls the app makes itself, such as
  // when the cards load or change, must never change which card opens next time.
  const swiped = useRef(false);

  function settle(x) {
    const next = Math.max(0, Math.min(cards.length - 1, Math.round(x / step)));
    if (next !== index) setIndex(next);
    if (!swiped.current) return;
    swiped.current = false;
    onChange?.(cards[next].key);
    AsyncStorage.setItem(HOME_CARD_KEY, cards[next].key).catch(() => {});
  }

  return (
    <View style={{ gap: space.sm, opacity: ready ? 1 : 0 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={cards.map((_, i) => i * step)}
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: space.xl, gap }}
        onScrollBeginDrag={() => { swiped.current = true; }}
        onMomentumScrollEnd={e => settle(e.nativeEvent.contentOffset.x)}
      >
        {cards.map((card, i) => (
          <View key={card.key} style={{ width: cardWidth, opacity: i === index ? 1 : 0.35 }} accessibilityLabel={`${card.label}, card ${i + 1} of ${cards.length}`}>
            {render(card)}
          </View>
        ))}
      </ScrollView>
      {cards.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityLabel={`Showing ${cards[index]?.label}. Swipe for more`}>
          {cards.map((card, i) => (
            <View key={card.key} style={{
              width: i === index ? 18 : 6, height: 6, borderRadius: 3,
              backgroundColor: i === index ? c.accent : c.lineStrong,
            }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// How long the money lasts at this pace, and whether it reaches payday.
function paceStatus(plan) {
  const { daysLeft, shortDays, cutPerDay, cycle } = plan;
  if (daysLeft === null || !cycle.hasPayday) return null;
  const length = daysLeft >= 365 ? 'Over a year of money left' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} of money left`;
  return shortDays > 0
    ? { line: `${length}. Spend ${formatMoney(cutPerDay)} less a day to reach payday.`, badge: `${shortDays} ${shortDays === 1 ? 'day' : 'days'} short`, tone: 'warning' }
    : { line: `${length}, so your money reaches payday.`, badge: 'On track', tone: 'positive' };
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
    <Card style={{ padding: space.lg, gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="hourglass-outline" size={18} color="inkMuted" />
          <Text variant="label" family="medium" color="inkMuted">Broke Clock</Text>
        </View>
        {hasPace && cycle.hasPayday ? (
          <Badge label={shortDays > 0 ? `${shortDays} ${shortDays === 1 ? 'day' : 'days'} short` : 'On track'} tone={shortDays > 0 ? 'warning' : 'positive'} />
        ) : null}
      </View>
      <Text variant="heading" family="semibold" numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
      <Text variant="label" family="regular" color="inkMuted">{advice}</Text>
    </Card>
  );
  if (hasPace && !cycle.hasPayday) {
    return <Pressable onPress={onSetPayday} accessibilityRole="button" accessibilityLabel="Set your payday in Settings">{card}</Pressable>;
  }
  return card;
}

export default function HomeScreen({ navigation, user, setUser }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [streak, setStreak] = useState({ count: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [planData, setPlanData] = useState({ debts: [], budgets: [] });
  const [wallets, setWallets] = useState([]);
  const [owed, setOwed] = useState([]);
  const [fxRates, setFxRates] = useState(null);
  const [checking, setChecking] = useState(false);
  const [realText, setRealText] = useState('');
  const [realError, setRealError] = useState('');
  const [hideBalances, setHideBalances] = useState(false);
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_BALANCES_KEY).then(v => setHideBalances(v === '1')).catch(() => {});
  }, []);

  function toggleBalances() {
    const next = !hideBalances;
    setHideBalances(next);
    AsyncStorage.setItem(HIDE_BALANCES_KEY, next ? '1' : '0').catch(() => {});
  }

  const firstName = user?.name?.split(' ')[0] || '';
  const plan = computePaydayPlan(user, transactions);
  const tracking = isTrackingOnly(user);
  // The calendar month, for the spending card.
  const month = computeStats(user, transactions);
  // The pay-period score, so Home and Insights always show the same number.
  const { finScore } = plan;

  async function load() {
    const txs = await loadTransactions();
    setTransactions(txs);
    const [dRaw, bRaw] = await Promise.all([AsyncStorage.getItem('finsight_debts'), AsyncStorage.getItem('finsight_budgets')]);
    setPlanData({ debts: dRaw ? JSON.parse(dRaw) : [], budgets: bRaw ? JSON.parse(bRaw) : [] });
    const w = await loadWallets();
    loadOwed().then(setOwed).catch(() => {});
    setWallets(w);
    if (w.length) currentRates().then(saved => setFxRates(saved?.rates || null)).catch(() => {});
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
      : `You can spend ${formatMoney(plan.safePerDay)} a day for the next ${plan.cycle.daysToGo} days`;
  const recent = transactions.slice(0, 4);
  const toCheck = transactions.filter(t => t.unconfirmed).length;
  const banks = latestBalances(transactions);
  const banksTotal = banks.reduce((sum, b) => sum + b.balance, 0);
  // A correction made in this pay period, shown so the user knows the figure is anchored.
  const check = user?.balanceCheck && plan.correction !== 0 ? user.balanceCheck : null;

  function openBalanceCheck() {
    setRealText(banks.length ? String(Math.round(banksTotal)) : '');
    setRealError('');
    setChecking(true);
  }

  async function saveUserFields(fields) {
    const updated = { ...user, ...fields };
    await AsyncStorage.setItem('finsight_user', JSON.stringify(updated));
    setUser?.(updated);
  }

  async function saveBalanceCheck() {
    // Unlike most amounts, nothing at all is a real answer here.
    const cleaned = realText.replace(/[₦,\s]/g, '');
    const value = /^\d+(\.\d+)?$/.test(cleaned) ? Math.round(Number(cleaned)) : null;
    if (value === null) { setRealError('Enter the total you have, like 250,000'); return; }
    try {
      await saveUserFields({ balanceCheck: makeBalanceCheck(value, plan.estimateLeft, plan.cycle) });
      setChecking(false);
      toast.show('Matched to your real balance', { tone: 'success' });
    } catch (e) {
      toast.show("Couldn't save this. Try again.", { tone: 'error' });
    }
  }

  async function clearBalanceCheck() {
    try {
      await saveUserFields({ balanceCheck: null });
      setChecking(false);
      toast.show('Back to the estimate');
    } catch (e) {
      toast.show("Couldn't save this. Try again.", { tone: 'error' });
    }
  }
  // The same plan as the Payday plan screen, for the next pay.
  const nextPayPeriod = planPeriod(paydaysOf(user));
  const nextPay = {
    period: nextPayPeriod,
    ...planPayday({
      pay: expectedPay(user, transactions).amount,
      debts: planData.debts,
      budgets: planData.budgets,
      savePercent: user?.paydaySavePercent ?? DEFAULT_SAVE_PERCENT,
      period: nextPayPeriod,
    }),
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.huge + space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
      >
        <Gradient style={{
          paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: space.xl,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: space.lg, overflow: 'hidden',
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
        </Gradient>

        {(() => {
          const biz = businessMonth(transactions);
          const due = owedSummary(owed);
          const keys = homeCards(user, {
            hasIncome: plan.income > 0,
            hasBusinessMoney: transactions.some(isBusinessTx),
            walletCount: wallets.length,
          });
          const labels = { personal: plan.cycle.hasPayday ? 'Left until payday' : 'Left this month', business: 'Business profit', spending: 'Spent this month', foreign: 'Foreign accounts' };
          const cards = keys.map(key => ({ key, label: labels[key] }));
          const cardStyle = { padding: space.xl, flex: 1, minHeight: 196 };
          const more = (text, onPress) => (
            <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ marginTop: 'auto', paddingTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Text variant="caption" family="semibold" color="accent">{text}</Text>
              <Icon name="chevron-forward" size={14} color="accent" />
            </Pressable>
          );
          return (
            <CardCarousel
              cards={cards}
              render={card => {
                if (card.key === 'personal') {
                  return (
                    <HeroCard tint="personal" style={cardStyle}>
                      <Text variant="label" family="medium" color="inkMuted">{card.label}</Text>
                      <Money value={plan.left} variant="display" family="semibold" adjustsFontSizeToFit style={{ fontSize: 38, lineHeight: 48, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }} />
                      <Text variant="label" family="regular" color="inkMuted">{subtitle}</Text>
                      <PeriodBar plan={plan} />
                      <Pressable onPress={openBalanceCheck} accessibilityRole="button" hitSlop={8} style={{ marginTop: 'auto', paddingTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                        <Icon name={check ? 'checkmark-circle' : 'scale-outline'} size={16} color="accent" />
                        <Text variant="caption" family="semibold" color="accent">
                          {check
                            ? `Matched to your real balance on ${new Date(check.checkedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`
                            : 'Match my real balance'}
                        </Text>
                      </Pressable>
                    </HeroCard>
                  );
                }
                if (card.key === 'business') {
                  return (
                    <HeroCard tint="business" style={cardStyle} onPress={() => navigation.navigate('Business')} accessibilityLabel={`Business profit this month ${formatMoney(biz.profit)}. Open your business`}>
                      <Text variant="label" family="medium" color="inkMuted">Business profit this month</Text>
                      <Money value={biz.profit} variant="display" family="semibold" tone={biz.profit < 0 ? 'negative' : 'ink'} adjustsFontSizeToFit style={{ fontSize: 38, lineHeight: 48, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }} />
                      <Text variant="label" family="medium" color="inkMuted">
                        {biz.count ? `Sales ${formatMoney(biz.sales + biz.otherIn)} · Costs ${formatMoney(biz.costs)}` : 'Record sales and costs to see your profit'}
                      </Text>
                      {due.count ? (
                        <Text variant="label" family="semibold" color={due.late ? 'negative' : 'inkMuted'} style={{ marginTop: space.xs }}>
                          {`Owed to you: ${formatMoney(due.total)}${due.late ? `, ${due.late} late` : ''}`}
                        </Text>
                      ) : null}
                      {more('Open your business', () => navigation.navigate('Business'))}
                    </HeroCard>
                  );
                }
                if (card.key === 'foreign') {
                  return (
                    <HeroCard tint="foreign" style={cardStyle} onPress={() => navigation.navigate('ForeignMoney')} accessibilityLabel="Foreign accounts. Open foreign money">
                      <Text variant="label" family="medium" color="inkMuted">Foreign accounts, in naira</Text>
                      <Money value={walletsInNaira(wallets, transactions, fxRates, user?.fxOwnRates)} variant="display" family="semibold" adjustsFontSizeToFit style={{ fontSize: 38, lineHeight: 48, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }} />
                      <Text variant="label" family="medium" color="inkMuted" numberOfLines={2}>
                        {wallets.slice(0, 3).map(w => `${w.name} ${formatForeign(walletBalance(w, transactions), w.currency)}`).join(' · ')}
                      </Text>
                      {more('Rates and accounts', () => navigation.navigate('ForeignMoney'))}
                    </HeroCard>
                  );
                }
                return (
                  <HeroCard tint="spending" style={cardStyle} onPress={() => navigation.navigate('Insights')} accessibilityLabel={`Spent this month ${formatMoney(month.totalSpend)}. See your insights`}>
                    <SpendingCardBody stats={month} />
                    {more('See where it went', () => navigation.navigate('Insights'))}
                  </HeroCard>
                );
              }}
            />
          );
        })()}

        <View style={{ paddingHorizontal: space.xl, gap: space.md + 2, marginTop: space.md }}>
          <View style={{ flexDirection: 'row', paddingVertical: space.xs }}>
            <ActionButton icon="download-outline" label="Import" onPress={() => setShowImport(true)} />
            <ActionButton icon="pie-chart-outline" label="Budget" onPress={() => navigation.navigate('Plan')} />
            <ActionButton icon="stats-chart-outline" label="Insights" onPress={() => navigation.navigate('Insights')} />
            <ActionButton icon="chatbubble-ellipses-outline" label="Ask ARIA" onPress={() => navigation.navigate('ARIA')} />
          </View>

          {/* The one thing on Home that needs the user: it comes first and stands out. */}
          {toCheck ? (
            <Card onPress={() => navigation.navigate('NewTransactions')} accessibilityLabel={`${toCheck} new from your bank. Review them`} style={{ padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1.5, borderColor: c.accent }}>
              <IconTile name="checkmark-done-outline" tone="accent" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyStrong" family="bold" numberOfLines={1} adjustsFontSizeToFit>{toCheck === 1 ? '1 new from your bank' : `${toCheck} new from your bank`}</Text>
                <Text variant="label" family="regular" color="inkMuted">Check them to keep figures right</Text>
              </View>
              <View style={{ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: space.sm + 4, paddingVertical: space.xs + 1 }}>
                <Text variant="caption" family="semibold" color="onAccent">Review</Text>
              </View>
            </Card>
          ) : null}

          {tracking ? <WhereItWent stats={month} transactions={transactions} /> : (
          <>
          {/* With a pay plan, the Broke Clock is one line inside the Plan card. */}
          {!nextPay.pay || !paceStatus(plan) ? <BrokeClock plan={plan} onSetPayday={() => navigation.navigate('Settings')} /> : null}

          {nextPay.pay ? (
            <Card onPress={() => navigation.navigate('PaydayPlan')} accessibilityLabel={`Your next pay plan: ${formatMoney(nextPay.free)} to spend freely. See full plan`} style={{ padding: space.lg, gap: space.md }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                  <Text variant="label" family="medium" color="inkMuted" style={{ flex: 1 }} numberOfLines={1}>{nextPayLabel(nextPay.period)}</Text>
                  {nextPay.short
                    ? <Badge label={`${formatMoney(nextPay.short)} short`} tone="negative" />
                    : paceStatus(plan) ? <Badge label={paceStatus(plan).badge} tone={paceStatus(plan).tone} /> : null}
                  <Icon name="chevron-forward" size={18} color="inkSubtle" />
                </View>
                  <Text variant="bodyStrong" family="semibold" style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {`${formatMoney(nextPay.free)} free to spend`}
                  </Text>
                  <Text variant="label" family="semibold" style={{ marginTop: 2 }}>
                    {`You can spend about ${formatMoney(nextPay.perDay)} a day`}
                  </Text>
                  <Text variant="caption" color="inkMuted">
                    {`Of ${formatMoney(nextPay.pay)}, after debts, budgets and savings`}
                  </Text>
              </View>
              {paceStatus(plan) ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs }}>
                  <View style={{ marginTop: 2 }}><Icon name="hourglass-outline" size={14} color="inkMuted" /></View>
                  <Text variant="caption" color="inkMuted" style={{ flex: 1 }}>{paceStatus(plan).line}</Text>
                </View>
              ) : null}
              {(() => {
                // How the pay splits, with a key so each colour explains itself.
                const parts = [
                  ['Debts', nextPay.debtTotal, c.negative],
                  ['Budgets', nextPay.budgetTotal, c.warning],
                  ['Savings', nextPay.saving, c.accent],
                  ['Free', nextPay.free, c.positive],
                ].filter(([, value]) => value > 0);
                return (
                  <>
                    <View style={{ flexDirection: 'row', height: 6, gap: 2 }}>
                      {parts.map(([label, value, color]) => <View key={label} style={{ flex: value, backgroundColor: color, borderRadius: radius.pill }} />)}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}>
                      {parts.map(([label, value, color]) => (
                        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                          <Text variant="caption" color="inkMuted">{`${label} ${formatMoney(value)}`}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                );
              })()}
            </Card>
          ) : null}
          </>
          )}

          <Card onPress={() => navigation.navigate('Insights')}
            accessibilityLabel={`FinScore ${finScore}. ${streak.count} day streak. See your insights.`}
            style={{ padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{
              width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center',
              borderColor: finScore >= 70 ? c.positive : finScore >= 50 ? c.warning : c.negative,
            }}>
              <Text variant="bodyStrong" family="bold" tabular>{finScore}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" family="semibold">Your FinScore</Text>
              <Text variant="label" family="regular" color="inkMuted">
                {streak.count > 0 ? `${streak.count}-day streak` : 'See what moves your score'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color="inkSubtle" />
          </Card>

          {banks.length ? (
            <Card style={{ padding: space.lg, gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" family="semibold">Bank balances</Text>
                  <Text variant="caption" color="inkMuted">From your latest bank alerts</Text>
                </View>
                <Pressable onPress={() => setShowBalanceInfo(v => !v)} accessibilityRole="button" hitSlop={12}
                  accessibilityLabel={showBalanceInfo ? 'Hide what these balances mean' : 'What these balances mean'}
                  style={{ marginRight: space.md }}>
                  <Icon name="information-circle-outline" size={20} color="inkMuted" />
                </Pressable>
                <Pressable onPress={toggleBalances} accessibilityRole="button" hitSlop={12}
                  accessibilityLabel={hideBalances ? 'Show bank balances' : 'Hide bank balances'}>
                  <Icon name={hideBalances ? 'eye-off-outline' : 'eye-outline'} size={20} color="inkMuted" />
                </Pressable>
              </View>
              {banks.slice(0, 3).map(b => (
                <View key={b.bank} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Text variant="bodyStrong" family="semibold" style={{ flex: 1 }} numberOfLines={1}>{b.bank}</Text>
                  <Text variant="caption" color="inkMuted">{formatDayLabel(new Date(b.capturedAt))}</Text>
                  {hideBalances
                    ? <Text variant="bodyStrong" family="bold" accessibilityLabel="Balance hidden">₦ ••••••</Text>
                    : <Money value={b.balance} family="bold" />}
                </View>
              ))}
              {showBalanceInfo ? (
                <Text variant="caption" color="inkMuted">
                  These are the real balances in your bank's latest alerts. "Left until payday" is FinSight's estimate from your income and spending, so the two can differ.
                </Text>
              ) : null}
            </Card>
          ) : null}

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

      <Sheet
        visible={checking}
        onClose={() => setChecking(false)}
        title="Match your real balance"
        footer={(
          <>
            <Button full title="Save" onPress={saveBalanceCheck} />
            {check ? <Button full title="Go back to the estimate" variant="ghost" onPress={clearBalanceCheck} /> : null}
          </>
        )}
      >
        <View style={{ gap: space.md }}>
          <Text color="inkMuted">
            FinSight estimates what's left from your income and the spending it knows about. Enter what you really have now, across all your accounts, and it corrects the estimate until your next payday.
          </Text>
          <Input
            label="What you have now"
            prefix="₦"
            keyboardType="numeric"
            placeholder="250,000"
            value={realText}
            error={realError}
            hint={banks.length
              ? `Your bank alerts last reported ${formatMoney(banksTotal)} across ${banks.map(b => b.bank).join(', ')}. Add any other accounts or cash.`
              : 'Check your banking apps and add up what you have, including cash.'}
            onChangeText={v => { setRealText(v); setRealError(''); }}
          />
          <Text variant="caption" color="inkMuted">
            {`The estimate says ${formatMoney(Math.max(0, plan.estimateLeft))}. Spending you add after this still comes off.`}
          </Text>
        </View>
      </Sheet>

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
      subtitle={[showCategory ? tx.cat : when, foreignNote(tx)].filter(Boolean).join(' · ')}
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
