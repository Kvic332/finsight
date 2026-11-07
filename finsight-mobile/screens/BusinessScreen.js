import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { radius, space } from '../constants/tokens';
import {
  Button, Card, CategoryTile, EmptyState, Input, Money, Sheet, Text, useTheme, useToast,
} from '../components/ui';
import { businessMonth, isBusinessTx, payYourselfTransactions } from '../services/business';
import { formatMoney, parseAmount } from '../services/format';
import { loadTransactions, saveTransactions } from '../services/transactions';
import { TransactionRow } from './HomeScreen';

function Figure({ label, value, tone }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" color="inkMuted">{label}</Text>
      <Money value={value} family="bold" tone={tone} />
    </View>
  );
}

function PayYourselfSheet({ kept, onClose, onSave }) {
  const [text, setText] = useState(kept > 0 ? String(Math.floor(kept / 1000) * 1000) : '');
  const [error, setError] = useState('');
  const value = parseAmount(text);
  return (
    <Sheet visible onClose={onClose} title="Pay yourself" footer={<Button full title={value ? `Pay myself ${formatMoney(value)}` : 'Pay myself'} onPress={() => (value ? onSave(value) : setError('Enter an amount, like 100,000'))} />}>
      <View style={{ gap: space.md }}>
        <Text color="inkMuted">
          Record money you take from the business for yourself. It leaves the business and arrives as your personal income, so your payday plan and budgets work from it. FinSight doesn't move any money.
        </Text>
        <Input label="Amount" prefix="₦" keyboardType="numeric" placeholder="100,000" value={text} error={error} onChangeText={v => { setText(v); setError(''); }}
          hint={kept > 0 ? `${formatMoney(kept)} of this month's profit is still in the business.` : "This month's profit is all paid out, or there isn't any yet."} />
        {value > kept && kept >= 0 ? <Text variant="caption" color="negative">{`That's ${formatMoney(value - Math.max(0, kept))} more than this month's profit left in the business.`}</Text> : null}
      </View>
    </Sheet>
  );
}

export default function BusinessScreen({ navigation }) {
  const { c } = useTheme();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = () => loadTransactions().then(setTransactions).catch(() => {});
  useFocusEffect(useCallback(() => { load(); }, []));

  const m = businessMonth(transactions);
  const recent = transactions.filter(isBusinessTx).slice(0, 10);
  const change = m.hasLast && m.last.profit !== 0 ? Math.round(((m.profit - m.last.profit) / Math.abs(m.last.profit)) * 100) : null;

  async function payYourself(amount) {
    const pair = payYourselfTransactions(amount);
    const list = await loadTransactions();
    await saveTransactions([...pair, ...list]);
    setTransactions([...pair, ...list]);
    setPaying(false);
    toast.show(`${formatMoney(amount)} recorded as your pay from the business`, { tone: 'success' });
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.md + 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Card style={{ padding: space.xl, gap: space.md }}>
          <Text variant="label" family="medium" color="inkMuted">Profit this month</Text>
          <Money value={m.profit} variant="display" family="bold" tone={m.profit < 0 ? 'negative' : 'ink'} style={{ fontSize: 38, lineHeight: 48 }} />
          <Text variant="label" family="medium" color={change === null ? 'inkMuted' : change >= 0 ? 'positive' : 'negative'}>
            {change === null
              ? (m.hasLast ? `Last month: ${formatMoney(m.last.profit)}` : 'Nothing from last month to compare with yet')
              : `${change >= 0 ? `${change}% more` : `${-change}% less`} than last month (${formatMoney(m.last.profit)})`}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Figure label="Sales" value={m.sales + m.otherIn} tone="positive" />
            <Figure label="Costs" value={m.costs} />
          </View>
          <Text variant="caption" color="inkMuted">
            {m.margin === null ? 'Record your sales to see your margin.' : `You keep ${m.margin}% of every sale after costs.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Button full title="Add sale" variant="secondary" onPress={() => navigation.navigate('Add', { book: 'business', type: 'credit' })} /></View>
            <View style={{ flex: 1 }}><Button full title="Add cost" variant="secondary" onPress={() => navigation.navigate('Add', { book: 'business', type: 'debit' })} /></View>
          </View>
        </Card>

        <Card style={{ padding: space.lg, gap: space.sm }}>
          <Text variant="bodyStrong" family="bold">Pay yourself</Text>
          <Text variant="label" family="regular" color="inkMuted">
            {m.ownerPay
              ? `You've paid yourself ${formatMoney(m.ownerPay)} this month. ${formatMoney(Math.max(0, m.kept))} of the profit is still in the business.`
              : 'Pay yourself a set amount, like a salary. Keeping business and personal money apart shows whether the business really makes money.'}
          </Text>
          <Button title="Pay yourself" onPress={() => setPaying(true)} />
        </Card>

        {m.byCost.length ? (
          <Card style={{ padding: space.lg, gap: space.md }}>
            <Text variant="label" family="semibold" color="inkMuted">Where the costs went this month</Text>
            {m.byCost.slice(0, 5).map(([cat, amount]) => (
              <View key={cat} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <CategoryTile category={cat} size={32} />
                  <Text variant="bodyStrong" family="semibold" style={{ flex: 1 }}>{cat}</Text>
                  <Money value={amount} family="bold" />
                </View>
                <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: c.sunken, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(2, (amount / m.costs) * 100)}%`, height: '100%', backgroundColor: c.warning }} />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Text variant="heading" family="bold" style={{ marginTop: space.sm }}>Recent business money</Text>
        {recent.length ? (
          <Card style={{ paddingHorizontal: space.lg, paddingVertical: space.xs }}>
            {recent.map(tx => <TransactionRow key={tx.id} tx={tx} showCategory onPress={() => navigation.navigate('Add', { tx })} />)}
          </Card>
        ) : (
          <EmptyState icon="storefront-outline" title="No business money yet" body="Record a sale or a cost, or file bank alerts under business categories like Sales and Stock." />
        )}
      </ScrollView>
      {paying ? <PayYourselfSheet kept={m.kept} onClose={() => setPaying(false)} onSave={payYourself} /> : null}
    </>
  );
}
