import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, radius, space } from '../constants/tokens';
import {
  Button, CategoryTile, Gradient, Icon, IconButton, Input, SegmentedControl, Sheet, Text, tapFeedback,
  useTheme,
} from '../components/ui';
import { computePaydayPlan } from '../services/finance';
import { formatMoney, parseAmount } from '../services/format';
import { addTransaction, loadTransactions, updateTransaction } from '../services/transactions';
import { awardXP } from '../services/xpService';
import { trackEvent } from '../services/cloudSync';

const OUT_CATEGORIES = ['Food', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Savings', 'Other'];
const IN_CATEGORIES = ['Income', 'Savings', 'Other'];

function Saved({ tx, user, isEdit, onDone }) {
  const { c } = useTheme();
  const [plan, setPlan] = useState(null);
  React.useEffect(() => { loadTransactions().then(list => setPlan(computePaydayPlan(user, list))).catch(() => {}); }, [user]);
  const impact = plan ? [
    [plan.cycle.hasPayday ? 'Left until payday' : 'Left this month', formatMoney(plan.left)],
    ...(plan.cycle.hasPayday ? [['Safe to spend a day', formatMoney(plan.safePerDay)]] : []),
    ...(plan.daysLeft !== null ? [['Broke Clock', plan.daysLeft >= 365 ? 'Over a year' : `${plan.daysLeft} days`]] : []),
  ] : [];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl + space.xs, gap: space.sm }}>
        <View style={{ alignItems: 'center', marginBottom: space.md }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Gradient style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="checkmark" size={36} color="#FFFFFF" />
            </Gradient>
          </View>
        </View>
        <Text variant="title" family="bold" align="center" accessibilityLiveRegion="polite">
          {isEdit ? 'Transaction updated' : 'Transaction saved'}
        </Text>
        <Text color="inkMuted" align="center">
          {formatMoney(tx.amount)} for {tx.desc} {isEdit ? 'is now in' : 'was added to'} {tx.cat}.
        </Text>
        {impact.length ? (
          <View style={{ backgroundColor: c.sunken, borderRadius: radius.lg, padding: space.lg + 2, gap: space.md, marginTop: space.lg }}>
            {impact.map(([a, b]) => (
              <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
                <Text variant="label" family="medium" color="inkMuted">{a}</Text>
                <Text variant="bodyStrong" family="bold" tabular>{b}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ padding: space.xl }}>
        <Button full title="Done" onPress={onDone} />
      </View>
    </SafeAreaView>
  );
}

export default function AddTransactionScreen({ navigation, route, user }) {
  const { c, scheme } = useTheme();
  const editing = route?.params?.tx || null;
  const [type, setType] = useState(editing?.type || 'debit');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [desc, setDesc] = useState(editing?.desc || '');
  const [cat, setCat] = useState(editing?.cat || 'Food');
  const [errors, setErrors] = useState({});
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(null);

  const categories = type === 'credit' ? IN_CATEGORIES : OUT_CATEGORIES;

  function changeType(next) {
    setType(next);
    if (next === 'credit' && !IN_CATEGORIES.includes(cat)) setCat('Income');
    if (next === 'debit' && !OUT_CATEGORIES.includes(cat)) setCat('Food');
  }

  async function save() {
    const value = parseAmount(amount);
    const nextErrors = {
      ...(value ? null : { amount: 'Enter an amount, like 5,000' }),
      ...(desc.trim() ? null : { desc: 'Say what this was for' }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const fields = { desc: desc.trim(), amount: value, type, cat };
    if (editing) {
      await updateTransaction(editing.id, fields);
    } else {
      await addTransaction(fields);
      awardXP('tx_log');
      trackEvent('transactions_added').catch(() => {});
    }
    setSaved(fields);
  }

  if (saved) return <Saved tx={saved} user={user} isEdit={!!editing} onDone={() => navigation.goBack()} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm }}>
          <IconButton icon="close" label="Close" onPress={() => navigation.goBack()} />
          <Text variant="bodyStrong" family="bold" accessibilityRole="header">{editing ? 'Edit transaction' : 'Add transaction'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: space.lg }}>
          <SegmentedControl
            value={type}
            onChange={changeType}
            options={[{ value: 'debit', label: 'Money out' }, { value: 'credit', label: 'Money in' }]}
          />

          <View style={{ alignItems: 'center', paddingVertical: space.md }}>
            <Text variant="label" family="medium" color="inkMuted">Amount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="display" family="bold" style={{ fontSize: 46, lineHeight: 60 }} color={amount ? 'ink' : 'inkSubtle'}>₦</Text>
              <TextInput
                accessibilityLabel="Amount in naira"
                value={amount}
                onChangeText={v => { setAmount(v); if (errors.amount) setErrors(e => ({ ...e, amount: undefined })); }}
                placeholder="0"
                placeholderTextColor={c.inkSubtle}
                keyboardType="numeric"
                autoFocus={!editing}
                maxFontSizeMultiplier={1.2}
                style={{
                  fontFamily: fontFamily.bold, fontSize: 46, color: c.ink, letterSpacing: -1,
                  width: Math.min(280, Math.max(1, amount.length) * 30 + 8), paddingVertical: 0,
                  fontVariant: ['tabular-nums'], outlineStyle: 'none',
                }}
              />
            </View>
            {errors.amount ? <Text variant="caption" color="negative" accessibilityLiveRegion="polite">{errors.amount}</Text> : null}
          </View>

          <Input
            label="Description"
            placeholder={type === 'credit' ? 'Salary' : 'Groceries'}
            value={desc}
            onChangeText={v => { setDesc(v); if (errors.desc) setErrors(e => ({ ...e, desc: undefined })); }}
            error={errors.desc}
            returnKeyType="done"
          />

          <View style={{ gap: space.xs }}>
            <Text variant="label">Category</Text>
            <Pressable
              onPress={() => { tapFeedback(); setPicking(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${cat}. Change category`}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 2,
                borderRadius: radius.md, borderWidth: 1, borderColor: c.lineStrong,
                backgroundColor: pressed ? c.sunken : c.surface,
              })}
            >
              <CategoryTile category={cat} size={36} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>{cat}</Text>
              <Icon name="chevron-forward" size={18} color="inkSubtle" />
            </Pressable>
          </View>
        </ScrollView>

        <View style={{ padding: space.xl, paddingTop: space.sm }}>
          <Button full title={editing ? 'Save changes' : 'Save transaction'} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Choose a category">
        <ScrollView style={{ maxHeight: 460 }}>
          {categories.map(option => {
            const on = option === cat;
            return (
              <Pressable
                key={option}
                onPress={() => { tapFeedback(); setCat(option); setPicking(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 2, marginBottom: space.xs,
                  borderRadius: radius.md, borderWidth: on ? 1.5 : 0, borderColor: c.accent,
                  backgroundColor: on ? c.accentSoft : pressed ? c.sunken : 'transparent',
                })}
              >
                <CategoryTile category={option} size={40} />
                <Text variant="bodyStrong" family="semibold" style={{ flex: 1 }}>{option}</Text>
                {on ? <Icon name="checkmark-circle" size={22} color="accent" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
}
