import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '../services/dataStore';
import { space } from '../constants/tokens';
import { Badge, Card, Chip, Input, Money, ProgressBar, Text, useToast } from '../components/ui';
import { formatMoney, parseAmount } from '../services/format';
import {
  DEFAULT_SAVE_PERCENT, nextGoalEta, planPayday, planPeriod, SAVE_PERCENTS,
} from '../services/paydayPlan';
import { normalizeGoals } from '../services/plans';
import { expectedPay, paydaysOf } from '../services/finance';

const monthsLabel = months => (months === 1 ? '1 month' : `${months} months`);

function whenLabel(period) {
  if (!period.hasPayday) return 'This month';
  const date = period.start.toLocaleDateString('en-NG', { day: 'numeric', month: 'long' });
  if (period.payIn === 0) return 'Payday is today';
  return `${date}, in ${period.payIn === 1 ? '1 day' : `${period.payIn} days`}`;
}

function SplitRow({ label, value, of, tone, detail }) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        <Text variant="label" family="medium" color="inkMuted" style={{ flexShrink: 1 }}>{label}</Text>
        <Money value={value} variant="label" family="bold" />
      </View>
      <ProgressBar value={of > 0 ? value / of : 0} tone={tone} label={`${label}: ${formatMoney(value)}`} />
      {detail ? <Text variant="caption" color="inkMuted">{detail}</Text> : null}
    </View>
  );
}

export default function PaydayScreen({ user, setUser }) {
  const toast = useToast();
  const [debts, setDebts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [payText, setPayText] = useState('');
  const [transactions, setTransactions] = useState([]);

  useFocusEffect(useCallback(() => {
    Promise.all([
      AsyncStorage.getItem('finsight_debts'), AsyncStorage.getItem('finsight_budgets'), AsyncStorage.getItem('finsight_transactions'),
    ])
      .then(([dRaw, bRaw, tRaw]) => {
        setDebts(dRaw ? JSON.parse(dRaw) : []);
        setBudgets(bRaw ? JSON.parse(bRaw) : []);
        setTransactions(tRaw ? JSON.parse(tRaw) : []);
      })
      .catch(() => toast.show("Couldn't load your plan. Try again.", { tone: 'error' }));
  }, [toast]));

  async function chooseSavePercent(percent) {
    const updated = { ...user, paydaySavePercent: percent };
    try {
      await AsyncStorage.setItem('finsight_user', JSON.stringify(updated));
      setUser?.(updated);
    } catch (e) {
      toast.show("Couldn't save this. Try again.", { tone: 'error' });
    }
  }

  const expected = expectedPay(user, transactions);
  const income = expected.amount;
  const pay = parseAmount(payText) || income;
  const payCount = paydaysOf(user).length;
  const savePercent = user?.paydaySavePercent ?? DEFAULT_SAVE_PERCENT;
  const period = planPeriod(paydaysOf(user));
  const plan = planPayday({ pay, debts, budgets, savePercent, period });
  const eta = nextGoalEta(normalizeGoals(user?.goals), plan.saving);
  const debtDetail = plan.debtLines.map(d => `${d.lender} ${formatMoney(d.amount)}`).join(' · ');

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.md + 2 }}
    >
      <Card style={{ padding: space.xl, gap: space.xs }}>
        <Text variant="label" family="medium" color="inkMuted">{period.hasPayday ? 'Your next pay' : 'Your pay'}</Text>
        <Text variant="heading" family="bold">{whenLabel(period)}</Text>
        {!period.hasPayday ? (
          <Text variant="label" family="regular" color="inkMuted">Your income varies, so this plans the calendar month. Set paydays in Settings if you have them.</Text>
        ) : null}
      </Card>

      <Input
        label="Pay to plan with"
        prefix="₦"
        keyboardType="numeric"
        placeholder={income ? income.toLocaleString() : '450,000'}
        value={payText}
        hint={!income ? 'Enter what you expect to receive.'
          : expected.basis === 'average' ? `Your average income over the last ${monthsLabel(expected.months)}. Enter a different amount if this pay is different.`
          : payCount > 1 ? "Half your monthly income, since you're paid twice a month. Enter a different amount if this pay is different."
          : 'Uses your income from Settings. Enter a different amount if this pay is different.'}
        onChangeText={setPayText}
      />

      {pay ? (
        <>
          {plan.short ? (
            <Card style={{ padding: space.lg, gap: space.sm }}>
              <Badge label={`${formatMoney(plan.short)} short`} tone="negative" />
              <Text variant="label" family="regular" color="inkMuted">
                Your debt payments and budgets add up to more than this pay. Try lowering a budget, or speak to your lender before a payment is missed.
              </Text>
            </Card>
          ) : null}

          <Card style={{ padding: space.xl, gap: space.lg }}>
            <View>
              <Text variant="label" family="medium" color="inkMuted">Left to spend freely</Text>
              <Money value={plan.free} variant="display" family="bold" adjustsFontSizeToFit style={{ fontSize: 36, lineHeight: 46, letterSpacing: -0.8 }} />
              <Text variant="label" family="medium" color="inkMuted">{`About ${formatMoney(plan.perDay)} a day for ${period.days} days`}</Text>
            </View>
            <SplitRow label="1. Debt payments" value={plan.debtTotal} of={pay} tone="negative" detail={debtDetail} />
            <SplitRow label="2. Budgets" value={plan.budgetTotal} of={pay} tone="warning" />
            <SplitRow
              label={`3. Savings, ${savePercent}% of your pay`}
              value={plan.saving}
              of={pay}
              tone="accent"
              detail={plan.saving < plan.wanted ? `Only ${formatMoney(plan.saving)} of the ${formatMoney(plan.wanted)} fits this month.` : null}
            />
          </Card>

          <Card style={{ padding: space.lg, gap: space.md }}>
            <Text variant="bodyStrong" family="bold" accessibilityRole="header">How much to save</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {SAVE_PERCENTS.map(p => <Chip key={p} label={`${p}%`} selected={p === savePercent} onPress={() => chooseSavePercent(p)} />)}
            </View>
            {eta ? (
              <Text variant="label" family="regular" color="inkMuted">
                {`At ${formatMoney(plan.saving)} a month, ${eta.name} takes about ${monthsLabel(eta.months)}.`}
              </Text>
            ) : null}
          </Card>

          {!budgets.length ? (
            <Text variant="label" family="regular" color="inkMuted">
              You have no budgets yet, so nothing is set aside for rent, food or bills. Add them under Budget.
            </Text>
          ) : null}
          {plan.oneOffBudgets.length ? (
            <Text variant="label" family="regular" color="inkMuted">
              {`One-off budgets aren't taken out of every month: ${plan.oneOffBudgets.join(', ')}. Set money aside for them from what's left.`}
            </Text>
          ) : null}
          {plan.noPayment.length ? (
            <Text variant="label" family="regular" color="inkMuted">
              {`Not counted: ${plan.noPayment.join(', ')}. Add a payment amount under Debts.`}
            </Text>
          ) : null}
          <Text variant="caption" color="inkMuted">
            A suggestion from what you entered, not financial advice. It doesn't move any money, and lenders may add fees or interest.
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}
