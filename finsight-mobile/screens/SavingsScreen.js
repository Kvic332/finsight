import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT } from '../constants/theme';
import { trackEvent } from '../services/cloudSync';

const GOAL_COLORS = ['#818CF8', '#6366F1', '#FBBF24', '#F87171', '#34D399'];
const GOAL_ICONS = ['🛡️', '💻', '✈️', '🏠', '🎯', '🚗', '💍', '🎓'];
const GOAL_TARGETS = {
  'Emergency Fund': 500000,
  'New Laptop': 350000,
  'Travel': 200000,
  'House': 5000000,
  'Car': 2000000,
  'Business': 1000000,
  'Wedding': 1500000,
  'Education': 800000,
};

export default function SavingsScreen({ theme, user }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const s = styles(T);

  async function load() {
    const raw = await AsyncStorage.getItem('finsight_transactions');
    if (raw) setTransactions(JSON.parse(raw));
  }

  useEffect(() => { load(); trackEvent('savings_interactions').catch(() => {}); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // ── Compute savings properly ───────────────────────────────────────────────
  const income = user?.income || 0;

  // Explicit savings transactions (cat = Savings)
  const explicitSavings = transactions
    .filter(t => t.cat === 'Savings' && t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  // Total income from transactions
  const totalIncome = transactions
    .filter(t => t.cat === 'Income' && t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  // Total spend
  const totalSpend = transactions
    .filter(t => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0);

  // Effective income — use transaction income if available, else profile income
  const effectiveIncome = totalIncome > 0 ? totalIncome : income;

  // Total saved — explicit savings first, otherwise net leftover
  const netLeftover = Math.max(0, effectiveIncome - totalSpend);
  const totalSaved = explicitSavings > 0 ? explicitSavings : netLeftover;

  // Savings rate
  const savingsRate = effectiveIncome > 0
    ? Math.round((totalSaved / effectiveIncome) * 100)
    : 0;

  // Monthly savings (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const monthlySaved = transactions
    .filter(t => t.cat === 'Savings' && t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  // Build goals from user profile.
  // user.goals is an array of objects { id, name, target, saved } (set in SettingsScreen).
  // Guard against the old string-array format for backwards compatibility.
  const rawGoals = user?.goals || [];
  const perGoalSaved = rawGoals.length > 0
    ? Math.floor(totalSaved / rawGoals.length)
    : 0;

  const goals = rawGoals.map((item, i) => {
    const isObj = item && typeof item === 'object';
    const name   = isObj ? (item.name || 'Goal') : String(item);
    const target = isObj
      ? (item.target || GOAL_TARGETS[item.name] || 500000)
      : (GOAL_TARGETS[item] || 500000);
    return {
      name,
      saved: perGoalSaved,
      target,
      icon:  GOAL_ICONS[i % GOAL_ICONS.length],
      color: GOAL_COLORS[i % GOAL_COLORS.length],
    };
  });

  // Savings transactions list
  const savingsTxs = transactions
    .filter(t => t.cat === 'Savings' || (t.type === 'credit' && t.cat === 'Income'))
    .slice(0, 5);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.lime} />}
      >
        <Text style={[s.eyebrow, { color: T.mute }]}>GOALS & PROGRESS</Text>
        <Text style={[s.title, { color: T.ink }]}>Savings</Text>

        {/* Stats Row */}
        <View style={s.statsRow}>
          {[
            { label: 'TOTAL SAVED', value: `₦${totalSaved >= 1000 ? (totalSaved/1000).toFixed(0)+'K' : totalSaved.toLocaleString()}`, color: T.limeDeep },
            { label: 'SAVINGS RATE', value: `${savingsRate}%`, color: savingsRate >= 20 ? T.limeDeep : savingsRate >= 10 ? T.amber : T.rose },
            { label: 'ACTIVE GOALS', value: `${goals.length}`, color: T.indigo },
          ].map((stat, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: T.surface }]}>
              <Text style={[s.statLabel, { color: T.mute }]}>{stat.label}</Text>
              <Text style={[s.statVal, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Target vs Actual */}
        <View style={[s.summaryCard, { backgroundColor: T.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={[s.cardTitle, { color: T.ink }]}>Monthly snapshot</Text>
            <Text style={[s.cardSub, { color: T.mute }]}>Target: 20%</Text>
          </View>
          <View style={{ gap: 12 }}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={[s.barLabel, { color: T.ink2 }]}>Income</Text>
                <Text style={[s.barLabel, { color: T.limeDeep, fontWeight: '700' }]}>₦{effectiveIncome.toLocaleString()}</Text>
              </View>
              <View style={[s.barTrack, { backgroundColor: T.line }]}>
                <View style={[s.barFill, { width: '100%', backgroundColor: T.limeDeep }]} />
              </View>
            </View>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={[s.barLabel, { color: T.ink2 }]}>Spent</Text>
                <Text style={[s.barLabel, { color: T.rose, fontWeight: '700' }]}>₦{totalSpend.toLocaleString()}</Text>
              </View>
              <View style={[s.barTrack, { backgroundColor: T.line }]}>
                <View style={[s.barFill, {
                  width: effectiveIncome > 0 ? `${Math.min(100, (totalSpend/effectiveIncome)*100)}%` : '0%',
                  backgroundColor: T.rose,
                }]} />
              </View>
            </View>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={[s.barLabel, { color: T.ink2 }]}>Saved</Text>
                <Text style={[s.barLabel, { color: T.limeDeep, fontWeight: '700' }]}>₦{totalSaved.toLocaleString()}</Text>
              </View>
              <View style={[s.barTrack, { backgroundColor: T.line }]}>
                <View style={[s.barFill, {
                  width: effectiveIncome > 0 ? `${Math.min(100, (totalSaved/effectiveIncome)*100)}%` : '0%',
                  backgroundColor: T.limeDeep,
                }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Goals */}
        {goals.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: T.surface }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🎯</Text>
            <Text style={[s.emptyText, { color: T.mute }]}>
              No savings goals yet.{'\n'}Go to Settings → Financial Profile to add goals.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={[s.sectionTitle, { color: T.ink }]}>Your Goals</Text>
            {goals.map((g, i) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
              return (
                <View key={i} style={[s.goalCard, { backgroundColor: T.surface }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[s.goalIconWrap, { backgroundColor: g.color + '22' }]}>
                        <Text style={{ fontSize: 20 }}>{g.icon}</Text>
                      </View>
                      <View>
                        <Text style={[s.goalName, { color: T.ink }]}>{g.name}</Text>
                        <Text style={[s.goalTarget, { color: T.mute }]}>Target ₦{g.target.toLocaleString()}</Text>
                      </View>
                    </View>
                    <View style={[s.pctBadge, { backgroundColor: g.color + '22' }]}>
                      <Text style={[s.pctText, { color: g.color }]}>{pct}%</Text>
                    </View>
                  </View>
                  <View style={[s.barTrack, { backgroundColor: T.line, height: 8 }]}>
                    <View style={[s.barFill, { width: `${pct}%`, backgroundColor: g.color, height: 8, borderRadius: 4 }]} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={[s.goalSub, { color: T.mute }]}>₦{g.saved.toLocaleString()} saved</Text>
                    <Text style={[s.goalSub, { color: T.mute }]}>₦{(g.target - g.saved).toLocaleString()} to go</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent savings transactions */}
        {savingsTxs.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[s.sectionTitle, { color: T.ink, marginBottom: 12 }]}>Recent Credits</Text>
            <View style={[s.txList, { backgroundColor: T.surface }]}>
              {savingsTxs.map((tx, i) => (
                <View key={tx.id || i} style={[s.txRow, { borderBottomColor: T.line, borderBottomWidth: i < savingsTxs.length - 1 ? 1 : 0 }]}>
                  <View style={[s.txDot, { backgroundColor: T.limeDeep + '22' }]}>
                    <Text style={{ fontSize: 16 }}>💰</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.txName, { color: T.ink }]} numberOfLines={1}>{tx.desc}</Text>
                    <Text style={[s.txDate, { color: T.mute }]}>{tx.date}</Text>
                  </View>
                  <Text style={[s.txAmt, { color: T.limeDeep }]}>+₦{tx.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ARIA Insight */}
        <View style={[s.ariaCard, { backgroundColor: '#13131F', borderWidth: 1, borderColor: '#6366F1' }]}>
          <Text style={[s.ariaLabel, { color: 'rgba(255,255,255,0.45)' }]}>ARIA INSIGHT</Text>
          <Text style={[s.ariaText, { color: '#E0E0FF' }]}>
            {savingsRate >= 20
              ? `Excellent! You're saving ${savingsRate}% of income — above the recommended 20%. Keep it up, ${user?.name?.split(' ')[0] || 'there'}.`
              : savingsRate >= 10
              ? `You're saving ${savingsRate}% — halfway to the 20% target. Try saving ₦${Math.round(effectiveIncome * 0.2).toLocaleString()} per month to hit the goal.`
              : `You're saving ${savingsRate}% of income. To reach 20%, automate a ₦${Math.round(effectiveIncome * 0.2).toLocaleString()} transfer on salary day ${user?.salaryDay || '25'} before spending.`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 20 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  statLabel: { fontSize: 9, letterSpacing: 1.5, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  statVal: { fontSize: 20, fontWeight: '800' },

  summaryCard: { borderRadius: 18, padding: 18, marginBottom: 20 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12 },

  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },

  barLabel: { fontSize: 13, fontWeight: '500' },
  barTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  emptyCard: { borderRadius: 20, padding: 40, alignItems: 'center', marginTop: 8 },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 22 },

  goalCard: { borderRadius: 18, padding: 18 },
  goalIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  goalName: { fontSize: 15, fontWeight: '700' },
  goalTarget: { fontSize: 11, marginTop: 2 },
  pctBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  pctText: { fontSize: 13, fontWeight: '800' },
  goalSub: { fontSize: 12 },

  txList: { borderRadius: 18, paddingHorizontal: 16 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  txDot: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  txName: { fontSize: 13, fontWeight: '500' },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '700' },

  ariaCard: { borderRadius: 18, padding: 20, marginTop: 16 },
  ariaLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 10 },
  ariaText: { fontSize: 14, lineHeight: 22 },
});
