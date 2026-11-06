import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '../services/dataStore';
import { space } from '../constants/tokens';
import {
  Badge, Button, Card, Chip, ConfirmSheet, EmptyState, Gradient, Icon, IconTile, Input, Money, ProgressBar, Sheet,
  Text, useTheme, useToast,
} from '../components/ui';
import { computeStats, savingsFlows } from '../services/finance';
import { formatMoney, parseAmount } from '../services/format';
import { addToGoal, goalProgress, normalizeGoals, unassignedSavings, updateGoal } from '../services/plans';
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
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignGoalId, setAssignGoalId] = useState(null);
  const [assignAmount, setAssignAmount] = useState('');
  const [assignError, setAssignError] = useState('');

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

  function openNewGoal() {
    setEditing(null);
    setGoalName('');
    setGoalTarget('');
    setGoalErrors({});
    setShowNew(true);
  }

  function openEditGoal(goal) {
    setEditing(goal);
    setGoalName(goal.name);
    setGoalTarget(String(goal.target));
    setGoalErrors({});
    setShowNew(true);
  }

  async function createGoal() {
    const target = parseAmount(goalTarget);
    const errors = {
      ...(goalName.trim() ? null : { name: 'Name your goal' }),
      ...(target ? null : { target: 'Enter a target, like 500,000' }),
    };
    setGoalErrors(errors);
    if (Object.keys(errors).length) return;
    const fields = { name: goalName.trim(), target };
    await saveGoals(editing
      ? updateGoal(goals, editing.id, fields)
      : [...goals, { id: Date.now().toString(), ...fields, saved: 0 }]);
    setShowNew(false);
    toast.show(editing ? 'Goal updated' : 'Goal added', { tone: 'success' });
  }

  function openAssign() {
    const first = goals.find(g => !goalProgress(g).done) || goals[0];
    chooseAssignGoal(first);
    setAssignError('');
    setAssigning(true);
  }

  // Suggests what fits: the unassigned money, but no more than the goal still needs.
  function chooseAssignGoal(goal) {
    setAssignGoalId(goal.id);
    const toGo = goalProgress(goal).toGo;
    setAssignAmount(String(toGo > 0 ? Math.min(unassigned, toGo) : unassigned));
  }

  // Counts money that's already saved towards a goal. No transaction is added,
  // because the saving was already recorded when it happened.
  async function saveAssign() {
    const value = parseAmount(assignAmount);
    if (!value) { setAssignError('Enter an amount, like 50,000'); return; }
    if (value > unassigned) { setAssignError(`You have ${formatMoney(unassigned)} not in a goal`); return; }
    const goal = goals.find(g => g.id === assignGoalId);
    const updated = addToGoal(goals, assignGoalId, value);
    await saveGoals(updated);
    setAssigning(false);
    const reached = goalProgress(updated.find(g => g.id === assignGoalId)).done && !goalProgress(goal).done;
    toast.show(reached ? `Goal reached: ${goal.name}` : `${formatMoney(value)} counted towards ${goal.name}`, { tone: 'success' });
  }

  async function removeGoal() {
    await saveGoals(goals.filter(g => g.id !== deleting.id));
    setDeleting(null);
    setShowNew(false);
    toast.show('Goal deleted');
  }

  const totalSaved = savingsFlows(transactions).saved;
  const { income, savingsRate, totalSpend, totalSaved: savedThisMonth } = computeStats(user, transactions);
  const recent = transactions.filter(t => t.cat === 'Savings').slice(0, 4);
  const toTarget = Math.max(0, Math.round(income * (TARGET_RATE / 100)) - savedThisMonth);
  const unassigned = unassignedSavings(totalSaved, goals);

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

        {unassigned > 0 ? (
          <Card style={{ padding: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconTile name="wallet-outline" tone="accent" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Money value={unassigned} variant="bodyStrong" family="bold" />
                <Text variant="label" family="regular" color="inkMuted">saved but not in a goal yet</Text>
              </View>
            </View>
            <Text variant="label" family="regular" color="inkMuted">
              Savings from bank alerts and statements aren't linked to a goal by themselves. Count them towards one to see your real progress.
            </Text>
            {goals.length
              ? <Button full title="Add to a goal" variant="secondary" onPress={openAssign} />
              : <Button full title="Set a goal for it" variant="secondary" onPress={openNewGoal} />}
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs }}>
          <Text variant="heading" family="bold" accessibilityRole="header">Your goals</Text>
          {goals.length ? (
            <Pressable onPress={openNewGoal} accessibilityRole="button" hitSlop={10}>
              <Text variant="label" family="semibold" color="accent">Add goal</Text>
            </Pressable>
          ) : null}
        </View>

        {goals.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="Set a savings goal"
            body="Name something you're saving for and track your progress towards it."
            action={<Button title="Add goal" onPress={openNewGoal} />}
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
                  <Pressable onPress={() => openEditGoal(goal)} accessibilityRole="button" accessibilityLabel={`Edit ${goal.name}`} hitSlop={10}>
                    <Icon name="create-outline" size={18} color="inkMuted" />
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
        visible={showNew && !deleting}
        onClose={() => setShowNew(false)}
        title={editing ? 'Edit goal' : 'Add a savings goal'}
        footer={(
          <>
            <Button full title={editing ? 'Save changes' : 'Save goal'} onPress={createGoal} />
            {editing ? <Button full title="Delete goal" variant="ghost" onPress={() => setDeleting(editing)} /> : null}
          </>
        )}
      >
        <View style={{ gap: space.md }}>
          <Input label="Goal name" placeholder="New laptop" value={goalName} error={goalErrors.name} onChangeText={setGoalName} />
          <Input label="Target amount" prefix="₦" keyboardType="numeric" placeholder="500,000" value={goalTarget} error={goalErrors.target} onChangeText={setGoalTarget} />
        </View>
      </Sheet>

      <Sheet
        visible={assigning}
        onClose={() => setAssigning(false)}
        title="Count savings towards a goal"
        footer={<Button full title="Add to goal" onPress={saveAssign} />}
      >
        <View style={{ gap: space.md }}>
          <Text color="inkMuted">{`You have ${formatMoney(unassigned)} saved that isn't in a goal. This doesn't move any money.`}</Text>
          {goals.length > 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {goals.map(g => <Chip key={g.id} label={g.name} selected={g.id === assignGoalId} onPress={() => { chooseAssignGoal(g); setAssignError(''); }} />)}
            </View>
          ) : null}
          <Input
            label={`Amount for ${goals.find(g => g.id === assignGoalId)?.name || 'this goal'}`}
            prefix="₦"
            keyboardType="numeric"
            value={assignAmount}
            error={assignError}
            onChangeText={v => { setAssignAmount(v); setAssignError(''); }}
          />
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
