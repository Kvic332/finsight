import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, CategoryTile, ConfirmSheet, EmptyState, Icon, Money, Text, tapFeedback, useTheme, useToast,
} from '../components/ui';
import { parseTxDate } from '../services/finance';
import { formatDayLabel, formatMoney } from '../services/format';
import { loadTransactions, saveTransactions } from '../services/transactions';
import { applyReview, suspectTransactions } from '../services/transactionReview';

function SuspectRow({ item, selected, onToggle }) {
  const { c } = useTheme();
  const { tx, reason } = item;
  const money = tx.type === 'credit' ? tx.amount : -tx.amount;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${tx.desc}, ${formatMoney(tx.amount)}. ${reason}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
        borderRadius: radius.md, borderWidth: 1, borderColor: selected ? c.accent : c.line,
        backgroundColor: pressed ? c.sunken : c.surface,
      })}
    >
      <Icon name={selected ? 'checkbox' : 'square-outline'} size={24} color={selected ? 'accent' : 'inkSubtle'} />
      <CategoryTile category={tx.cat} size={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyStrong" family="semibold" numberOfLines={2}>{tx.desc}</Text>
        <Text variant="caption" color="inkMuted" numberOfLines={1}>{`${formatDayLabel(parseTxDate(tx.date) || undefined)} · ${tx.cat}`}</Text>
        <Text variant="caption" color="warning">{reason}</Text>
        <Text variant="caption" family="semibold" color={selected ? 'ink' : 'inkMuted'}>
          {item.action === 'fix' ? `Fix: ${item.change}` : 'Remove'}
        </Text>
      </View>
      <Money value={money} family="bold" tone="auto" showSign={money > 0} />
    </Pressable>
  );
}

export default function ReviewTransactionsScreen({ navigation }) {
  const toast = useToast();
  // Keeps the button above the phone's navigation buttons.
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(false);

  useFocusEffect(useCallback(() => {
    loadTransactions()
      .then(list => {
        const found = suspectTransactions(list);
        setItems(found);
        // Everything starts ticked; untick anything that's real.
        setSelected(new Set(found.map(i => i.tx.id)));
      })
      .catch(() => toast.show("Couldn't load your transactions. Try again.", { tone: 'error' }));
  }, [toast]));

  function toggle(id) {
    tapFeedback();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const count = n => (n === 1 ? '1 transaction' : `${n} transactions`);

  async function finish() {
    setConfirming(false);
    try {
      const list = await loadTransactions();
      const chosen = items.filter(i => selected.has(i.tx.id));
      const removeIds = chosen.filter(i => i.action === 'remove').map(i => i.tx.id);
      const fixes = Object.fromEntries(chosen.filter(i => i.action === 'fix').map(i => [i.tx.id, i.changes]));
      const keep = items.filter(i => !selected.has(i.tx.id)).map(i => i.tx.id);
      await saveTransactions(applyReview(list, removeIds, keep, fixes));
      const done = [
        removeIds.length ? `${count(removeIds.length)} removed` : null,
        Object.keys(fixes).length ? `${count(Object.keys(fixes).length)} fixed` : null,
      ].filter(Boolean).join(', ');
      toast.show(done || 'Marked as checked', { tone: 'success' });
      navigation.goBack();
    } catch (e) {
      toast.show("Couldn't save this. Nothing was changed.", { tone: 'error' });
    }
  }

  if (!items) return null;

  if (!items.length) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.xl }}>
        <EmptyState icon="checkmark-circle-outline" title="Nothing looks wrong" body="None of your imported transactions look like adverts, failed payments, balance warnings or money saved the wrong way round." />
      </ScrollView>
    );
  }

  const removing = items.filter(i => selected.has(i.tx.id) && i.action === 'remove');
  const fixing = items.filter(i => selected.has(i.tx.id) && i.action === 'fix');
  const removingTotal = removing.reduce((sum, i) => sum + i.tx.amount, 0);
  const buttonTitle = removing.length && fixing.length
    ? `Remove ${removing.length}, fix ${fixing.length}`
    : removing.length ? `Remove ${removing.length} selected`
    : fixing.length ? `Fix ${fixing.length} selected`
    : "Keep all, they're right";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.sm }}>
        <Text color="inkMuted" style={{ marginBottom: space.sm }}>
          {`FinSight found ${count(items.length)} that look wrong. Adverts, failed payments and warnings can be removed, because no money moved. Money saved the wrong way round can be fixed. Untick anything that's right as it is.`}
        </Text>
        {items.map(item => (
          <SuspectRow key={item.tx.id} item={item} selected={selected.has(item.tx.id)} onToggle={() => toggle(item.tx.id)} />
        ))}
      </ScrollView>
      <View style={{ padding: space.xl, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom + space.sm, space.xl), gap: space.xs }}>
        <Button
          full
          variant={removing.length ? 'danger' : 'primary'}
          title={buttonTitle}
          // Only removing needs a second check; a fix can be changed back by editing.
          onPress={() => (removing.length ? setConfirming(true) : finish())}
        />
      </View>
      <ConfirmSheet
        visible={confirming}
        destructive
        title={`Remove ${count(removing.length)}?`}
        body={`They total ${formatMoney(removingTotal)}.${fixing.length ? ` ${count(fixing.length)} will also be fixed.` : ''} Your totals, savings and Broke Clock will update. Removing can't be undone, unless you restore a cloud backup made before now.`}
        confirmLabel="Remove transactions"
        onConfirm={finish}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}
