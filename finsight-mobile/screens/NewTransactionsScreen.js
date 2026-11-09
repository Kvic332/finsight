import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, CategoryTile, ConfirmSheet, EmptyState, Icon, Money, Sheet, Text, tapFeedback, useTheme, useToast,
} from '../components/ui';
import { parseTxDate } from '../services/finance';
import { formatDayLabel, formatMoney } from '../services/format';
import { rememberCategory } from '../services/payeeRuleStore';
import { loadTransactions, saveTransactions } from '../services/transactions';

import { BUSINESS_IN, BUSINESS_OUT, hasBusiness, OWN_ACCOUNTS, OWNER_PAY } from '../services/business';
import { transactionName } from '../services/txName';

const OUT_CATEGORIES = ['Food', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Savings', 'Debt', 'Transfer', OWN_ACCOUNTS, 'Other'];
const IN_CATEGORIES = ['Income', 'Savings', 'Transfer', OWN_ACCOUNTS, 'Other'];
// Business users can file an alert straight into the business.
const listsFor = user => (hasBusiness(user)
  ? { in: [...IN_CATEGORIES, ...BUSINESS_IN], out: [...OUT_CATEGORIES, ...BUSINESS_OUT.filter(c => c !== OWNER_PAY)] }
  : { in: IN_CATEGORIES, out: OUT_CATEGORIES });

export const isUnconfirmed = tx => !!tx.unconfirmed;

function Pill({ label, onPress, icon }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm + 2, paddingVertical: 6,
        borderRadius: radius.pill, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: pressed ? c.sunken : c.surface,
      })}
    >
      {icon ? <Icon name={icon} size={14} color="inkMuted" /> : null}
      <Text variant="caption" family="semibold">{label}</Text>
      <Icon name="chevron-down" size={12} color="inkSubtle" />
    </Pressable>
  );
}

function InboxRow({ tx, onCategory, onDirection, onConfirm, onRemove }) {
  const { c } = useTheme();
  const money = tx.type === 'credit' ? tx.amount : -tx.amount;
  return (
    <View style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <CategoryTile category={tx.cat} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" family="semibold" numberOfLines={2}>{transactionName(tx)}</Text>
          <Text variant="caption" color="inkMuted" numberOfLines={1}>
            {[formatDayLabel(parseTxDate(tx.date) || undefined), tx.bank].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Money value={money} family="bold" tone="auto" showSign={money > 0} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
        <Pill label={tx.cat} onPress={onCategory} />
        <Pill label={tx.type === 'credit' ? 'Money in' : 'Money out'} icon={tx.type === 'credit' ? 'arrow-down' : 'arrow-up'} onPress={onDirection} />
        {tx.ruleApplied ? <Text variant="caption" color="inkMuted">Category you chose before</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={onRemove} accessibilityRole="button" hitSlop={10}>
          <Text variant="label" family="semibold" color="inkMuted">Not a real payment</Text>
        </Pressable>
        <Pressable onPress={onConfirm} accessibilityRole="button" hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="checkmark-circle" size={18} color="accent" />
          <Text variant="label" family="semibold" color="accent">Looks right</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Transactions captured from bank alerts wait here until the user confirms them,
// so a wrong category or direction is caught before it skews the numbers.
export default function NewTransactionsScreen({ navigation, user }) {
  const lists = listsFor(user);
  const { c } = useTheme();
  const [showHow, setShowHow] = useState(false);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(null);
  const [picking, setPicking] = useState(null);
  const [removing, setRemoving] = useState(null);

  useFocusEffect(useCallback(() => {
    loadTransactions().then(setList).catch(() => toast.show("Couldn't load your transactions.", { tone: 'error' }));
  }, [toast]));

  async function update(id, changes) {
    const next = list.map(t => (t.id === id ? { ...t, ...changes } : t));
    setList(next);
    try { await saveTransactions(next); } catch (e) { toast.show("Couldn't save this. Try again.", { tone: 'error' }); }
  }

  async function chooseCategory(cat) {
    const tx = picking;
    setPicking(null);
    tapFeedback();
    await update(tx.id, { cat, unconfirmed: false, ruleApplied: false });
    await rememberCategory(tx.desc, cat);
    toast.show(`Saved as ${cat}. FinSight will remember this payee.`, { tone: 'success' });
  }

  function flipDirection(tx) {
    tapFeedback();
    const type = tx.type === 'credit' ? 'debit' : 'credit';
    const cats = type === 'credit' ? lists.in : lists.out;
    update(tx.id, { type, cat: cats.includes(tx.cat) ? tx.cat : type === 'credit' ? 'Income' : 'Other' });
  }

  async function remove() {
    const tx = removing;
    setRemoving(null);
    const next = list.filter(t => t.id !== tx.id);
    setList(next);
    try { await saveTransactions(next); toast.show('Removed'); } catch (e) { toast.show("Couldn't remove this. Try again.", { tone: 'error' }); }
  }

  async function confirmAll() {
    const next = list.map(t => (isUnconfirmed(t) ? { ...t, unconfirmed: false } : t));
    setList(next);
    try {
      await saveTransactions(next);
      toast.show('All confirmed', { tone: 'success' });
      navigation.goBack();
    } catch (e) { toast.show("Couldn't save this. Try again.", { tone: 'error' }); }
  }

  if (!list) return null;
  const pending = list.filter(isUnconfirmed);

  if (!pending.length) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.xl }}>
        <EmptyState icon="checkmark-done-outline" title="All caught up" body="New transactions from your bank alerts will appear here for a quick check." />
      </ScrollView>
    );
  }

  const cats = picking?.type === 'credit' ? lists.in : lists.out;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.sm }}>
        <View style={{ marginBottom: space.sm, gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text color="inkMuted" style={{ flex: 1 }}>From your bank alerts. Check each one.</Text>
            <Pressable onPress={() => setShowHow(v => !v)} accessibilityRole="button" hitSlop={12}
              accessibilityLabel={showHow ? 'Hide how this works' : 'How this works'}>
              <Icon name="information-circle-outline" size={20} color="inkMuted" />
            </Pressable>
          </View>
          {showHow ? (
            <Text variant="label" family="regular" color="inkMuted">
              Make sure the category and direction are right. Anything you change is remembered for that payee, so next time it's sorted for you.
            </Text>
          ) : null}
        </View>
        {pending.map(tx => (
          <InboxRow
            key={tx.id}
            tx={tx}
            onCategory={() => setPicking(tx)}
            onDirection={() => flipDirection(tx)}
            onConfirm={() => { tapFeedback(); update(tx.id, { unconfirmed: false }); }}
            onRemove={() => setRemoving(tx)}
          />
        ))}
      </ScrollView>
      <View style={{ padding: space.xl, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom + space.sm, space.xl) }}>
        <Button full title={pending.length === 1 ? 'Confirm it' : `Confirm all ${pending.length}`} onPress={confirmAll} />
      </View>

      <Sheet visible={!!picking} onClose={() => setPicking(null)} title="Choose a category">
        <ScrollView style={{ maxHeight: 420 }}>
          <View style={{ gap: space.xs }}>
            {cats.map(cat => (
              <Pressable
                key={cat}
                onPress={() => chooseCategory(cat)}
                accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 2, borderRadius: radius.md, backgroundColor: pressed ? c.sunken : 'transparent' })}
              >
                <CategoryTile category={cat} size={36} />
                <Text variant="bodyStrong" family="semibold" style={{ flex: 1 }}>{cat}</Text>
                {picking?.cat === cat ? <Icon name="checkmark-circle" size={22} color="accent" /> : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Sheet>
      <ConfirmSheet
        visible={!!removing}
        destructive
        title="Remove this transaction?"
        body={removing ? `${removing.desc}, ${formatMoney(removing.amount)}. Use this for alerts that weren't real payments. It can't be undone.` : ''}
        confirmLabel="Remove transaction"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}
