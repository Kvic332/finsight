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

  async function finish() {
    setConfirming(false);
    try {
      const list = await loadTransactions();
      const keep = items.filter(i => !selected.has(i.tx.id)).map(i => i.tx.id);
      await saveTransactions(applyReview(list, [...selected], keep));
      toast.show(selected.size
        ? `${selected.size === 1 ? '1 transaction' : `${selected.size} transactions`} removed`
        : 'Marked as checked', { tone: 'success' });
      navigation.goBack();
    } catch (e) {
      toast.show("Couldn't save this. Nothing was removed.", { tone: 'error' });
    }
  }

  if (!items) return null;

  if (!items.length) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.xl }}>
        <EmptyState icon="checkmark-circle-outline" title="Nothing looks wrong" body="None of your imported transactions look like adverts, failed payments or balance warnings." />
      </ScrollView>
    );
  }

  const removing = items.filter(i => selected.has(i.tx.id));
  const removingTotal = removing.reduce((sum, i) => sum + i.tx.amount, 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.sm }}>
        <Text color="inkMuted" style={{ marginBottom: space.sm }}>
          {`These ${items.length === 1 ? 'transaction was' : `${items.length} transactions were`} imported from messages that look like adverts, failed payments or balance warnings, so they may not be real money. Untick any that are real.`}
        </Text>
        {items.map(item => (
          <SuspectRow key={item.tx.id} item={item} selected={selected.has(item.tx.id)} onToggle={() => toggle(item.tx.id)} />
        ))}
      </ScrollView>
      <View style={{ padding: space.xl, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom + space.sm, space.xl), gap: space.xs }}>
        <Button
          full
          variant={selected.size ? 'danger' : 'primary'}
          title={selected.size ? `Remove ${selected.size} selected` : 'Keep all, they\'re real'}
          onPress={() => (selected.size ? setConfirming(true) : finish())}
        />
      </View>
      <ConfirmSheet
        visible={confirming}
        destructive
        title={`Remove ${removing.length === 1 ? '1 transaction' : `${removing.length} transactions`}?`}
        body={`They total ${formatMoney(removingTotal)}. Your totals, savings and Broke Clock will update. You can't undo this, unless you restore a cloud backup made before now.`}
        confirmLabel="Remove transactions"
        onConfirm={finish}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}
