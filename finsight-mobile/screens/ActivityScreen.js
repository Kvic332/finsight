import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, SectionList, StatusBar, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, CategoryTile, Chip, ConfirmSheet, EmptyState, Gradient, IconButton, Input, Money, Sheet,
  Text, useTheme, useToast,
} from '../components/ui';
import { computePaydayPlan, parseTxDate } from '../services/finance';
import { formatDayLabel, formatMoney } from '../services/format';
import { deleteTransaction, loadTransactions } from '../services/transactions';
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

  useFocusEffect(useCallback(() => { loadTransactions().then(setTransactions).catch(() => {}); }, []));

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
        visible={!!selected && !confirmDelete}
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
          </View>
        ) : null}
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
