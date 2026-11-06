import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StatusBar, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, CategoryTile, Chip, ConfirmSheet, EmptyState, Gradient, Icon, IconButton, Input, Money, Sheet,
  Text, useTheme, useToast,
} from '../components/ui';
import { computePaydayPlan, parseTxDate } from '../services/finance';
import { formatDayLabel, formatMoney } from '../services/format';
import { deleteTransaction, loadTransactions, updateTransaction } from '../services/transactions';
import AsyncStorage from '../services/dataStore';
import { suspectTransactions } from '../services/transactionReview';
import { TransactionRow } from './HomeScreen';

function Total({ label, amount }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.md, padding: space.md + 2 }}>
      <Text variant="label" color="#FFFFFF">{label}</Text>
      <Money value={amount} variant="heading" family="bold" tone="#FFFFFF" adjustsFontSizeToFit style={{ fontSize: 21, lineHeight: 28 }} />
    </View>
  );
}

export default function ActivityScreen({ navigation, user }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const [linking, setLinking] = useState(false);

  useFocusEffect(useCallback(() => {
    loadTransactions().then(setTransactions).catch(() => {});
    AsyncStorage.getItem('finsight_budgets').then(raw => setBudgets(raw ? JSON.parse(raw) : [])).catch(() => {});
  }, []));

  const linkedBudget = selected?.budgetId ? budgets.find(b => b.id === selected.budgetId) : null;

  async function saveLink(budgetId) {
    try {
      const updated = await updateTransaction(selected.id, { budgetId: budgetId || null });
      setTransactions(updated);
      setSelected(s => ({ ...s, budgetId: budgetId || null }));
      setLinking(false);
      const budget = budgets.find(b => b.id === budgetId);
      toast.show(budget ? `Counted towards ${budget.name}` : 'No longer linked to a budget', { tone: 'success' });
    } catch (e) {
      toast.show("Couldn't save this. Try again.", { tone: 'error' });
    }
  }
  const suspects = useMemo(() => suspectTransactions(transactions).length, [transactions]);

  const plan = computePaydayPlan(user, transactions);

  // Most used categories first, so the filters people need are in reach.
  const categories = useMemo(() => {
    const counts = {};
    transactions.forEach(t => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [transactions]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = transactions.filter(t => {
      if (filter !== 'All' && t.cat !== filter) return false;
      if (!q) return true;
      return [t.desc, t.cat, t.bank, String(t.amount)].some(v => v?.toLowerCase?.().includes(q));
    });
    const days = new Map();
    shown
      .map(t => ({ t, d: parseTxDate(t.date) }))
      .sort((a, b) => (b.d?.getTime() || 0) - (a.d?.getTime() || 0))
      .forEach(({ t, d }) => {
        const title = d ? formatDayLabel(d) : 'Undated';
        if (!days.has(title)) days.set(title, []);
        days.get(title).push(t);
      });
    return [...days].map(([title, data]) => ({ title, data }));
  }, [transactions, filter, query]);

  async function remove() {
    const updated = await deleteTransaction(selected.id);
    setTransactions(updated);
    setConfirmDelete(false);
    setSelected(null);
    toast.show('Transaction deleted');
  }

  function edit() {
    const tx = selected;
    setSelected(null);
    navigation.navigate('Add', { tx });
  }

  const filtered = filter !== 'All' || query.trim();

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Gradient style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: space.xxxl + space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <Text variant="title" family="bold" color="#FFFFFF" accessibilityRole="header">Activity</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <IconButton
              icon={searching ? 'close' : 'search'}
              label={searching ? 'Close search' : 'Search transactions'}
              color="#FFFFFF"
              background="rgba(255,255,255,0.2)"
              onPress={() => { setSearching(s => !s); setQuery(''); }}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.md - 2 }}>
          <Total label="Money in" amount={plan.moneyIn} />
          <Total label="Money out" amount={plan.totalSpend} />
        </View>
        <Text variant="caption" color="#FFFFFF" style={{ marginTop: space.sm, opacity: 0.85 }}>
          {plan.cycle.hasPayday
            ? `Since your last payday on ${plan.cycle.start.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`
            : 'This month so far'}
        </Text>
      </Gradient>

      <View style={{
        flex: 1, marginTop: -space.xl, backgroundColor: c.surface,
        borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
      }}>
        <SectionList
          sections={sections}
          keyExtractor={t => t.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl }}
          ListHeaderComponent={(
            <View style={{ paddingTop: space.xl, gap: space.md }}>
              {searching ? (
                <Input
                  label="Search"
                  placeholder="Name, category or amount"
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  returnKeyType="search"
                />
              ) : null}
              {suspects ? (
                <Pressable
                  onPress={() => navigation.navigate('ReviewTransactions')}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
                    borderRadius: radius.md, borderWidth: 1, borderColor: c.warning,
                    backgroundColor: pressed ? c.sunken : c.surface,
                  })}
                >
                  <Icon name="alert-circle-outline" size={22} color="warning" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="label" family="semibold">{`${suspects === 1 ? '1 imported transaction looks' : `${suspects} imported transactions look`} wrong`}</Text>
                    <Text variant="caption" color="inkMuted">Adverts, failed payments or money saved the wrong way. Check them</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color="inkSubtle" />
                </Pressable>
              ) : null}
              {categories.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -space.xl }}
                  contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }}
                >
                  {['All', ...categories].map(cat => (
                    <Chip key={cat} label={cat} selected={filter === cat} onPress={() => setFilter(cat)} />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <Text variant="label" family="bold" color="inkMuted" style={{ marginTop: space.lg }} accessibilityRole="header">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => <TransactionRow tx={item} showCategory onPress={() => setSelected(item)} />}
          ListEmptyComponent={filtered ? (
            <EmptyState icon="search-outline" title="No matches" body="Try a different word, or clear the filter." />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="Add your first transaction"
              body="Log what you spend, or import your bank alerts, and they'll appear here."
              action={<Button title="Add transaction" variant="secondary" onPress={() => navigation.navigate('Add')} />}
            />
          )}
        />
      </View>

      <Sheet
        visible={!!selected && !confirmDelete && !linking}
        onClose={() => setSelected(null)}
        footer={(
          <>
            <Button full title="Edit transaction" icon="create-outline" onPress={edit} />
            <Button full title="Delete transaction" variant="ghost" onPress={() => setConfirmDelete(true)} />
          </>
        )}
      >
        {selected ? (
          <View style={{ alignItems: 'center', gap: space.xs }}>
            <CategoryTile category={selected.cat} size={56} />
            <Text variant="heading" family="bold" align="center" style={{ marginTop: space.sm }}>{selected.desc}</Text>
            <Money
              value={selected.type === 'credit' ? selected.amount : -selected.amount}
              variant="title"
              family="bold"
              tone="auto"
              showSign={selected.type === 'credit'}
            />
            <Text variant="label" family="regular" color="inkMuted" align="center">
              {[selected.cat, formatDayLabel(parseTxDate(selected.date) || undefined), selected.bank].filter(Boolean).join(' · ')}
            </Text>
            {selected.type === 'debit' && budgets.length ? (
              <Pressable
                onPress={() => setLinking(true)}
                accessibilityRole="button"
                accessibilityLabel={linkedBudget ? `Counts towards ${linkedBudget.name}. Change budget` : 'Count towards a budget'}
                style={({ pressed }) => ({
                  alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md,
                  padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.line,
                  backgroundColor: pressed ? c.sunken : c.surface,
                })}
              >
                <Icon name="pie-chart-outline" size={20} color={linkedBudget ? 'accent' : 'inkMuted'} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="label" family="semibold">{linkedBudget ? `Counts towards ${linkedBudget.name}` : 'Count towards a budget'}</Text>
                  <Text variant="caption" color="inkMuted">{linkedBudget ? 'Tap to change' : 'For a payment its category or name misses'}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color="inkSubtle" />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={linking} onClose={() => setLinking(false)} title="Count towards a budget">
        <ScrollView style={{ maxHeight: 420 }}>
          <View style={{ gap: space.xs }}>
            {[...budgets.map(b => ({ id: b.id, label: b.name, note: b.oneOff ? 'One-off' : 'Every month' })),
              { id: null, label: "Don't link to a budget", note: 'Count it by category and name as usual' }].map(option => {
              const on = (selected?.budgetId || null) === option.id;
              return (
                <Pressable
                  key={option.id || 'none'}
                  onPress={() => saveLink(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
                    borderRadius: radius.md, borderWidth: on ? 1.5 : 0, borderColor: c.accent,
                    backgroundColor: on ? c.accentSoft : pressed ? c.sunken : 'transparent',
                  })}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyStrong" family="semibold">{option.label}</Text>
                    <Text variant="caption" color="inkMuted">{option.note}</Text>
                  </View>
                  {on ? <Icon name="checkmark-circle" size={22} color="accent" /> : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        destructive
        title="Delete this transaction?"
        body={selected ? `${selected.desc}, ${formatMoney(selected.amount)}. This can't be undone.` : ''}
        confirmLabel="Delete transaction"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
