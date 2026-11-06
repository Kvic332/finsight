import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '../services/dataStore';
import { space } from '../constants/tokens';
import {
  Badge, Button, Card, Chip, ConfirmSheet, EmptyState, Gradient, Icon, IconTile, Input, Money, Sheet, Text,
  useTheme, useToast,
} from '../components/ui';
import { parseNumber } from '../services/catalogRules';
import { syncDebtReminders } from '../services/debtReminders';
import {
  annualFromRate, annualFromRepayment, debtSummary, monthlyRepayment, dueStatus, parseDueDate, payoffOrder, payoffPlan, recordPayment,
} from '../services/debts';
import { formatMoney, parseAmount } from '../services/format';
import { addTransaction } from '../services/transactions';

const KEY = 'finsight_debts';

const COST_METHODS = [
  { value: 'rate', label: 'I know the rate' },
  { value: 'repay', label: 'I know the total' },
  { value: 'unknown', label: 'Not sure' },
];
const PERIODS = [
  { value: 'monthly', label: 'A month' },
  { value: 'annual', label: 'A year' },
];

const INTEREST_TYPES = [
  { value: 'reducing', label: "On what's left" },
  { value: 'flat', label: 'On the full loan' },
];

const monthsLabel = months => (months === 1 ? '1 month' : `${months} months`);

function ChoiceRow({ label, options, value, onChange }) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {options.map(o => <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />)}
      </View>
    </View>
  );
}

function DebtForm({ debt, onClose, onSave, onDelete }) {
  const [lender, setLender] = useState(debt?.lender || '');
  const [owed, setOwed] = useState(debt ? String(debt.owed) : '');
  const [method, setMethod] = useState(debt?.costMethod || 'rate');
  const [rate, setRate] = useState(debt?.rate !== undefined && debt?.rate !== null ? String(debt.rate) : '');
  const [period, setPeriod] = useState(debt?.ratePeriod || 'monthly');
  const [borrowed, setBorrowed] = useState(debt?.borrowed ? String(debt.borrowed) : '');
  const [totalRepay, setTotalRepay] = useState(debt?.totalRepay ? String(debt.totalRepay) : '');
  const [days, setDays] = useState(debt?.termDays ? String(debt.termDays) : '');
  const [months, setMonths] = useState(debt?.termMonths ? String(debt.termMonths) : '');
  const [interestType, setInterestType] = useState(debt?.interestType || 'reducing');
  const [payment, setPayment] = useState(debt?.payment ? String(debt.payment) : '');
  const [dueDate, setDueDate] = useState(debt?.dueDate || '');
  const [repeats, setRepeats] = useState(debt ? (debt.repeatsMonthly ? 'yes' : 'no') : 'yes');
  const [errors, setErrors] = useState({});

  const monthsValue = parseNumber(months);
  const repayment = method === 'rate'
    ? monthlyRepayment({ principal: parseAmount(owed), rate: parseNumber(rate), period, months: monthsValue, interestType })
    : null;

  function save() {
    const owedValue = parseAmount(owed);
    const rateValue = parseNumber(rate);
    const borrowedValue = parseAmount(borrowed);
    const totalValue = parseAmount(totalRepay);
    const daysValue = parseNumber(days);
    // With no payment typed, the worked-out repayment is used.
    const paymentValue = payment.trim() ? parseAmount(payment) : repayment ? repayment.payment : null;
    const date = dueDate.trim();

    const costFromRate = method === 'rate' ? annualFromRate(rateValue, period) : null;
    const costFromRepay = method === 'repay' ? annualFromRepayment(borrowedValue, totalValue, daysValue) : null;

    const next = {
      ...(lender.trim() ? null : { lender: 'Enter who you owe' }),
      ...(owedValue ? null : { owed: 'Enter what you still owe, like 50,000' }),
      ...(method === 'rate' && costFromRate === null ? { rate: 'Enter the rate as a number, like 5' } : null),
      ...(method === 'repay' && !borrowedValue ? { borrowed: 'Enter what you borrowed' } : null),
      ...(method === 'repay' && borrowedValue && (!totalValue || totalValue < borrowedValue) ? { totalRepay: "This can't be less than you borrowed" } : null),
      ...(method === 'repay' && !(daysValue > 0) ? { days: 'Enter the length in days, like 30' } : null),
      ...(method === 'rate' && months.trim() && !(Number.isInteger(monthsValue) && monthsValue >= 1) ? { months: 'Enter whole months, like 12' } : null),
      ...(payment.trim() && !paymentValue ? { payment: 'Enter an amount, like 10,000' } : null),
      ...(date && !parseDueDate(date) ? { dueDate: 'Use year-month-day, like 2026-11-30' } : null),
    };
    setErrors(next);
    if (Object.keys(next).length) return;

    onSave({
      id: debt?.id || Date.now().toString(),
      paid: debt?.paid || 0,
      lender: lender.trim(),
      owed: owedValue,
      costMethod: method,
      rate: method === 'rate' ? rateValue : null,
      ratePeriod: method === 'rate' ? period : null,
      borrowed: method === 'repay' ? borrowedValue : null,
      totalRepay: method === 'repay' ? totalValue : null,
      termDays: method === 'repay' ? daysValue : null,
      termMonths: method === 'rate' && monthsValue >= 1 ? monthsValue : null,
      interestType: method === 'rate' ? interestType : null,
      annualRate: method === 'rate' ? costFromRate : method === 'repay' ? costFromRepay : null,
      payment: paymentValue,
      dueDate: date || null,
      repeatsMonthly: repeats === 'yes',
    });
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={debt ? 'Edit debt' : 'Add a debt'}
      footer={(
        <>
          <Button full title={debt ? 'Save changes' : 'Save debt'} onPress={save} />
          {debt ? <Button full title="Delete debt" variant="ghost" onPress={onDelete} /> : null}
        </>
      )}
    >
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
        <Input label="Who do you owe?" placeholder="Loan app, bank or person" value={lender} error={errors.lender} onChangeText={setLender} />
        <Input label="What you still owe" prefix="₦" keyboardType="numeric" placeholder="50,000" value={owed} error={errors.owed} onChangeText={setOwed} />
        <ChoiceRow label="What does it cost?" options={COST_METHODS} value={method} onChange={setMethod} />
        {method === 'rate' ? (
          <>
            <Input label="Interest rate, %" keyboardType="decimal-pad" placeholder="5" value={rate} error={errors.rate} onChangeText={setRate} />
            <ChoiceRow label="The rate is per" options={PERIODS} value={period} onChange={setPeriod} />
            <Input label="Months left to repay" keyboardType="number-pad" placeholder="12" value={months} error={errors.months} hint="Optional. With it, FinSight works out your monthly repayment." onChangeText={setMonths} />
            <ChoiceRow label="Interest is charged" options={INTEREST_TYPES} value={interestType} onChange={setInterestType} />
            <Text variant="caption" color="inkMuted">
              {interestType === 'flat'
                ? 'Each month, interest on the whole loan, even as you pay it down. Common with loan apps. Your loan agreement says which.'
                : 'Each month, interest only on what you still owe, so it falls as you pay. Usual for bank loans. Your loan agreement says which.'}
            </Text>
            {repayment ? (
              <Card style={{ padding: space.lg, gap: space.xs }}>
                <Text variant="label" family="medium" color="inkMuted">Your monthly repayment</Text>
                <Money value={repayment.payment} family="bold" variant="heading" />
                <Text variant="label" family="regular" color="inkMuted">
                  {`For ${monthsLabel(monthsValue)}: ${formatMoney(repayment.totalRepay)} in all, ${formatMoney(repayment.totalInterest)} of it interest.`}
                </Text>
                {payment.trim() && parseAmount(payment) !== repayment.payment ? (
                  <Button title="Use this amount" variant="secondary" onPress={() => setPayment(String(repayment.payment))} />
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}
        {method === 'repay' ? (
          <>
            <Input label="You borrowed" prefix="₦" keyboardType="numeric" placeholder="20,000" value={borrowed} error={errors.borrowed} onChangeText={setBorrowed} />
            <Input label="Total you must repay" prefix="₦" keyboardType="numeric" placeholder="26,000" value={totalRepay} error={errors.totalRepay} onChangeText={setTotalRepay} />
            <Input label="Length of the loan, in days" keyboardType="number-pad" placeholder="30" value={days} error={errors.days} onChangeText={setDays} />
          </>
        ) : null}
        {method === 'unknown' ? (
          <Text variant="label" family="regular" color="inkMuted">It'll be listed after debts with a known cost. Your loan agreement or app should show the rate.</Text>
        ) : null}
        <Input label="Payment amount" prefix="₦" keyboardType="numeric" placeholder="10,000" value={payment} error={errors.payment}
          hint={repayment && !payment.trim() ? `Leave empty to use ${formatMoney(repayment.payment)}, worked out above. Enter your own if your lender says a different amount.` : 'Optional. Needed for the payoff plan.'}
          onChangeText={setPayment} />
        <Input label="Next due date" placeholder="YYYY-MM-DD" value={dueDate} error={errors.dueDate} hint="Optional. We'll remind you 3 days before, the day before and on the day." onChangeText={setDueDate} />
        <ChoiceRow
          label="Is this payment monthly?"
          options={[{ value: 'yes', label: 'Every month' }, { value: 'no', label: 'One payment' }]}
          value={repeats}
          onChange={setRepeats}
        />
      </ScrollView>
    </Sheet>
  );
}

function PaymentForm({ debt, onClose, onSave }) {
  const [amount, setAmount] = useState(debt.payment ? String(Math.min(debt.payment, debt.owed)) : '');
  const [addToActivity, setAddToActivity] = useState('yes');
  const [error, setError] = useState('');

  function save() {
    const value = parseAmount(amount);
    if (!value) { setError('Enter an amount, like 5,000'); return; }
    onSave(value, addToActivity === 'yes');
  }

  return (
    <Sheet visible onClose={onClose} title={`Pay ${debt.lender}`} footer={<Button full title="Record payment" onPress={save} />}>
      <View style={{ gap: space.md }}>
        <Text color="inkMuted">Record a payment you've made. FinSight doesn't send any money.</Text>
        <Input label="Amount paid" prefix="₦" keyboardType="numeric" value={amount} error={error} onChangeText={v => { setAmount(v); setError(''); }} />
        <ChoiceRow
          label="Also add it to your spending?"
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'Already there' }]}
          value={addToActivity}
          onChange={setAddToActivity}
        />
        <Text variant="caption" color="inkMuted">Choose Already there if a bank alert or statement has added it, so it isn't counted twice.</Text>
      </View>
    </Sheet>
  );
}

function DebtCard({ debt, rank, onEdit, onPay }) {
  const status = dueStatus(debt);
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile name="card-outline" tone={rank === 1 ? 'accent' : 'neutral'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" family="bold" numberOfLines={1}>{debt.lender}</Text>
          <Text variant="label" family="regular" color="inkMuted" numberOfLines={1}>
            {[
              typeof debt.annualRate === 'number' ? `About ${debt.annualRate}% a year` : 'Cost not known',
              debt.termMonths ? `${monthsLabel(debt.termMonths)} left` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Money value={debt.owed} family="bold" />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {rank === 1 ? <Badge label="Pay this first" tone="accent" icon="flag-outline" /> : null}
        {status ? <Badge label={status.label} tone={status.tone} /> : null}
        {debt.payment ? <Badge label={`${formatMoney(debt.payment)}${debt.repeatsMonthly ? ' a month' : ''}`} /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${debt.lender}`} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="create-outline" size={18} color="inkMuted" />
          <Text variant="label" family="semibold" color="inkMuted">Edit</Text>
        </Pressable>
        <Pressable onPress={onPay} accessibilityRole="button" accessibilityLabel={`Record a payment to ${debt.lender}`} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="add-circle" size={18} color="accent" />
          <Text variant="label" family="semibold" color="accent">Record payment</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function PlanCard({ debts }) {
  const [extraText, setExtraText] = useState('');
  const extra = parseAmount(extraText) || 0;
  const plan = payoffPlan(debts, extra);

  let result = null;
  if (plan.status === 'incomplete') {
    result = <Text variant="label" family="regular" color="inkMuted">{`Add a cost and payment amount for ${plan.missing.map(d => d.lender).join(', ')} to see how long this takes.`}</Text>;
  } else if (plan.status === 'too_low') {
    result = <Text variant="label" family="medium" color="negative">These payments don't cover the interest, so the debt would never clear. Try adding an extra amount, or speak to the lender.</Text>;
  } else if (plan.status === 'ok') {
    result = (
      <View style={{ gap: space.xs }}>
        <Text variant="bodyStrong" family="bold">{`Debt-free in about ${monthsLabel(plan.months)}`}</Text>
        <Text variant="label" family="regular" color="inkMuted">{`About ${formatMoney(plan.interest)} in interest`}</Text>
        {extra > 0 && plan.withoutExtra && plan.interestSaved > 0 ? (
          <Text variant="label" family="medium" color="positive">{`Paying ${formatMoney(extra)} extra saves about ${formatMoney(plan.interestSaved)} and ${monthsLabel(plan.monthsSaved)}`}</Text>
        ) : null}
        {extra > 0 && !plan.withoutExtra ? (
          <Text variant="label" family="medium" color="positive">Without this extra, your payments wouldn't clear the debt.</Text>
        ) : null}
      </View>
    );
  }

  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <Text variant="heading" family="bold" accessibilityRole="header">Your payoff plan</Text>
      <Text variant="label" family="regular" color="inkMuted">
        Pay the minimum on everything, then put any spare money on the debt at the top. Highest cost first usually costs you least overall.
      </Text>
      <Input label="Extra you could pay each month" prefix="₦" keyboardType="numeric" placeholder="0" value={extraText} onChangeText={setExtraText} />
      {result}
      <Text variant="caption" color="inkMuted">
        An estimate from what you entered. Lenders may add fees, change rates or charge for paying early, so check with them. This isn't financial advice.
      </Text>
    </Card>
  );
}

export default function DebtsScreen({ user }) {
  const { c } = useTheme();
  const toast = useToast();
  const [debts, setDebts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(null);
  const [paying, setPaying] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showCleared, setShowCleared] = useState(false);

  async function load() {
    const raw = await AsyncStorage.getItem(KEY);
    setDebts(raw ? JSON.parse(raw) : []);
  }

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  async function persist(next) {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    setDebts(next);
    syncDebtReminders(next);
  }

  async function saveDebt(debt) {
    try {
      await persist(form.debt ? debts.map(d => (d.id === debt.id ? debt : d)) : [...debts, debt]);
      setForm(null);
      toast.show(form.debt ? 'Debt updated' : 'Debt added', { tone: 'success' });
    } catch (e) {
      toast.show("Couldn't save this. Try again.", { tone: 'error' });
    }
  }

  async function removeDebt() {
    try {
      await persist(debts.filter(d => d.id !== deleting.id));
      setDeleting(null);
      setForm(null);
      toast.show('Debt deleted');
    } catch (e) {
      toast.show("Couldn't delete this. Try again.", { tone: 'error' });
    }
  }

  async function savePayment(amount, addToActivity) {
    const applied = Math.min(amount, paying.owed);
    try {
      if (addToActivity) await addTransaction({ desc: `Loan payment to ${paying.lender}`, amount: applied, type: 'debit', cat: 'Debt' });
      await persist(recordPayment(debts, paying.id, applied));
      toast.show(applied >= paying.owed ? `${paying.lender} is cleared. Well done` : `${formatMoney(applied)} paid to ${paying.lender}`, { tone: 'success' });
      setPaying(null);
    } catch (e) {
      toast.show("Couldn't save this payment. Try again.", { tone: 'error' });
    }
  }

  const order = payoffOrder(debts);
  const cleared = debts.filter(d => !(d.owed > 0));
  const summary = debtSummary(debts, Number(user?.income) || 0);
  const ranked = order.some(d => typeof d.annualRate === 'number');

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.md + 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
      >
        {order.length ? (
          <>
            <Card style={{ padding: space.xl, gap: space.xs }}>
              <Text variant="label" family="medium" color="inkMuted">Total you owe</Text>
              <Money value={summary.totalOwed} variant="display" family="bold" adjustsFontSizeToFit style={{ fontSize: 36, lineHeight: 46, letterSpacing: -0.8 }} />
              <Text variant="label" family="medium" color="inkMuted">
                {`${summary.count === 1 ? '1 debt' : `${summary.count} debts`}${summary.monthly ? ` · ${formatMoney(summary.monthly)} a month` : ''}${summary.shareOfIncome ? ` · ${summary.shareOfIncome}% of your income` : ''}`}
              </Text>
              {summary.overdue ? <View style={{ marginTop: space.xs }}><Badge label={summary.overdue === 1 ? '1 payment overdue' : `${summary.overdue} payments overdue`} tone="negative" /></View> : null}
            </Card>

            {ranked && order[0] && typeof order[0].annualRate === 'number' ? (
              <Gradient name="plum" style={{ borderRadius: 22, padding: space.lg + 2, flexDirection: 'row', gap: space.md }}>
                <Icon name="sparkles" size={20} color="#FFD9E8" />
                <Text variant="label" color="#FFFFFF" style={{ flex: 1, lineHeight: 20 }}>
                  {`${order[0].lender} costs you the most, at about ${order[0].annualRate}% a year. After your minimum payments, any spare money goes furthest there.`}
                </Text>
              </Gradient>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs }}>
              <Text variant="heading" family="bold" accessibilityRole="header">Your debts</Text>
              <Pressable onPress={() => setForm({})} accessibilityRole="button" hitSlop={10}>
                <Text variant="label" family="semibold" color="accent">Add debt</Text>
              </Pressable>
            </View>

            {order.map((debt, i) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                rank={ranked ? i + 1 : 0}
                onEdit={() => setForm({ debt })}
                onPay={() => setPaying(debt)}
              />
            ))}

            <PlanCard debts={debts} />
          </>
        ) : (
          <EmptyState
            icon="card-outline"
            title={cleared.length ? "You're debt-free" : 'Track what you owe'}
            body={cleared.length
              ? 'Every debt you added is cleared. Well done.'
              : 'Add your loans to see the total, what each one really costs, and which to pay first. Everything stays on your phone unless you back it up.'}
            action={<Button title="Add debt" onPress={() => setForm({})} />}
          />
        )}

        {cleared.length ? (
          <View style={{ gap: space.sm }}>
            <Pressable onPress={() => setShowCleared(v => !v)} accessibilityRole="button" hitSlop={10}>
              <Text variant="label" family="semibold" color="accent">{`${showCleared ? 'Hide' : 'Show'} cleared debts (${cleared.length})`}</Text>
            </Pressable>
            {showCleared ? cleared.map(debt => (
              <Card key={debt.id} onPress={() => setForm({ debt })} accessibilityLabel={`Edit ${debt.lender}`} style={{ padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconTile name="checkmark-circle-outline" tone="positive" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" family="bold" numberOfLines={1}>{debt.lender}</Text>
                  <Text variant="label" family="regular" color="inkMuted">{`${formatMoney(debt.paid || 0)} paid`}</Text>
                </View>
                <Badge label="Cleared" tone="positive" />
              </Card>
            )) : null}
          </View>
        ) : null}
      </ScrollView>

      {form && !deleting ? (
        <DebtForm debt={form.debt} onClose={() => setForm(null)} onSave={saveDebt} onDelete={() => setDeleting(form.debt)} />
      ) : null}
      {paying ? <PaymentForm debt={paying} onClose={() => setPaying(null)} onSave={savePayment} /> : null}
      <ConfirmSheet
        visible={!!deleting}
        destructive
        title={deleting ? `Delete ${deleting.lender}?` : ''}
        body="Payments already in your activity stay. Only this debt is removed."
        confirmLabel="Delete debt"
        onConfirm={removeDebt}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
