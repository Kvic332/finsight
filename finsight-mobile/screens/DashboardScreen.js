import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, RefreshControl, Animated, Modal, Share,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT, CAT_COLORS, CAT_ICONS, INVESTMENTS } from '../constants/theme';
import { updateStreak, getStreak, getStreakBadge, checkAchievements } from '../services/notificationService';
import { awardXP, getXPState, getLevelInfo, LEVELS } from '../services/xpService';
import { trackEvent, syncFinScore, syncXP } from '../services/cloudSync';

const { width } = Dimensions.get('window');

function computeStats(user, transactions) {
  const income = user?.income || 0;
  const salaryDay = parseInt(user?.salaryDay) || 25;

  // ── Only use current month's transactions for balance & stats ─────────────
  const now = new Date();
  const monthTxs = transactions.filter(t => {
    // Handle en-NG format "DD/MM/YYYY" and ISO "YYYY-MM-DD"
    const raw = t.date || '';
    let d;
    if (raw.includes('/')) {
      const [day, month, year] = raw.split('/');
      d = new Date(`${year}-${month}-${day}`);
    } else {
      d = new Date(raw);
    }
    return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const debits  = monthTxs.filter(t => t.type === 'debit');
  const credits = monthTxs.filter(t => t.type === 'credit');
  const totalSpend  = debits.reduce((s, t) => s + t.amount, 0);
  const totalSaved  = credits.filter(t => t.cat === 'Savings').reduce((s, t) => s + t.amount, 0);
  const totalIncome = credits.filter(t => t.cat === 'Income').reduce((s, t) => s + t.amount, 0);
  // Always use the higher of: user's set monthly income OR credited income transactions.
  // This prevents a small credit (e.g. ₦4K) from overriding a ₦1.2M income setting.
  const effectiveIncome = Math.max(income, totalIncome);

  // ── Balance ────────────────────────────────────────────────────────────────
  const balance = Math.max(0, effectiveIncome - totalSpend + totalSaved);

  // ── Broke Clock ────────────────────────────────────────────────────────────
  // Use 30-day window for daily burn rate
  const dailySpend = totalSpend > 0 ? totalSpend / 30 : 0;
  const daysLeft   = dailySpend > 0 ? Math.min(365, Math.max(0, Math.round(balance / dailySpend))) : 365;

  // Days until next salary for monthly earners
  const today = new Date().getDate();
  const daysUntilSalary = salaryDay >= today
    ? salaryDay - today
    : (31 - today + salaryDay); // rolls to next month
  // Projected balance on salary day (will they make it?)
  const projectedOnPayday = Math.max(0, balance - dailySpend * daysUntilSalary);
  const willMakePayday   = daysLeft >= daysUntilSalary || daysUntilSalary === 0;

  // ── Savings rate ───────────────────────────────────────────────────────────
  const savingsRate = effectiveIncome > 0 ? Math.round((totalSaved / effectiveIncome) * 100) : 0;

  // ── FinScore ───────────────────────────────────────────────────────────────
  // Spend Discipline (0-100):
  //   ratio=0 → 100, ratio=0.8 → 50, ratio=1.0 → 17, ratio>=1.2 → 0
  const spendRatio = effectiveIncome > 0 ? totalSpend / effectiveIncome : 1;
  const spendScore = Math.max(0, Math.min(100, Math.round((1.2 - spendRatio) / 1.2 * 100)));

  // Savings Rate Score (0-100): 20%+ savings = 100
  const saveScore = Math.min(100, Math.round(savingsRate * 5));

  // Budget Adherence: category diversity + tracking consistency
  const catTotals = {};
  debits.forEach(t => { catTotals[t.cat] = (catTotals[t.cat] || 0) + t.amount; });
  const catValues = Object.values(catTotals);
  const numCats = catValues.length;
  const maxCatPct = totalSpend > 0 && catValues.length > 0 ? Math.max(...catValues) / totalSpend : 1;
  // More categories = better balance; no single category dominating = healthier
  const diversityPoints = Math.min(40, numCats * 10);
  const balancePoints   = maxCatPct < 0.5 ? 30 : maxCatPct < 0.7 ? 15 : 0;
  const trackingPoints  = Math.min(30, transactions.length * 3);
  const txScore = Math.min(100, diversityPoints + balancePoints + trackingPoints);

  // Investment Activity: goals + savings transactions (not hardcoded)
  const goals = user?.goals || [];
  const hasGoals    = goals.length > 0;
  const hasSavingsTx = transactions.some(t =>
    t.cat === 'Savings' ||
    /cowrywise|piggyvest|invest|risevest|bamboo/i.test(t.desc || ''));
  const investScore = Math.min(100,
    (hasGoals    ? 35 : 0) +
    (hasSavingsTx ? 45 : 0) +
    (savingsRate >= 10 ? 20 : savingsRate >= 5 ? 10 : 0));

  // Weighted composite (spend+save weighted higher than tracking+invest)
  const finScore = Math.max(10, Math.min(100, Math.round(
    spendScore * 0.35 + saveScore * 0.35 + txScore * 0.15 + investScore * 0.15
  )));

  const categoryTotals = catTotals;

  // 7-day trend uses ALL transactions (not just this month) so it works across month boundaries
  const allDebits = transactions.filter(t => t.type === 'debit');
  const spendTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const day   = d.toLocaleDateString('en-NG', { weekday: 'short' });
    const dateStr = d.toLocaleDateString('en-NG');
    const spend = allDebits.filter(t => t.date === dateStr).reduce((s, t) => s + t.amount, 0);
    return { day, spend };
  });

  return {
    balance, totalSpend, totalSaved, daysLeft, finScore,
    savingsRate, spendTrend, categoryTotals,
    income: effectiveIncome,
    daysUntilSalary, projectedOnPayday, willMakePayday, dailySpend,
    scoreBreakdown: { spendScore, saveScore, txScore, investScore },
  };
}

// ── Category Breakdown ────────────────────────────────────────────────────────
function CategoryBreakdown({ categoryTotals, totalSpend, T }) {
  const entries = Object.entries(categoryTotals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  if (!entries.length || totalSpend === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Text style={{ color: T.mute, fontSize: 12 }}>No spending data yet</Text>
      </View>
    );
  }

  // Stacked color bar
  const segments = entries.map(([cat, amt]) => ({
    cat, amt, pct: amt / totalSpend,
    color: CAT_COLORS[cat] || '#8080A8',
  }));

  return (
    <View>
      {/* Stacked bar */}
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 16, gap: 1 }}>
        {segments.map((seg, i) => (
          <View key={i} style={{ flex: seg.pct, backgroundColor: seg.color }} />
        ))}
      </View>

      {/* Category rows */}
      <View style={{ gap: 10 }}>
        {segments.map((seg, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Icon + name */}
            <View style={{ width: 28, height: 28, borderRadius: 8,
              backgroundColor: seg.color + '22', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 14 }}>{CAT_ICONS[seg.cat] || '📦'}</Text>
            </View>
            <Text style={{ color: T.ink2, fontSize: 13, fontWeight: '600', width: 80 }} numberOfLines={1}>
              {seg.cat}
            </Text>
            {/* Mini bar */}
            <View style={{ flex: 1, height: 6, backgroundColor: T.line, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${seg.pct * 100}%`, height: '100%',
                backgroundColor: seg.color, borderRadius: 3 }} />
            </View>
            {/* Pct + amount */}
            <Text style={{ color: T.mute, fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' }}>
              {Math.round(seg.pct * 100)}%
            </Text>
            <Text style={{ color: T.ink, fontSize: 12, fontWeight: '700', width: 60, textAlign: 'right' }}>
              ₦{seg.amt >= 1000 ? `${(seg.amt/1000).toFixed(0)}K` : seg.amt}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── 7-Day Spending Bar Chart ──────────────────────────────────────────────────
function SpendChart({ data, T }) {
  const CHART_H = 90;
  const maxSpend = Math.max(...data.map(d => d.spend), 1);
  const hasData  = data.some(d => d.spend > 0);

  if (!hasData) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Text style={{ color: T.mute, fontSize: 12 }}>No spending data yet this week</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 36, gap: 5 }}>
      {data.map((item, i) => {
        const isToday   = i === 6;
        const barH      = item.spend > 0 ? Math.max(6, (item.spend / maxSpend) * CHART_H) : 4;
        const barColor  = isToday ? '#6366F1' : '#6366F155';
        const labelAmt  = item.spend >= 1000
          ? `${(item.spend / 1000).toFixed(0)}K`
          : item.spend > 0 ? String(item.spend) : '';

        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            {/* Amount label above bar */}
            <Text style={{
              color: isToday ? '#818CF8' : T.mute,
              fontSize: 8, fontWeight: '700',
              marginBottom: 3, height: 12,
            }}>
              {labelAmt}
            </Text>
            {/* Bar */}
            <View style={{
              width: '100%', height: barH,
              backgroundColor: barColor,
              borderRadius: 5,
              borderTopLeftRadius: 5, borderTopRightRadius: 5,
            }} />
            {/* Day label */}
            <Text style={{
              color: isToday ? T.ink : T.mute,
              fontSize: 9, fontWeight: isToday ? '800' : '500',
              marginTop: 5,
            }}>
              {item.day.slice(0, 3)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── FinScore Breakdown Modal ──────────────────────────────────────────────────
function FinScoreModal({ visible, onClose, finScore, scoreBreakdown, T }) {
  const { spendScore, saveScore, txScore, investScore } = scoreBreakdown;

  const grade = finScore >= 80 ? { label: 'Excellent', emoji: '🏆', color: '#34D399' }
              : finScore >= 70 ? { label: 'Good',      emoji: '💪', color: '#818CF8' }
              : finScore >= 50 ? { label: 'Average',   emoji: '📈', color: '#FBBF24' }
              :                  { label: 'Needs work', emoji: '🔧', color: '#F87171' };

  const components = [
    {
      label: 'Spend Discipline',
      score: spendScore,
      icon: '💳',
      desc: 'How well you keep spending below your income.',
      tip: spendScore < 70
        ? 'Your spending is high relative to income. Try cutting the top 1–2 expense categories by 20%.'
        : 'Great! Keep spending below 80% of your income.',
    },
    {
      label: 'Savings Rate',
      score: saveScore,
      icon: '🏦',
      desc: 'Percentage of income going to savings.',
      tip: saveScore < 70
        ? 'Aim to save at least 10–20% of income. Set up automatic transfers to PiggyVest or Cowrywise.'
        : 'Solid savings rate. Consider investing the excess.',
    },
    {
      label: 'Budget Adherence',
      score: txScore,
      icon: '📊',
      desc: 'How consistently you track and categorise spending.',
      tip: txScore < 70
        ? 'Log transactions daily. The more categories you use, the higher this score.'
        : 'You\'re tracking well across multiple categories.',
    },
    {
      label: 'Investment Activity',
      score: investScore,
      icon: '📈',
      desc: 'Whether you have savings goals and investment transactions.',
      tip: investScore < 70
        ? 'Start a savings goal in the Savings tab or make one investment transaction to boost this.'
        : 'You\'re putting money to work. Keep going!',
    },
  ];

  // Generate top 3 personalised tips
  const tips = [...components]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(c => c.tip);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingVertical: 18,
          borderBottomWidth: 1, borderBottomColor: T.line,
        }}>
          <Text style={{ color: T.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>
            FinScore Breakdown
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: T.mute, fontSize: 20, padding: 4 }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>

          {/* Score hero */}
          <View style={{
            backgroundColor: T.surface, borderRadius: 20, padding: 24,
            alignItems: 'center', borderWidth: 1, borderColor: T.line,
            borderTopWidth: 3, borderTopColor: grade.color,
          }}>
            <Text style={{ fontSize: 40 }}>{grade.emoji}</Text>
            <Text style={{ color: grade.color, fontSize: 72, fontWeight: '900', letterSpacing: -2, lineHeight: 76 }}>
              {finScore}
            </Text>
            <Text style={{ color: T.mute, fontSize: 13, marginBottom: 4 }}>out of 100</Text>
            <View style={{ backgroundColor: grade.color + '22', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, marginTop: 4 }}>
              <Text style={{ color: grade.color, fontWeight: '800', fontSize: 13 }}>{grade.label}</Text>
            </View>
          </View>

          {/* Component breakdown */}
          <Text style={{ color: T.mute, fontSize: 9, fontWeight: '700', letterSpacing: 2.5 }}>
            SCORE COMPONENTS
          </Text>
          {components.map((comp, i) => {
            const c = comp.score >= 70 ? '#34D399' : comp.score >= 50 ? '#FBBF24' : '#F87171';
            return (
              <View key={i} style={{
                backgroundColor: T.surface, borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: T.line,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>{comp.icon}</Text>
                    <Text style={{ color: T.ink, fontWeight: '700', fontSize: 14 }}>{comp.label}</Text>
                  </View>
                  <Text style={{ color: c, fontWeight: '900', fontSize: 22, letterSpacing: -0.5 }}>{comp.score}</Text>
                </View>
                {/* Progress bar */}
                <View style={{ height: 6, backgroundColor: T.line, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <View style={{ width: `${comp.score}%`, height: '100%', backgroundColor: c, borderRadius: 3 }} />
                </View>
                <Text style={{ color: T.mute, fontSize: 12, lineHeight: 18 }}>{comp.desc}</Text>
              </View>
            );
          })}

          {/* Personalised tips */}
          <Text style={{ color: T.mute, fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginTop: 4 }}>
            TOP 3 WAYS TO IMPROVE
          </Text>
          {tips.map((tip, i) => (
            <View key={i} style={{
              flexDirection: 'row', gap: 12, backgroundColor: T.surface,
              borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.line,
            }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ color: T.ink2, fontSize: 13, lineHeight: 20, flex: 1 }}>{tip}</Text>
            </View>
          ))}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function DashboardScreen({ theme, toggleTheme, user }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState({ count: 0, longest: 0 });
  const [achievements, setAchievements] = useState([]);
  const [showAchievement, setShowAchievement] = useState(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [xpState, setXpState] = useState(getLevelInfo(0));
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef(null);
  const achieveAnim = useState(new Animated.Value(0))[0];
  const s = styles(T);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const firstName = user?.name?.split(' ')[0] || 'there';
  const initial = firstName[0]?.toUpperCase() || 'U';

  async function load() {
    const raw = await AsyncStorage.getItem('finsight_transactions');
    const txs = raw ? JSON.parse(raw) : [];
    setTransactions(txs);

    // Update streak
    const updatedStreak = await updateStreak();
    setStreak(updatedStreak);

    // Check achievements
    const stats = computeStats(user, txs);
    const { newlyEarned, earned } = await checkAchievements(updatedStreak, txs, stats.finScore);
    setAchievements(earned);

    // Show achievement popup if newly earned
    if (newlyEarned.length > 0) {
      showAchievementPopup(newlyEarned[0]);
    }

    // Award daily open XP + streak XP
    const result = await awardXP('daily_open');
    if (updatedStreak.count >= 30) await awardXP('streak_30');
    else if (updatedStreak.count >= 7) await awardXP('streak_7');

    // Award FinScore XP
    const { finScore } = computeStats(user, txs);
    if (finScore >= 80) await awardXP('finscore_80');
    else if (finScore >= 70) await awardXP('finscore_70');

    // Sync FinScore + XP to cloud
    syncFinScore(finScore).catch(() => {});

    // Refresh XP display
    const xp = await getXPState();
    setXpState(xp);
    syncXP(xp.totalXP, xp.current.level).catch(() => {});

    // Show level-up if happened
    if (result.leveledUp && result.newLevel) {
      setLevelUpInfo(result.newLevel);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1.0 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your FinScore' });
      } else {
        await Share.share({ url: uri, message: 'My FinScore this week on FinSight 🔥' });
      }
    } catch (e) { /* user cancelled */ }
    setSharing(false);
  }

  function showAchievementPopup(ach) {
    setShowAchievement(ach);
    Animated.sequence([
      Animated.timing(achieveAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(achieveAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setShowAchievement(null));
  }

  useEffect(() => { load(); trackEvent('dashboard_views'); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const stats = computeStats(user, transactions);
  const { balance, totalSpend, totalSaved, daysLeft, finScore, categoryTotals, spendTrend, income,
          daysUntilSalary, projectedOnPayday, willMakePayday } = stats;
  const urgencyColor = daysLeft < 7 ? T.rose : daysLeft < 20 ? T.amber : T.limeDeep;
  const scoreGrade = finScore >= 80 ? 'A · Great' : finScore >= 70 ? 'B+ · Good' : finScore >= 50 ? 'C · Average' : 'D · Needs work';
  const catData = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCat = catData.length > 0 ? catData[0][1] : 1;
  const streakBadge = getStreakBadge(streak.count);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>

      {/* Achievement popup */}
      {showAchievement && (
        <Animated.View style={[s.achievePopup, {
          backgroundColor: '#13131F', borderWidth: 1, borderColor: '#6366F1',
          opacity: achieveAnim,
          transform: [{ translateY: achieveAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }]}>
          <Text style={{ fontSize: 24 }}>{showAchievement.emoji}</Text>
          <View>
            <Text style={[s.achieveTitle, { color: '#818CF8' }]}>Achievement Unlocked!</Text>
            <Text style={[s.achieveSub, { color: 'rgba(255,255,255,0.65)' }]}>{showAchievement.title} — {showAchievement.desc}</Text>
          </View>
        </Animated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.lime} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={[s.headerEye, { color: T.mute }]}>GOOD {greeting.toUpperCase()}</Text>
            <Text style={[s.headerName, { color: T.ink }]}>{firstName} 👋</Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity onPress={toggleTheme} style={s.themeBtn}>
              <Text style={{ fontSize: 17 }}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <View style={[s.avatar, { backgroundColor: T.ink }]}>
              <Text style={{ color: T.lime, fontWeight: '800', fontSize: 15 }}>{initial}</Text>
            </View>
          </View>
        </View>

        {/* Streak Banner */}
        {streak.count > 0 && (
          <View style={[s.streakBanner, { backgroundColor: T.surface, borderColor: streakBadge.color + '44' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 28 }}>{streakBadge.emoji}</Text>
              <View>
                <Text style={[s.streakCount, { color: streakBadge.color }]}>
                  {streak.count} day{streak.count !== 1 ? 's' : ''} streak
                </Text>
                <Text style={[s.streakLabel, { color: T.mute }]}>
                  {streakBadge.label} · Best: {streak.longest} days
                </Text>
              </View>
            </View>
            <View style={s.streakDots}>
              {Array.from({ length: Math.min(7, streak.count) }).map((_, i) => (
                <View key={i} style={[s.streakDot, { backgroundColor: streakBadge.color }]} />
              ))}
              {Array.from({ length: Math.max(0, 7 - streak.count) }).map((_, i) => (
                <View key={i} style={[s.streakDot, { backgroundColor: T.line }]} />
              ))}
            </View>
          </View>
        )}

        {/* Balance Hero Card */}
        <View style={[s.heroCard, { backgroundColor: T.surface }]}>
          <Text style={[s.heroLabel, { color: T.mute }]}>ESTIMATED BALANCE</Text>
          <Text style={[s.heroBalance, { color: T.ink }]}>
            ₦<Text style={{ color: T.limeDeep }}>
              {balance >= 1000000
                ? `${(balance / 1000000).toFixed(1)}M`
                : balance >= 1000
                ? `${(balance / 1000).toFixed(0)}K`
                : balance.toLocaleString()}
            </Text>
          </Text>
          <Text style={[s.heroGrade, { color: urgencyColor }]}>
            {finScore >= 70 ? 'On track ↑' : 'Needs attention ↓'}
          </Text>
          <View style={[s.heroDivider, { borderColor: T.line }]} />
          <View style={s.heroStats}>
            {[
              { label: 'SPENT',  val: `₦${totalSpend >= 1000 ? (totalSpend/1000).toFixed(0)+'K' : totalSpend.toLocaleString()}`, color: T.rose },
              { label: 'SAVED',  val: `₦${totalSaved >= 1000 ? (totalSaved/1000).toFixed(0)+'K' : totalSaved.toLocaleString()}`, color: T.green || T.limeDeep },
              { label: 'INCOME', val: income > 0 ? `₦${(income/1000).toFixed(0)}K` : '—', color: T.ink2 },
            ].map((s2, i) => (
              <View key={i} style={s.heroStatPill}>
                <Text style={[s.heroStatLabel, { color: T.mute }]}>{s2.label}</Text>
                <Text style={[s.heroStatVal, { color: s2.color }]}>{s2.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* XP / Level card */}
        <TouchableOpacity
          style={[s.card, { backgroundColor: T.surface, padding: 16 }]}
          activeOpacity={0.85}
          onPress={() => {}}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Level badge */}
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 24 }}>{xpState.current.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View>
                  <Text style={{ color: T.mute, fontSize: 9, fontWeight: '700', letterSpacing: 2 }}>
                    LEVEL {xpState.current.level}
                  </Text>
                  <Text style={{ color: T.ink, fontWeight: '800', fontSize: 15, letterSpacing: -0.2 }}>
                    {xpState.current.title}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#818CF8', fontWeight: '800', fontSize: 14 }}>
                    {xpState.totalXP} XP
                  </Text>
                  {xpState.next && (
                    <Text style={{ color: T.mute, fontSize: 10 }}>
                      {xpState.xpForLevel - xpState.xpInLevel} to {xpState.next.title}
                    </Text>
                  )}
                </View>
              </View>
              {/* XP progress bar */}
              <View style={{ height: 6, backgroundColor: T.line, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{
                  width: `${xpState.pct}%`, height: '100%',
                  backgroundColor: '#6366F1', borderRadius: 3,
                }} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Broke Clock — always dark indigo card for contrast */}
        <View style={[s.brokeCard, { backgroundColor: '#1A1A3E' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.brokeLabel, { color: 'rgba(255,255,255,0.5)' }]}>BROKE CLOCK™</Text>
            <Text style={[s.brokeNum, { color: urgencyColor }]}>{daysLeft >= 365 ? '∞' : daysLeft}</Text>
            <Text style={[s.brokeSub, { color: 'rgba(255,255,255,0.45)' }]}>days at current pace</Text>

            {user?.salaryDay ? (
              <View style={{ marginTop: 12, gap: 5 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600' }}>
                  📅 Salary in {daysUntilSalary}d (day {user.salaryDay})
                </Text>
                <Text style={{
                  fontSize: 11, fontWeight: '600',
                  color: willMakePayday ? '#34D399' : '#F87171',
                }}>
                  {willMakePayday
                    ? `~₦${projectedOnPayday >= 1000 ? (projectedOnPayday/1000).toFixed(0)+'K' : projectedOnPayday} est. on payday ✓`
                    : 'May run short before salary ⚠️'}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 8 }}>
            {[
              { l: 'Now',  d: daysLeft,                              c: daysLeft < 7 ? '#F87171' : '#FBBF24' },
              { l: '−20%', d: Math.min(365, Math.round(daysLeft * 1.25)), c: '#FBBF24' },
              { l: 'ARIA', d: Math.min(365, Math.round(daysLeft * 1.6)),  c: '#818CF8' },
            ].map((item, i) => (
              <View key={i} style={[s.brokeScenario, { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={[s.brokeScenLabel, { color: 'rgba(255,255,255,0.5)' }]}>{item.l}</Text>
                <Text style={[s.brokeScenVal, { color: item.c }]}>{item.d >= 365 ? '365+' : item.d}d</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 7-Day Spending Chart */}
        <View style={[s.card, { backgroundColor: T.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={[s.cardLabel, { color: T.mute }]}>SPENDING TREND</Text>
              <Text style={[s.cardTitle, { color: T.ink, fontSize: 15 }]}>Last 7 days</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: T.mute, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>TOTAL</Text>
              <Text style={{ color: T.rose, fontWeight: '800', fontSize: 16, letterSpacing: -0.3 }}>
                ₦{spendTrend.reduce((s, d) => s + d.spend, 0).toLocaleString()}
              </Text>
            </View>
          </View>
          <SpendChart data={spendTrend} T={T} />
        </View>

        {/* Category Breakdown */}
        <View style={[s.card, { backgroundColor: T.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={[s.cardLabel, { color: T.mute }]}>SPENDING BREAKDOWN</Text>
              <Text style={[s.cardTitle, { color: T.ink, fontSize: 15 }]}>Where your money goes</Text>
            </View>
            <Text style={{ color: T.mute, fontSize: 11, fontWeight: '700' }}>
              {Object.keys(categoryTotals).filter(k => categoryTotals[k] > 0).length} categories
            </Text>
          </View>
          <CategoryBreakdown categoryTotals={categoryTotals} totalSpend={totalSpend} T={T} />
        </View>

        {/* FinScore — tappable to open breakdown */}
        <TouchableOpacity
          style={[s.card, { backgroundColor: T.surface }]}
          onPress={() => setShowScoreModal(true)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardLabel, { color: T.mute }]}>FINSCORE · COMPOSITE</Text>
              <Text style={[s.cardTitle, { color: T.ink }]}>
                How <Text style={{ color: T.limeDeep, fontStyle: 'italic' }}>healthy</Text> are your habits?
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[s.scoreNum, { color: T.ink }]}>{finScore}<Text style={[s.scoreDenom, { color: T.mute }]}>/100</Text></Text>
              <Text style={[s.scoreGrade, { color: T.mute }]}>{scoreGrade}</Text>
              <TouchableOpacity
                onPress={() => setShowShareCard(true)}
                style={{ backgroundColor: T.limeDeep, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 }}
              >
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>📤 Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          {[
            { label: 'Spend Discipline', score: stats.scoreBreakdown.spendScore },
            { label: 'Savings Rate', score: stats.scoreBreakdown.saveScore },
            { label: 'Budget Adherence', score: stats.scoreBreakdown.txScore },
            { label: 'Investment Activity', score: stats.scoreBreakdown.investScore },
          ].map((f, i) => {
            const c = f.score >= 70 ? T.limeDeep : f.score >= 50 ? T.amber : T.rose;
            return (
              <View key={i} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={[s.barLabel, { color: T.ink2 }]}>{f.label}</Text>
                  <Text style={[s.barLabel, { color: c, fontWeight: '700' }]}>{Math.max(0, f.score)}</Text>
                </View>
                <View style={[s.barTrack, { backgroundColor: T.line }]}>
                  <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, f.score))}%`, backgroundColor: c }]} />
                </View>
              </View>
            );
          })}
        </TouchableOpacity>

        {/* Achievements */}
        {achievements.length > 0 && (
          <View style={[s.card, { backgroundColor: T.surface }]}>
            <Text style={[s.cardLabel, { color: T.mute, marginBottom: 12 }]}>ACHIEVEMENTS · {achievements.length} EARNED</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {[
                { id:'first_log', emoji:'👶', title:'First Step' },
                { id:'ten_logs', emoji:'📝', title:'Getting Started' },
                { id:'fifty_logs', emoji:'📊', title:'Tracking Pro' },
                { id:'streak_3', emoji:'⚡', title:'Habit Forming' },
                { id:'streak_7', emoji:'🔥', title:'One Week Strong' },
                { id:'streak_30', emoji:'🥉', title:'Monthly Master' },
                { id:'finscore_50', emoji:'📈', title:'Average Achieved' },
                { id:'finscore_70', emoji:'💪', title:'Good Shape' },
                { id:'sms_import', emoji:'📱', title:'SMS Pro' },
              ].map((ach, i) => {
                const earned = achievements.includes(ach.id);
                return (
                  <View key={i} style={[s.achBadge, {
                    backgroundColor: earned ? T.limeDeep + '22' : T.surface2,
                    borderColor: earned ? T.limeDeep : T.line,
                    opacity: earned ? 1 : 0.4,
                  }]}>
                    <Text style={{ fontSize: 22 }}>{ach.emoji}</Text>
                    <Text style={[s.achLabel, { color: earned ? T.limeDeep : T.mute }]}>{ach.title}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Spending Categories — removed: duplicate of SPENDING BREAKDOWN card above */}

        {/* Recent Transactions */}
        <View style={[s.card, { backgroundColor: T.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={[s.cardTitle, { color: T.ink, fontSize: 16 }]}>Recent transactions</Text>
            <Text style={[s.cardLabel, { color: T.mute }]}>{transactions.length} total</Text>
          </View>
          {transactions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
              <Text style={[s.barLabel, { color: T.mute, textAlign: 'center' }]}>No transactions yet.{'\n'}Go to SMS Import to get started.</Text>
            </View>
          ) : transactions.slice(0, 5).map((tx, i) => (
            <View key={tx.id || i} style={[s.txRow, { borderBottomColor: T.line, borderBottomWidth: i < 4 ? 1 : 0 }]}>
              <View style={[s.txIcon, { backgroundColor: tx.type === 'credit' ? T.limeDeep + '22' : T.surface2 }]}>
                <Text style={{ fontSize: 18 }}>{CAT_ICONS[tx.cat] || '📦'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.txName, { color: T.ink }]} numberOfLines={1}>{tx.desc}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 }}>
                  <View style={[s.sourceBadge, { backgroundColor: T.surface2, borderColor: T.line }]}>
                    <Text style={[s.sourceText, { color: T.mute }]}>{tx.source === 'sms' ? 'SMS' : tx.source === 'push' ? 'Push' : 'Manual'}</Text>
                  </View>
                  {tx.bank && (
                    <View style={[s.sourceBadge, { backgroundColor: T.surface2, borderColor: T.line }]}>
                      <Text style={[s.sourceText, { color: T.mute }]}>{tx.bank}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[s.txAmt, { color: tx.type === 'credit' ? (T.green || '#34D399') : T.ink }]}>
                {tx.type === 'credit' ? '+' : '−'}₦{tx.amount.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Quick Investments */}
        <View style={[s.card, { backgroundColor: T.surface }]}>
          <Text style={[s.cardLabel, { color: T.mute, marginBottom: 4 }]}>RECOMMENDED FOR YOU</Text>
          <Text style={[s.cardTitle, { color: T.ink, marginBottom: 16 }]}>Grow your money</Text>
          {INVESTMENTS.slice(0, 3).map((inv, i) => (
            <View key={i} style={[s.invCard, { backgroundColor: T.bg1, borderColor: T.line, marginBottom: i < 2 ? 10 : 0 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <Text style={[s.invName, { color: T.ink }]}>{inv.name}</Text>
                <View style={[s.riskBadge, { backgroundColor: inv.riskColor + '22', borderColor: inv.riskColor + '44' }]}>
                  <Text style={[s.riskText, { color: inv.riskColor }]}>{inv.risk}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                <View>
                  <Text style={[s.invLabel, { color: T.mute }]}>RETURN</Text>
                  <Text style={[s.invVal, { color: inv.riskColor }]}>{inv.ret} <Text style={{ fontSize: 11, color: T.mute }}>p.a</Text></Text>
                </View>
                <View>
                  <Text style={[s.invLabel, { color: T.mute }]}>MIN</Text>
                  <Text style={[s.invVal, { color: T.ink2 }]}>{inv.min}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* FinScore Breakdown Modal */}
      <FinScoreModal
        visible={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        finScore={finScore}
        scoreBreakdown={stats.scoreBreakdown}
        T={T}
      />

      {/* Level-Up Modal */}
      <Modal visible={!!levelUpInfo} transparent animationType="fade" onRequestClose={() => setLevelUpInfo(null)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', alignItems:'center', padding:32 }}>
          <View style={{ backgroundColor:'#13131F', borderRadius:28, padding:32, alignItems:'center', borderWidth:1, borderColor:'#6366F1', width:'100%' }}>
            <Text style={{ fontSize:64, marginBottom:8 }}>{levelUpInfo?.emoji}</Text>
            <Text style={{ color:'#818CF8', fontSize:11, fontWeight:'700', letterSpacing:3, marginBottom:4 }}>LEVEL UP!</Text>
            <Text style={{ color:'#F0F0FF', fontSize:28, fontWeight:'900', letterSpacing:-0.5, marginBottom:8 }}>
              {levelUpInfo?.title}
            </Text>
            <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:14, textAlign:'center', lineHeight:22, marginBottom:24 }}>
              You've reached Level {levelUpInfo?.level}. Keep tracking your finances to unlock more rewards!
            </Text>
            <TouchableOpacity
              onPress={() => setLevelUpInfo(null)}
              style={{ backgroundColor:'#6366F1', borderRadius:16, paddingHorizontal:40, paddingVertical:14 }}>
              <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>Let's go! 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Share Card Modal ─────────────────────────────────────────────── */}
      <Modal visible={showShareCard} transparent animationType="fade" onRequestClose={() => setShowShareCard(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.85)', justifyContent:'center', alignItems:'center', padding:24 }}>

          {/* The card that gets captured as image */}
          <View ref={shareCardRef} collapsable={false} style={{
            width: 320, borderRadius: 24, overflow:'hidden',
            backgroundColor:'#0A0A12',
            borderWidth: 1.5, borderColor:'#6366F1',
          }}>
            {/* Top accent bar */}
            <View style={{ height: 4, backgroundColor:'#6366F1' }} />

            {/* Header */}
            <View style={{ padding: 20, paddingBottom: 12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View>
                <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:'700', letterSpacing:2 }}>WEEKLY FINSCORE</Text>
                <Text style={{ color:'#fff', fontSize:16, fontWeight:'900', marginTop:2 }}>
                  {user?.name?.split(' ')[0] || 'FinSight User'}
                </Text>
              </View>
              <View style={{ backgroundColor:'#6366F122', borderRadius:10, padding:8 }}>
                <Text style={{ fontSize: 24, fontStyle:'italic', color:'#818CF8', fontWeight:'900' }}>f</Text>
              </View>
            </View>

            {/* Big score */}
            <View style={{ alignItems:'center', paddingVertical: 20, backgroundColor:'#0D0D1A' }}>
              <Text style={{ color:'#818CF8', fontSize:72, fontWeight:'900', letterSpacing:-2 }}>{finScore}</Text>
              <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginTop:-4 }}>out of 100</Text>
              <View style={{ marginTop:10, backgroundColor:
                finScore >= 80 ? '#34D39920' : finScore >= 70 ? '#FBBF2420' : '#F8717120',
                borderRadius:20, paddingHorizontal:14, paddingVertical:5 }}>
                <Text style={{ color:
                  finScore >= 80 ? '#34D399' : finScore >= 70 ? '#FBBF24' : '#F87171',
                  fontWeight:'800', fontSize:13 }}>{scoreGrade}</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection:'row', padding:16, gap:8 }}>
              {[
                { label:'SAVINGS', value:`₦${totalSaved >= 1000 ? `${(totalSaved/1000).toFixed(0)}K` : totalSaved}` },
                { label:'SPENT', value:`₦${totalSpend >= 1000 ? `${(totalSpend/1000).toFixed(0)}K` : totalSpend}` },
                { label:'STREAK', value:`${streak.count}🔥` },
              ].map((s,i) => (
                <View key={i} style={{ flex:1, backgroundColor:'#ffffff08', borderRadius:12, padding:10, alignItems:'center' }}>
                  <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:8, fontWeight:'700', letterSpacing:1.5 }}>{s.label}</Text>
                  <Text style={{ color:'#fff', fontWeight:'800', fontSize:14, marginTop:3 }}>{s.value}</Text>
                </View>
              ))}
            </View>

            {/* XP badge */}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingBottom:16 }}>
              <Text style={{ fontSize:16 }}>{xpState.current.emoji}</Text>
              <Text style={{ color:'#818CF8', fontWeight:'700', fontSize:13 }}>{xpState.current.title} · {xpState.totalXP} XP</Text>
            </View>

            {/* Footer */}
            <View style={{ backgroundColor:'#6366F1', padding:12, alignItems:'center' }}>
              <Text style={{ color:'#fff', fontWeight:'800', fontSize:12, letterSpacing:0.5 }}>
                Track yours → FinSight App 🚀
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection:'row', gap:12, marginTop:20, width:320 }}>
            <TouchableOpacity onPress={() => setShowShareCard(false)}
              style={{ flex:1, backgroundColor:'rgba(255,255,255,0.1)', borderRadius:14, padding:14, alignItems:'center' }}>
              <Text style={{ color:'#fff', fontWeight:'700' }}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} disabled={sharing}
              style={{ flex:2, backgroundColor:'#6366F1', borderRadius:14, padding:14, alignItems:'center' }}>
              <Text style={{ color:'#fff', fontWeight:'900', fontSize:15 }}>
                {sharing ? 'Preparing…' : '📤 Share Card'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:12, textAlign:'center' }}>
            Share to WhatsApp, Instagram, Twitter & more
          </Text>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const SHADOW = {
  sm:  { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,  elevation: 2 },
  md:  { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 10, elevation: 4 },
  lg:  { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 8 },
};

const styles = (T) => StyleSheet.create({
  safe: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
  },
  headerEye: { fontSize: 10, letterSpacing: 2.5, color: T.mute, fontWeight: '700', marginBottom: 3 },
  headerName: { fontSize: 27, fontWeight: '800', color: T.ink, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  themeBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: T.ink,
    borderWidth: 2, borderColor: T.lime + '55',
  },

  // ── Achievement popup ────────────────────────────────────────────────────────
  achievePopup: {
    position: 'absolute', top: 60, left: 16, right: 16,
    borderRadius: 18, padding: 16, flexDirection: 'row',
    alignItems: 'center', gap: 12, zIndex: 999,
    ...SHADOW.lg,
  },
  achieveTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  achieveSub: { fontSize: 11, marginTop: 2 },

  // ── Streak ───────────────────────────────────────────────────────────────────
  streakBanner: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 18,
    padding: 14, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1,
  },
  streakCount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  streakLabel: { fontSize: 11, marginTop: 2 },
  streakDots: { flexDirection: 'row', gap: 5 },
  streakDot: { width: 8, height: 8, borderRadius: 4 },

  // ── Achievements ─────────────────────────────────────────────────────────────
  achBadge: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1, minWidth: 82, gap: 5,
  },
  achLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },

  // ── Hero balance card ────────────────────────────────────────────────────────
  heroCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 24, padding: 24,
    ...SHADOW.md,
    // Accent top bar
    borderTopWidth: 3, borderTopColor: T.lime,
  },
  heroLabel: { fontSize: 10, letterSpacing: 2.5, fontWeight: '700', marginBottom: 10 },
  heroBalance: { fontSize: 44, fontWeight: '800', letterSpacing: -1.5, lineHeight: 48 },
  heroGrade: { fontSize: 13, fontWeight: '600', marginTop: 8, letterSpacing: 0.2 },
  heroDivider: { borderTopWidth: 1, marginVertical: 18 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around' },
  heroStatPill: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, backgroundColor: T.surface2,
    minWidth: 80,
  },
  heroStatLabel: { fontSize: 9, letterSpacing: 2, fontWeight: '700', marginBottom: 5 },
  heroStatVal: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },

  // ── Broke Clock ──────────────────────────────────────────────────────────────
  brokeCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 24, padding: 22,
    flexDirection: 'row', alignItems: 'center',
    ...SHADOW.md,
  },
  brokeLabel: { fontSize: 9, letterSpacing: 2.5, fontWeight: '700', marginBottom: 6 },
  brokeNum: { fontSize: 68, fontWeight: '900', lineHeight: 70, letterSpacing: -2 },
  brokeSub: { fontSize: 11, marginTop: 4, letterSpacing: 0.3 },
  brokeScenario: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, minWidth: 84, alignItems: 'center',
  },
  brokeScenLabel: { fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginBottom: 3 },
  brokeScenVal: { fontSize: 16, fontWeight: '800' },

  // ── Generic card ─────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 20,
    ...SHADOW.sm,
    borderWidth: 1, borderColor: T.line,
  },
  cardLabel: { fontSize: 9, letterSpacing: 2.5, fontWeight: '700', marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  // ── FinScore ─────────────────────────────────────────────────────────────────
  scoreNum: { fontSize: 42, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44 },
  scoreDenom: { fontSize: 16, fontWeight: '400' },
  scoreGrade: { fontSize: 11, marginTop: 3, letterSpacing: 0.2 },

  // ── Progress bars ─────────────────────────────────────────────────────────────
  barLabel: { fontSize: 13, fontWeight: '500' },
  barTrack: { height: 6, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  // ── Transaction rows ──────────────────────────────────────────────────────────
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  txIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  txName: { fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  txAmt: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  sourceBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    borderWidth: 1,
  },
  sourceText: { fontSize: 10, fontWeight: '600' },

  // ── Investment cards ─────────────────────────────────────────────────────────
  invCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  invName: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8, letterSpacing: -0.2 },
  invLabel: { fontSize: 9, letterSpacing: 2, fontWeight: '700', marginBottom: 4 },
  invVal: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  riskText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
