import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { fontFamily, radius, space, type } from '../constants/tokens';
import {
  Button, Card, CategoryTile, EmptyState, Icon, Money, Text, tapFeedback, useTheme, useToast,
} from '../components/ui';
import { newImports } from '../services/alerts';
import { withRememberedCategories } from '../services/payeeRuleStore';
import { formatMoney } from '../services/format';
import { parseSMS } from '../services/smsParser';
import { loadTransactions, saveTransactions } from '../services/transactions';
import { awardXP } from '../services/xpService';
import { trackEvent } from '../services/cloudSync';

const PLACEHOLDER = 'Paste your bank alerts here. Leave a blank line between messages.';

function Steps({ current }) {
  return (
    <View accessible accessibilityLabel={`Step ${current + 1} of 3`} style={{ flexDirection: 'row', gap: space.xs }}>
      {['Paste', 'Review', 'Done'].map((label, i) => (
        <View key={label} style={{ flex: 1, gap: space.xs }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= current ? '#C4124F' : '#DCD3D9' }} />
          <Text variant="caption" family={i === current ? 'bold' : 'regular'} color={i === current ? 'ink' : 'inkMuted'}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function SMSScreen({ navigation }) {
  const { c } = useTheme();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState([]);
  const [selected, setSelected] = useState([]);
  const [added, setAdded] = useState(0);
  const [skipped, setSkipped] = useState(0);

  function review() {
    if (!text.trim()) { setError('Paste your bank alerts first'); return; }
    const results = parseSMS(text);
    if (!results.length) { setError("We couldn't find any transactions. Check these are bank alerts, with a blank line between each one."); return; }
    setError('');
    setParsed(results);
    setSelected(results.map(r => r.id));
    setStep(1);
  }

  async function confirmImport() {
    try {
      const existing = await loadTransactions();
      const chosen = parsed.filter(p => selected.includes(p.id));
      const fresh = await withRememberedCategories(newImports(existing, chosen));
      await saveTransactions([...fresh, ...existing]);
      setAdded(fresh.length);
      setSkipped(chosen.length - fresh.length);
      if (fresh.length) {
        awardXP('sms_import');
        trackEvent('sms_imports').catch(() => {});
      }
      setStep(2);
    } catch (e) {
      toast.show("Couldn't save these transactions. Try again.", { tone: 'error' });
    }
  }

  function restart() {
    setText('');
    setParsed([]);
    setSelected([]);
    setStep(0);
  }

  const allSelected = selected.length === parsed.length;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, paddingBottom: space.huge, gap: space.lg }}>
      <Steps current={step} />

      {step === 0 ? (
        <>
          <Text color="inkMuted">Copy bank alerts from your Messages app and paste them below. You'll check them before anything is saved.</Text>
          <View style={{ gap: space.xs }}>
            <TextInput
              accessibilityLabel="Bank alert messages"
              value={text}
              onChangeText={v => { setText(v); setError(''); }}
              placeholder={PLACEHOLDER}
              placeholderTextColor={c.inkSubtle}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 220, padding: space.lg, borderRadius: radius.md, borderWidth: error ? 2 : 1,
                borderColor: error ? c.negative : c.lineStrong, backgroundColor: c.surface, color: c.ink,
                fontFamily: fontFamily.regular, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight,
              }}
            />
            {error ? <Text variant="caption" color="negative" accessibilityLiveRegion="polite">{error}</Text> : null}
          </View>
          <Button full title="Find transactions" onPress={review} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading" family="bold" accessibilityRole="header">{parsed.length} found</Text>
            <Pressable onPress={() => setSelected(allSelected ? [] : parsed.map(p => p.id))} accessibilityRole="button" hitSlop={10}>
              <Text variant="label" family="semibold" color="accent">{allSelected ? 'Clear all' : 'Select all'}</Text>
            </Pressable>
          </View>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {parsed.map((tx, i) => {
              const on = selected.includes(tx.id);
              const money = tx.type === 'credit' ? tx.amount : -tx.amount;
              return (
                <Pressable
                  key={tx.id}
                  onPress={() => { tapFeedback(); setSelected(prev => (on ? prev.filter(id => id !== tx.id) : [...prev, tx.id])); }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${tx.desc}, ${formatMoney(money)}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2,
                    borderBottomWidth: i < parsed.length - 1 ? 1 : 0, borderBottomColor: c.line,
                  }}
                >
                  <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? 'accent' : 'inkSubtle'} />
                  <CategoryTile category={tx.cat} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyStrong" family="semibold" numberOfLines={1}>{tx.desc}</Text>
                    <Text variant="caption" color="inkMuted" numberOfLines={1}>{[tx.cat, tx.bank, tx.date].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Money value={money} family="bold" tone="auto" showSign={money > 0} />
                </Pressable>
              );
            })}
          </Card>
          <Button full title={`Import ${selected.length} ${selected.length === 1 ? 'transaction' : 'transactions'}`} disabled={!selected.length} onPress={confirmImport} />
          <Button full title="Back" variant="ghost" onPress={() => setStep(0)} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <EmptyState
            icon={added ? 'checkmark-circle-outline' : 'information-circle-outline'}
            title={added ? `${added} ${added === 1 ? 'transaction' : 'transactions'} imported` : 'Nothing new to import'}
            body={skipped ? `${skipped} ${skipped === 1 ? 'was' : 'were'} already in your activity, so we skipped ${skipped === 1 ? 'it' : 'them'}.` : 'Your figures have been updated.'}
          />
          <Button full title="See activity" onPress={() => navigation?.navigate('Main', { screen: 'Activity' })} />
          <Button full title="Import more" variant="ghost" onPress={restart} />
        </>
      ) : null}
    </ScrollView>
  );
}
