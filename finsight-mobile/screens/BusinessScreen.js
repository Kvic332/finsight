import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '../services/dataStore';
import { radius, space } from '../constants/tokens';
import {
  Badge, Button, Card, CategoryTile, Chip, ConfirmSheet, EmptyState, Input, Money, Sheet, Text, tapFeedback, useTheme, useToast,
} from '../components/ui';
import { businessMonth, isBusinessTx, payYourselfTransactions } from '../services/business';
import { formatMoney, parseAmount } from '../services/format';
import { loadTransactions, saveTransactions } from '../services/transactions';
import { loadOwed, saveOwed } from '../services/owedReminders';
import {
  owedStatus, owedSummary, receivePayment, remaining, taxSetAside, validateOwed,
} from '../services/receivables';
import { parseNumber } from '../services/catalogRules';
import { TransactionRow } from './HomeScreen';

const TAX_CHOICES = [0, 3, 5, 10];
const formatDate = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

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
          hint={kept > 0 ? `${formatMoney(kept)} of this month's profit is still in the business, after your tax set-aside.` : "This month's profit is all paid out, or there isn't any yet."} />
        {value > kept && kept >= 0 ? <Text variant="caption" color="negative">{`That's ${formatMoney(value - Math.max(0, kept))} more than this month's profit left in the business.`}</Text> : null}
      </View>
    </Sheet>
  );
}

// Quick entry for money that never touches the bank. Stays open for the next sale.
function CashSaleSheet({ onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  async function save() {
    const value = parseAmount(amount);
    if (!value) { setError('Enter the amount, like 3,500'); return; }
    await onSave(value, what.trim());
    setCount(n => n + 1);
    setAmount('');
    setWhat('');
  }
  return (
    <Sheet visible onClose={onClose} title="Cash sale" footer={<Button full title="Save sale" onPress={save} />}>
      <View style={{ gap: space.md }}>
        <Input label="Amount" prefix="₦" keyboardType="numeric" placeholder="3,500" value={amount} error={error} onChangeText={v => { setAmount(v); setError(''); }} />
        <Input label="What you sold" placeholder="Optional, like 2 bags of rice" value={what} onChangeText={setWhat} />
        {count ? <Text variant="label" family="semibold" color="positive" accessibilityLiveRegion="polite">{`${count} saved. Add the next one, or close.`}</Text> : null}
      </View>
    </Sheet>
  );
}

function TaxSheet({ percent, profit, onClose, onSave }) {
  const [text, setText] = useState(String(percent || ''));
  const value = parseNumber(text) || 0;
  return (
    <Sheet visible onClose={onClose} title="Set aside for tax" footer={<Button full title="Save" onPress={() => onSave(Math.min(50, Math.max(0, value)))} />}>
      <View style={{ gap: space.md }}>
        <Text color="inkMuted">
          Choose a share of each month's profit to keep aside, so tax isn't a surprise. FinSight doesn't work out what you owe. Ask an accountant or your state revenue service what applies to your business.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {TAX_CHOICES.map(p => <Chip key={p} label={p ? `${p}%` : 'None'} selected={value === p} onPress={() => setText(String(p))} />)}
        </View>
        <Input label="Or your own, in %" keyboardType="decimal-pad" value={text} onChangeText={setText} />
        {value > 0 && profit > 0 ? <Text variant="label" family="semibold">{`That's ${formatMoney(taxSetAside(profit, value))} from this month's profit.`}</Text> : null}
      </View>
    </Sheet>
  );
}

function OwedForm({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  function save() {
    const entry = { name: name.trim(), amount: parseAmount(amount), dueDate: dueDate.trim() };
    const next = validateOwed(entry);
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({ id: `owed_${Date.now()}`, ...entry, note: note.trim(), received: 0, createdAt: new Date().toISOString() });
  }
  return (
    <Sheet visible onClose={onClose} title="Someone owes you" footer={<Button full title="Save" onPress={save} />}>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
        <Input label="Who owes you?" placeholder="Customer or business name" value={name} error={errors.name} onChangeText={setName} />
        <Input label="Amount" prefix="₦" keyboardType="numeric" placeholder="25,000" value={amount} error={errors.amount} onChangeText={setAmount} />
        <Input label="When will they pay?" placeholder="YYYY-MM-DD" value={dueDate} error={errors.dueDate} hint="Optional. FinSight reminds you on the day, then 3 and 7 days after if it's still unpaid." onChangeText={setDueDate} />
        <Input label="Note" placeholder="Optional, like 10 cartons on credit" value={note} onChangeText={setNote} />
        <Text variant="caption" color="inkMuted">It counts as a sale when they pay, so your profit shows money that has actually come in.</Text>
      </ScrollView>
    </Sheet>
  );
}

function ReceiveSheet({ entry, onClose, onReceive, onDelete }) {
  const [amount, setAmount] = useState(String(remaining(entry)));
  const [error, setError] = useState('');
  return (
    <Sheet
      visible
      onClose={onClose}
      title={entry.name}
      footer={(
        <>
          <Button full title="Record payment" onPress={() => { const r = onReceive(parseAmount(amount)); if (r) setError(r); }} />
          <Button full title="Delete" variant="ghost" onPress={onDelete} />
        </>
      )}
    >
      <View style={{ gap: space.md }}>
        <Text color="inkMuted">{`They owe ${formatMoney(remaining(entry))}${entry.received ? ` of ${formatMoney(entry.amount)}` : ''}.${entry.note ? ` ${entry.note}.` : ''}`}</Text>
        <Input label="Amount they paid" prefix="₦" keyboardType="numeric" value={amount} error={error} onChangeText={v => { setAmount(v); setError(''); }} />
      </View>
    </Sheet>
  );
}

export default function BusinessScreen({ navigation, user, setUser }) {
  const { c } = useTheme();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [owed, setOwed] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = () => Promise.all([loadTransactions(), loadOwed()])
    .then(([t, o]) => { setTransactions(t); setOwed(o); })
    .catch(() => {});
  useFocusEffect(useCallback(() => { load(); }, []));

  const m = businessMonth(transactions);
  const taxPercent = Number(user?.taxSetAsidePercent) || 0;
  const tax = taxSetAside(m.profit, taxPercent);
  const keptAfterTax = m.kept - tax;
  const recent = transactions.filter(isBusinessTx).slice(0, 10);
  const change = m.hasLast && m.last.profit !== 0 ? Math.round(((m.profit - m.last.profit) / Math.abs(m.last.profit)) * 100) : null;
  const owedNow = owedSummary(owed);
  const openList = owed.filter(e => remaining(e) > 0);

  async function addTransactions(newOnes) {
    const list = await loadTransactions();
    const next = [...newOnes, ...list];
    await saveTransactions(next);
    setTransactions(next);
  }

  async function payYourself(amount) {
    await addTransactions(payYourselfTransactions(amount));
    setSheet(null);
    toast.show(`${formatMoney(amount)} recorded as your pay from the business`, { tone: 'success' });
  }

  async function cashSale(amount, what) {
    const now = new Date();
    await addTransactions([{
      id: `cash_${now.getTime()}`, desc: what ? `Cash sale: ${what}` : 'Cash sale', amount, type: 'credit', cat: 'Sales', source: 'manual', date: formatDate(now),
    }]);
  }

  async function saveTax(percent) {
    const updated = { ...user, taxSetAsidePercent: percent };
    await AsyncStorage.setItem('finsight_user', JSON.stringify(updated));
    setUser?.(updated);
    setSheet(null);
    toast.show(percent ? `Setting aside ${percent}% of profit for tax` : 'No tax set-aside', { tone: 'success' });
  }

  async function addOwed(entry) {
    const next = [entry, ...owed];
    await saveOwed(next);
    setOwed(next);
    setSheet(null);
    toast.show(`${entry.name} owes you ${formatMoney(entry.amount)}`, { tone: 'success' });
  }

  function receive(entry, amount) {
    const result = receivePayment(owed, entry.id, amount);
    if (result.error) return result.error;
    (async () => {
      await saveOwed(result.list);
      setOwed(result.list);
      await addTransactions([result.tx]);
      setSheet(null);
      toast.show(`${formatMoney(amount)} from ${entry.name} recorded as a sale`, { tone: 'success' });
    })();
    return null;
  }

  async function removeOwed() {
    const next = owed.filter(e => e.id !== deleting.id);
    await saveOwed(next);
    setOwed(next);
    setDeleting(null);
    setSheet(null);
    toast.show('Removed');
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
          <Pressable onPress={() => { tapFeedback(); setSheet({ kind: 'tax' }); }} accessibilityRole="button" hitSlop={8}>
            <Text variant="label" family="semibold" color="accent">
              {taxPercent ? `Set aside for tax: ${formatMoney(tax)} (${taxPercent}% of profit). Change` : 'Set aside some profit for tax'}
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Button full title="Cash sale" onPress={() => setSheet({ kind: 'cash' })} /></View>
            <View style={{ flex: 1 }}><Button full title="Add sale" variant="secondary" onPress={() => navigation.navigate('Add', { book: 'business', type: 'credit' })} /></View>
          </View>
          <Button full title="Add cost" variant="secondary" onPress={() => navigation.navigate('Add', { book: 'business', type: 'debit' })} />
        </Card>

        <Card style={{ padding: space.lg, gap: space.sm }}>
          <Text variant="bodyStrong" family="bold">Pay yourself</Text>
          <Text variant="label" family="regular" color="inkMuted">
            {m.ownerPay
              ? `You've paid yourself ${formatMoney(m.ownerPay)} this month. ${formatMoney(Math.max(0, keptAfterTax))} of the profit is still in the business${tax ? ', after the tax set-aside' : ''}.`
              : 'Pay yourself a set amount, like a salary. Keeping business and personal money apart shows whether the business really makes money.'}
          </Text>
          <Button title="Pay yourself" onPress={() => setSheet({ kind: 'pay' })} />
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm }}>
          <Text variant="heading" family="bold">Owed to you</Text>
          <Button title="Add" variant="secondary" onPress={() => setSheet({ kind: 'owed' })} />
        </View>
        {openList.length ? (
          <Card style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.xs }}>
            <Text variant="label" family="regular" color="inkMuted">
              {`${formatMoney(owedNow.total)} from ${owedNow.count === 1 ? '1 customer' : `${owedNow.count} customers`}${owedNow.late ? `, ${owedNow.late} late` : ''}.`}
            </Text>
            {openList.map(e => {
              const status = owedStatus(e);
              return (
                <Pressable key={e.id} onPress={() => { tapFeedback(); setSheet({ kind: 'receive', entry: e }); }} accessibilityRole="button"
                  accessibilityLabel={`${e.name} owes ${formatMoney(remaining(e))}. Record a payment`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text variant="bodyStrong" family="semibold" numberOfLines={1}>{e.name}</Text>
                    {status ? <View style={{ flexDirection: 'row' }}><Badge label={status.label} tone={status.tone} /></View> : null}
                  </View>
                  <Money value={remaining(e)} family="bold" />
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <Text variant="label" family="regular" color="inkMuted">Customers who bought on credit. FinSight reminds you when they're due to pay.</Text>
        )}

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

      {sheet?.kind === 'pay' ? <PayYourselfSheet kept={keptAfterTax} onClose={() => setSheet(null)} onSave={payYourself} /> : null}
      {sheet?.kind === 'cash' ? <CashSaleSheet onClose={() => setSheet(null)} onSave={cashSale} /> : null}
      {sheet?.kind === 'tax' ? <TaxSheet percent={taxPercent} profit={m.profit} onClose={() => setSheet(null)} onSave={saveTax} /> : null}
      {sheet?.kind === 'owed' ? <OwedForm onClose={() => setSheet(null)} onSave={addOwed} /> : null}
      {sheet?.kind === 'receive' ? (
        <ReceiveSheet entry={sheet.entry} onClose={() => setSheet(null)} onReceive={amount => receive(sheet.entry, amount)} onDelete={() => setDeleting(sheet.entry)} />
      ) : null}
      <ConfirmSheet
        visible={!!deleting}
        title={`Remove ${deleting?.name}?`}
        body="Use this if it was entered by mistake or they won't pay. Payments already recorded stay as sales."
        confirmLabel="Remove"
        destructive
        onConfirm={removeOwed}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
