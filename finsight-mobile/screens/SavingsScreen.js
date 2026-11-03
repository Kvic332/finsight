import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { space } from '../constants/tokens';
import {
  Badge, Button, Card, ConfirmSheet, EmptyState, Gradient, Icon, IconTile, Input, Money, ProgressBar, Sheet,
  Text, useTheme, useToast,
} from '../components/ui';
import { computeStats, savingsFlows } from '../services/finance';
import { formatMoney, parseAmount } from '../services/format';
import { addToGoal, goalProgress, normalizeGoals } from '../services/plans';
import { addTransaction, loadTransactions } from '../services/transactions';
import { awardXP } from '../services/xpService';
import { trackEvent } from '../services/cloudSync';
import { TransactionRow } from './HomeScreen';

const TARGET_RATE = 20;

function SnapshotRow({ label, value, of, tone }) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label" family="medium" color="inkMuted">{label}</Text>
        <Money value={value} variant="label" family="bold" />
      </View>
      <ProgressBar value={of > 0 ? value / of : 0} tone={tone} label={`${label}: ${formatMoney(value)}`} />
    </View>
  );
}

export default function SavingsScreen({ user, setUser }) {
  const { c } = useTheme();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalErrors, setGoalErrors] = useState({});
  const [deleting, setDeleting] = useState(null);

  const goals = normalizeGoals(user?.goals);

  async function load() {
    setTransactions(await loadTransactions());
  }

  useFocusEffect(useCallback(() => {
    load().catch(() => {});
    trackEvent('savings_interactions').catch(() => {});
  }, []));

  async function saveGoals(next) {
    const updated = { ...user, goals: next };
    await AsyncStorage.setItem('finsight_user', JSON.stringify(updated));
    setUser?.(updated);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  async function saveContribution() {
    const value = parseAmount(amount);
    if (!value) { setAmountError('Enter an amount, like 5,000'); return; }
    // Recorded as a transaction too, so it comes out of what's left until payday.
    await addTransaction({ desc: `Saved to ${adding.name}`, amount: value, type: 'debit', cat: 'Savings' });
    const updated = addToGoal(goals, adding.id, value);
    await saveGoals(updated);
    awardXP('tx_log');
    const reached = goalProgress(updated.find(g => g.id === adding.id)).done && !goalProgress(adding).done;
    if (reached) awardXP('goal_complete');
    toast.show(reached ? `Goal reached: ${adding.name}` : `${formatMoney(value)} added to ${adding.name}`, { tone: 'success' });
    setAdding(null);
    await load();
  }

  async function createGoal() {
    const target = parseAmount(goalTarget);
    const errors = {
      ...(goalName.trim() ? null : { name: 'Name your goal' }),
      ...(target ? null : { target: 'Enter a target, like 500,000' }),
    };
    setGoalErrors(errors);
    if (Object.keys(errors).length) return;
    await saveGoals([...goals, { id: Date.now().toString(), name: goalName.trim(), target, saved: 0 }]);
    setShowNew(false);
    toast.show('Goal added', { tone: 'success' });
  }

  async function removeGoal() {
    await saveGoals(goals.filter(g => g.id !== deleting.id));
    setDeleting(null);
    toast.show('Goal deleted');
  }

  const totalSaved = savingsFlows(transactions).saved;
  const { income, savingsRate, totalSpend, totalSaved: savedThisMonth } = computeStats(user, transactions);
  const recent = transactions.filter(t => t.cat === 'Savings').slice(0, 4);
  const toTarget = Math.max(0, Math.round(income * (TARGET_RATE / 100)) - savedThisMonth);

  let insight = `You're saving ${savingsRate}% of your income. Moving ${formatMoney(toTarget)} more this month would reach ${TARGET_RATE}%.`;
  if (savingsRate >= TARGET_RATE) insight = `You're saving ${savingsRate}% of your income, above the ${TARGET_RATE}% many people aim for.`;
  else if (income === 0) insight = 'Add your monthly income in Settings to see your savings rate.';

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.md + 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
      >
        <Card style={{ padding: space.xl }}>
          <Text variant="label" family="medium" color="inkMuted">Total saved</Text>
          <Money value={totalSaved} variant="display" family="bold" adjustsFontSizeToFit style={{ fontSize: 36, lineHeight: 46, letterSpacing: -0.8 }} />
          <Text variant="label" family="medium" color="inkMuted" style={{ marginBottom: space.lg }}>
            {savingsRate}% of this month's income · aiming for {TARGET_RATE}%
          </Text>
          <View style={{ gap: space.md }}>
            <SnapshotRow label="Income this month" value={income} of={income} tone="positive" />
            <SnapshotRow label="Spent" value={totalSpend} of={income} tone="negative" />
            <SnapshotRow label="Saved" value={savedThisMonth} of={income} tone="accent" />
          </View>
        </Card>

        <Gradient name="plum" style={{ borderRadius: 22, padding: space.lg + 2, flexDirection: 'row', gap: space.md }}>
          <Icon name="sparkles" size={20} color="#FFD9E8" />
          <Text variant="label" color="#FFFFFF" style={{ flex: 1, lineHeight: 20 }}>{insight}</Text>
        </Gradient>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs }}>
          <Text variant="heading" family="bold" accessibilityRole="header">Your goals</Text>
          {goals.length ? (
            <Pressable onPress={() => { setGoalName(''); setGoalTarget(''); setGoalErrors({}); setShowNew(true); }} accessibilityRole="button" hitSlop={10}>
              <Text variant="label" family="semibold" color="accent">Add goal</Text>
            </Pressable>
          ) : null}
        </View>

        {goals.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="Set a savings goal"
            body="Name something you're saving for and track your progress towards it."
            action={<Button title="Add goal" onPress={() => { setGoalName(''); setGoalTarget(''); setGoalErrors({}); setShowNew(true); }} />}
          />
        ) : goals.map(goal => {
          const { used, percent, toGo, done } = goalProgress(goal);
          return (
            <Card key={goal.id} style={{ padding: space.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md }}>
                <IconTile name={done ? 'trophy-outline' : 'flag-outline'} tone={done ? 'positive' : 'accent'} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" family="bold" numberOfLines={1}>{goal.name}</Text>
                  <Text variant="label" family="regular" color="inkMuted" tabular numberOfLines={1}>
                    {formatMoney(goal.saved)} of {formatMoney(goal.target)}
                  </Text>
                </View>
                {done ? <Badge label="Reached" tone="positive" /> : <Text variant="bodyStrong" family="bold" color="accent" tabular>{percent}%</Text>}
              </View>
              <ProgressBar value={used} tone={done ? 'positive' : 'accent'} height={8} label={`${percent}% of ${goal.name}`} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
                <Text variant="label" color="inkMuted" tabular style={{ flex: 1 }}>{done ? 'Well done' : `${formatMoney(toGo)} to go`}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
                  <Pressable onPress={() => setDeleting(goal)} accessibilityRole="button" accessibilityLabel={`Delete ${goal.name}`} hitSlop={10}>
                    <Icon name="trash-outline" size={18} color="inkMuted" />
                  </Pressable>
                  <Pressable
                    onPress={() => { setAmount(''); setAmountError(''); setAdding(goal); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Add money to ${goal.name}`}
                    hitSlop={10}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
                  >
                    <Icon name="add-circle" size={18} color="accent" />
                    <Text variant="label" family="semibold" color="accent">Add money</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          );
        })}

        {recent.length ? (
          <View style={{ marginTop: space.xs }}>
            <Text variant="heading" family="bold" accessibilityRole="header">Recent savings</Text>
            {recent.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
          </View>
        ) : null}
      </ScrollView>

      <Sheet
        visible={!!adding}
        onClose={() => setAdding(null)}
        title={adding ? `Add money to ${adding.name}` : ''}
        footer={<Button full title="Add money" onPress={saveContribution} />}
      >
        <View style={{ gap: space.md }}>
          <Text color="inkMuted">Record money you've moved to savings. It comes out of what's left until payday.</Text>
          <Input label="Amount" prefix="₦" keyboardType="numeric" placeholder="5,000" autoFocus value={amount} error={amountError} onChangeText={v => { setAmount(v); setAmountError(''); }} />
        </View>
      </Sheet>

      <Sheet
        visible={showNew}
        onClose={() => setShowNew(false)}
        title="Add a savings goal"
        footer={<Button full title="Save goal" onPress={createGoal} />}
      >
        <View style={{ gap: space.md }}>
          <Input label="Goal name" placeholder="New laptop" value={goalName} error={goalErrors.name} onChangeText={setGoalName} />
          <Input label="Target amount" prefix="₦" keyboardType="numeric" placeholder="500,000" value={goalTarget} error={goalErrors.target} onChangeText={setGoalTarget} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={!!deleting}
        destructive
        title={deleting ? `Delete ${deleting.name}?` : ''}
        body="Your transactions stay. Only this goal is removed."
        confirmLabel="Delete goal"
        onConfirm={removeGoal}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
