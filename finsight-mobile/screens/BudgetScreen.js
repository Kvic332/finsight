import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '../services/dataStore';
import * as Notifications from 'expo-notifications';
import { space } from '../constants/tokens';
import {
  Badge, Button, Card, CategoryTile, Chip, ConfirmSheet, EmptyState, Input, Money, ProgressBar, Sheet,
  Text, useToast,
} from '../components/ui';
import { formatMoney, parseAmount } from '../services/format';
import { budgetSpent, budgetStatus } from '../services/plans';
import { payCycle, paydaysOf, periodLabel } from '../services/finance';

const CATEGORIES = ['Food', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Savings', 'Other'];
const PRESETS = [
  ['Food', 'Food'], ['Transport', 'Transport'], ['Utilities', 'Utilities'], ['Data and airtime', 'Utilities'],
  ['Netflix', 'Entertainment'], ['Spotify', 'Entertainment'], ['DSTV', 'Entertainment'], ['Shopping', 'Shopping'],
  ['Health', 'Health'], ['Rent', 'Other'], ['Travel', 'Other'], ['Education', 'Other'],
];
const STORAGE_KEY = 'finsight_budgets';
const EMPTY_FORM = { name: '', cat: 'Food', limit: '', keywords: '', oneOff: false };

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function BudgetRow({ budget, spent, onPress }) {
  const { percent, left, used, tone } = budgetStatus(spent, budget.limit);
  const over = left < 0;
  return (
    <Card onPress={onPress} accessibilityLabel={`${budget.name}, ${percent}% used. Edit budget`} style={{ padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md }}>
        <CategoryTile category={budget.cat} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" family="bold" numberOfLines={1}>{budget.name}</Text>
          <Text variant="label" family="regular" color={over ? 'negative' : tone === 'warning' ? 'warning' : 'inkMuted'} numberOfLines={1}>
            {`${budget.oneOff ? 'One-off · ' : ''}${over ? `${formatMoney(-left)} over` : left === 0 ? 'Limit reached' : `${formatMoney(left)} left`}`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Money value={spent} family="bold" />
          <Text variant="caption" color="inkMuted" tabular>of {formatMoney(budget.limit)}</Text>
        </View>
      </View>
      <ProgressBar value={used} tone={tone} height={8} label={`${percent}% of ${budget.name} budget used`} />
    </Card>
  );
}

export default function BudgetScreen({ user }) {
  const toast = useToast();
  // Budgets count the same pay period as Home and Activity.
  const cycle = payCycle(paydaysOf(user));
  const spentOn = (b, txs) => budgetSpent(b, txs, undefined, cycle);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showForm) { setShowForm(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [showForm]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    try {
      const [bRaw, tRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem('finsight_transactions'),
      ]);
      const loadedBudgets = bRaw ? JSON.parse(bRaw) : [];
      let loadedTxs = tRaw ? JSON.parse(tRaw) : [];

      // Old versions could record their own budget alerts as transactions.
      const alertPhrases = ['budget exceeded', 'budget warning', 'budget alert'];
      const cleaned = loadedTxs.filter(tx => !alertPhrases.some(p => (tx.desc || '').toLowerCase().includes(p)));
      if (cleaned.length !== loadedTxs.length) {
        loadedTxs = cleaned;
        await AsyncStorage.setItem('finsight_transactions', JSON.stringify(cleaned));
        const allKeys = await AsyncStorage.getAllKeys();
        const alertKeys = allKeys.filter(k => k.startsWith('finsight_budget_alerted_'));
        if (alertKeys.length) await AsyncStorage.multiRemove(alertKeys);
      }

      setBudgets(loadedBudgets);
      setTransactions(loadedTxs);
      if (loadedBudgets.length) checkBudgetAlerts(loadedBudgets, loadedTxs);
    } catch (e) {
      toast.show("Couldn't load your budgets. Pull down to try again.", { tone: 'error' });
    }
  }

  async function saveBudgets(updated) {
    setBudgets(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function checkBudgetAlerts(list, txs) {
    for (const b of list) {
      try {
        const spent = spentOn(b, txs);
        const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        // A one-off budget warns once, not again every month.
        const periodKey = cycle.start.toISOString().slice(0, 10);
        const alertKey = b.oneOff ? `finsight_budget_alerted_${b.id}` : `finsight_budget_alerted_${b.id}_${periodKey}`;
        const alerted = await AsyncStorage.getItem(alertKey);
        if (pct >= 100 && alerted !== 'exceeded') {
          await AsyncStorage.setItem(alertKey, 'exceeded');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: pct > 100 ? `Budget exceeded: ${b.name}` : `Budget reached: ${b.name}`,
              body: pct > 100
                ? `You've spent ₦${spent.toLocaleString()}, over your ₦${b.limit.toLocaleString()} budget.`
                : `You've spent your full ₦${b.limit.toLocaleString()} budget.`,
              sound: true,
            },
            trigger: null,
          });
        } else if (pct >= 80 && pct < 100 && !alerted) {
          await AsyncStorage.setItem(alertKey, 'warned');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Budget warning: ${b.name}`,
              body: `You've used ${Math.round(pct)}% of your ₦${b.limit.toLocaleString()} budget.`,
              sound: true,
            },
            trigger: null,
          });
        }
      } catch (e) { /* a failed alert must not stop the screen loading */ }
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(b) {
    setEditingId(b.id);
    setForm({ name: b.name, cat: b.cat, limit: String(b.limit), keywords: (b.keywords || []).join(', '), oneOff: !!b.oneOff });
    setErrors({});
    setShowForm(true);
  }

  async function save() {
    const limit = parseAmount(form.limit);
    const nextErrors = {
      ...(form.name.trim() ? null : { name: 'Give this budget a name' }),
      ...(limit ? null : { limit: form.oneOff ? 'Enter the total, like 590,000' : 'Enter a monthly limit, like 50,000' }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
    const fields = { name: form.name.trim(), cat: form.cat, limit, keywords, oneOff: form.oneOff };
    // A budget switched to one-off starts counting this month, not from when it was
    // first made as a monthly budget, which could sweep in old purchases.
    const startFor = b => (form.oneOff && (!b.oneOff || !b.startDate) ? { startDate: `${monthKey()}-01` } : null);
    const updated = editingId
      ? budgets.map(b => (b.id === editingId ? { ...b, ...fields, ...startFor(b) } : b))
      // A new one-off budget counts from today, so earlier spending isn't swept in.
      : [...budgets, { id: `${Date.now()}`, ...fields, createdMonth: monthKey(), ...(form.oneOff ? { startDate: todayKey() } : null) }];
    await saveBudgets(updated);
    await checkBudgetAlerts(updated, transactions);
    setShowForm(false);
    toast.show(editingId ? 'Budget updated' : 'Budget added', { tone: 'success' });
  }

  async function remove() {
    await saveBudgets(budgets.filter(b => b.id !== editingId));
    setConfirmDelete(false);
    setShowForm(false);
    toast.show('Budget deleted');
  }

  // The monthly total leaves out one-off budgets, which don't reset each month.
  const monthly = budgets.filter(b => !b.oneOff);
  const totalLimit = monthly.reduce((s, b) => s + b.limit, 0);
  const totalSpent = monthly.reduce((s, b) => s + spentOn(b, transactions), 0);
  const total = budgetStatus(totalSpent, totalLimit);
  const when = cycle.hasPayday ? periodLabel(cycle) : `in ${new Date().toLocaleDateString('en-NG', { month: 'long' })}`;

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.md + 2 }}>
        {budgets.length === 0 ? (
          <EmptyState
            icon="pie-chart-outline"
            title="Set your first budget"
            body="Choose a monthly limit for food, transport, data or anything else, and FinSight will warn you before you go over."
            action={<Button title="Add budget" onPress={openAdd} />}
          />
        ) : (
          <>
            {monthly.length ? <Card style={{ padding: space.xl }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="label" family="medium" color="inkMuted">Budgeted spending {when}</Text>
                {total.tone !== 'accent' ? <Badge label={total.tone === 'negative' ? 'Over budget' : 'Nearly used'} tone={total.tone} /> : null}
              </View>
              <Money value={totalSpent} variant="display" family="bold" adjustsFontSizeToFit style={{ fontSize: 36, lineHeight: 46, letterSpacing: -0.8 }} />
              <Text variant="label" family="medium" color="inkMuted" style={{ marginBottom: space.md }}>
                of {formatMoney(totalLimit)} · {total.left >= 0 ? `${formatMoney(total.left)} left` : `${formatMoney(-total.left)} over`}
              </Text>
              <ProgressBar value={total.used} tone={total.tone} height={8} label={`${total.percent}% of all budgets used`} />
            </Card> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs }}>
              <Text variant="heading" family="bold" accessibilityRole="header">Your budgets</Text>
              <Pressable onPress={openAdd} accessibilityRole="button" hitSlop={10}>
                <Text variant="label" family="semibold" color="accent">Add budget</Text>
              </Pressable>
            </View>
            {budgets.map(b => (
              <BudgetRow key={b.id} budget={b} spent={spentOn(b, transactions)} onPress={() => openEdit(b)} />
            ))}
          </>
        )}
      </ScrollView>

      <Sheet
        visible={showForm && !confirmDelete}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Edit budget' : 'Add a budget'}
        footer={(
          <>
            <Button full title={editingId ? 'Save changes' : 'Save budget'} onPress={save} />
            {editingId ? <Button full title="Delete budget" variant="ghost" onPress={() => setConfirmDelete(true)} /> : null}
          </>
        )}
      >
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ gap: space.md }}>
            {!editingId ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm }}>
                {PRESETS.map(([name, cat]) => (
                  <Chip key={name} label={name} selected={form.name === name} onPress={() => setForm(f => ({ ...f, name, cat }))} />
                ))}
              </ScrollView>
            ) : null}
            <Input label="Name" placeholder="Groceries" value={form.name} error={errors.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
            <View style={{ gap: space.xs }}>
              <Text variant="label">How often?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                <Chip label="Every month" selected={!form.oneOff} onPress={() => setForm(f => ({ ...f, oneOff: false }))} />
                <Chip label="One-off" selected={form.oneOff} onPress={() => setForm(f => ({ ...f, oneOff: true }))} />
              </View>
              {form.oneOff ? (
                <Text variant="caption" color="inkMuted">For a single purchase, like a laptop or rent. It doesn't reset each month, and counts transactions that mention its name or the words below.</Text>
              ) : null}
            </View>
            <Input
              label={form.oneOff ? 'Total to spend' : 'Monthly limit'}
              prefix="₦"
              placeholder={form.oneOff ? '590,000' : '50,000'}
              keyboardType="numeric"
              value={form.limit}
              error={errors.limit}
              onChangeText={v => setForm(f => ({ ...f, limit: v }))}
            />
            <View style={{ gap: space.xs }}>
              <Text variant="label">Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {CATEGORIES.map(cat => <Chip key={cat} label={cat} selected={form.cat === cat} onPress={() => setForm(f => ({ ...f, cat }))} />)}
              </View>
            </View>
            <Input
              label="Also count these words (optional)"
              placeholder="netflix, showmax"
              hint="Transactions containing these words count towards this budget"
              autoCapitalize="none"
              value={form.keywords}
              onChangeText={v => setForm(f => ({ ...f, keywords: v }))}
            />
          </View>
        </ScrollView>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        destructive
        title="Delete this budget?"
        body="Your transactions stay. Only this limit is removed."
        confirmLabel="Delete budget"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
