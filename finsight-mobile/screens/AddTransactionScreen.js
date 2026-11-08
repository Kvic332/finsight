import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, radius, space } from '../constants/tokens';
import {
  Button, CategoryTile, Chip, Gradient, Icon, IconButton, Input, SegmentedControl, Sheet, Text, tapFeedback,
  useTheme,
} from '../components/ui';
import { computePaydayPlan } from '../services/finance';
import { formatMoney, parseAmount } from '../services/format';
import { addTransaction, loadTransactions, updateTransaction } from '../services/transactions';
import { awardXP } from '../services/xpService';
import { trackEvent } from '../services/cloudSync';
import { detectCategory } from '../services/smsParser';
import Voice from '../services/voice';
import { parseSpokenTransaction } from '../services/voiceEntry';
import { rememberCategory } from '../services/payeeRuleStore';
import {
  CURRENCIES, FOREIGN_CURRENCIES, foreignFields, formatForeign, formatRate, isForeign, NAIRA, rateFor, walletBalance,
} from '../services/currency';
import { currentRates, loadWallets } from '../services/fxStore';
import {
  BUSINESS_IN, BUSINESS_OUT, hasBusiness, isBusinessTx, OWN_ACCOUNTS, OWNER_PAY,
} from '../services/business';

const OUT_CATEGORIES = ['Food', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Savings', OWN_ACCOUNTS, 'Other'];
const IN_CATEGORIES = ['Income', 'Savings', OWN_ACCOUNTS, 'Other'];
// Paying yourself is recorded from the Business screen, so both sides are saved together.
const BUSINESS_OUT_CHOICES = BUSINESS_OUT.filter(c => c !== OWNER_PAY);
const listFor = (kind, book) => (book === 'business'
  ? (kind === 'credit' ? BUSINESS_IN : BUSINESS_OUT_CHOICES)
  : (kind === 'credit' ? IN_CATEGORIES : OUT_CATEGORIES));

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
  const [type, setType] = useState(editing?.type || route?.params?.type || 'debit');
  const [currency, setCurrency] = useState(editing?.currency || NAIRA);
  const [amount, setAmount] = useState(editing ? String(isForeign(editing.currency) ? editing.originalAmount : editing.amount) : '');
  const [walletId, setWalletId] = useState(editing?.walletId || null);
  const [market, setMarket] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [allTx, setAllTx] = useState([]);
  const [choosingCurrency, setChoosingCurrency] = useState(false);
  const [desc, setDesc] = useState(editing?.desc || '');
  const showBook = hasBusiness(user) || (editing && isBusinessTx(editing));
  const [book, setBook] = useState(editing ? (isBusinessTx(editing) ? 'business' : 'personal') : route?.params?.book || (user?.usage === 'business' ? 'business' : 'personal'));
  const [cat, setCat] = useState(editing?.cat || (book === 'business' ? (type === 'credit' ? 'Sales' : 'Other business') : type === 'credit' ? 'Income' : 'Other'));
  // Until someone picks a category, by tap or voice, it follows the description.
  const [catChosen, setCatChosen] = useState(!!editing);
  const [errors, setErrors] = useState({});
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState(null);

  const categories = listFor(type, book);
  // The categories this person uses most for this kind of money, for one-tap picking.
  const quick = (() => {
    const counts = {};
    allTx.filter(t => t.type === type && categories.includes(t.cat) && t.cat !== 'Other')
      .forEach(t => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    const used = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return [...used, ...categories.filter(o => o !== 'Other' && !used.includes(o))].slice(0, 5);
  })();
  // Speech results arrive in a listener set up once, so it reads the latest values here.
  const latest = useRef({});
  latest.current = { categories, amount, desc };

  function guessCategory(text, kind, whichBook = book) {
    if (whichBook === 'business') return kind === 'credit' ? 'Sales' : 'Other business';
    const options = listFor(kind, whichBook);
    const guess = detectCategory(text || '');
    // "Other" is only a fallback guess: money coming in is most often income.
    if (kind === 'credit' && guess === 'Other') return 'Income';
    return options.includes(guess) ? guess : kind === 'credit' ? 'Income' : 'Other';
  }

  function changeType(next) {
    setType(next);
    if (!catChosen || !listFor(next, book).includes(cat)) setCat(guessCategory(desc, next));
  }

  function changeBook(next) {
    setBook(next);
    setCatChosen(false);
    setCat(guessCategory(desc, type, next));
  }

  function changeDesc(value) {
    setDesc(value);
    if (errors.desc) setErrors(e => ({ ...e, desc: undefined }));
    if (!catChosen) setCat(guessCategory(value, type));
  }

  function applySpoken(text) {
    const now = latest.current;
    const spoken = parseSpokenTransaction(text, now.categories);    if (spoken.cat) { setCat(spoken.cat); setCatChosen(true); }
    // Fills empty fields only, so speaking never overwrites what was typed.
    if (spoken.amount && !now.amount) setAmount(String(spoken.amount));
    if (spoken.desc && !now.desc.trim()) setDesc(spoken.desc);
    setHeard({ text, found: !!spoken.cat });
  }

  useEffect(() => {
    currentRates().then(saved => setMarket(saved?.rates || null)).catch(() => {});
    loadWallets().then(setWallets).catch(() => {});
    loadTransactions().then(setAllTx).catch(() => {});
  }, []);

  // An edited foreign transaction keeps the rate it was saved with, unless its
  // currency changes, so its history doesn't move with today's rate.
  const keptRate = editing && editing.currency === currency && editing.fxRate ? { [currency]: editing.fxRate } : null;
  const ownRates = keptRate || user?.fxOwnRates;
  const rate = isForeign(currency) ? rateFor(currency, market, ownRates) : null;
  const typed = parseAmount(amount);
  const sameCurrencyWallets = wallets.filter(w => w.currency === currency);

  function chooseCurrency(next) {
    setCurrency(next);
    setWalletId(null);
    setChoosingCurrency(false);
  }

  useEffect(() => {
    Voice.onSpeechResults = e => { setListening(false); applySpoken(e.value?.[0] || ''); };
    Voice.onSpeechEnd = () => setListening(false);
    Voice.onSpeechError = () => { setListening(false); setHeard({ text: '', found: false }); };
    // Some phones say no here yet still listen, so on Android the button always shows
    // and a real failure is reported when it's tapped.
    Voice.isAvailable()
      .then(available => setVoiceReady(!!available || Platform.OS === 'android'))
      .catch(() => setVoiceReady(Platform.OS === 'android'));
    return () => { Voice.destroy().then(Voice.removeAllListeners).catch(() => {}); };
  }, []);

  async function toggleVoice() {
    tapFeedback();
    if (listening) {
      try { await Voice.stop(); } catch (e) { /* already stopped */ }
      setListening(false);
      return;
    }
    setHeard(null);
    try {
      await Voice.start('en-US');
      setListening(true);
    } catch (e) {
      setHeard({ text: '', found: false, unavailable: true });
    }
  }

  let voiceNote = null;
  if (listening) voiceNote = 'Listening. Say a category, like food or transport.';
  else if (heard?.unavailable) voiceNote = "Voice isn't available on this phone. Choose a category instead.";
  else if (heard && !heard.found) voiceNote = heard.text ? `Heard "${heard.text}" but no category. Try again, or choose one.` : "Didn't catch that. Try again, or choose a category.";
  else if (heard) voiceNote = `Heard "${heard.text}"`;
  else if (!catChosen && desc.trim()) voiceNote = 'Picked from the description. Tap to change, or say it.';

  async function save() {
    const value = parseAmount(amount);
    const nextErrors = {
      ...(value ? null : { amount: 'Enter an amount, like 5,000' }),
      ...(value && isForeign(currency) && !rate ? { amount: "There's no exchange rate yet. Go online once, or set your own rate in Settings, Foreign money." } : null),
      ...(desc.trim() ? null : { desc: 'Say what this was for' }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const foreign = isForeign(currency) ? foreignFields(value, currency, market, ownRates) : null;
    // Switching back to naira clears the foreign details.
    const fields = foreign
      ? { desc: desc.trim(), type, cat, ...foreign, walletId: walletId || undefined }
      : {
        desc: desc.trim(), amount: value, type, cat,
        currency: undefined, originalAmount: undefined, fxRate: undefined, fxSource: undefined, walletId: undefined,
      };
    if (editing) {
      // Editing also confirms an imported transaction, and a changed category is
      // remembered for the next import from the same payee.
      await updateTransaction(editing.id, { ...fields, unconfirmed: false });
      if (editing.source !== 'manual' && cat !== editing.cat) await rememberCategory(fields.desc, cat);
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
          {showBook ? (
            <SegmentedControl
              value={book}
              onChange={changeBook}
              options={[{ value: 'personal', label: 'Personal' }, { value: 'business', label: 'Business' }]}
            />
          ) : null}
          <SegmentedControl
            value={type}
            onChange={changeType}
            options={[{ value: 'debit', label: book === 'business' ? 'Cost' : 'Money out' }, { value: 'credit', label: book === 'business' ? 'Sale or income' : 'Money in' }]}
          />

          <View style={{ alignItems: 'center', paddingVertical: space.md }}>
            <Text variant="label" family="medium" color="inkMuted">Amount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => { tapFeedback(); setChoosingCurrency(true); }}
                accessibilityRole="button"
                accessibilityLabel={`Currency: ${CURRENCIES[currency].name}. Change currency`}
                hitSlop={8}
              >
                <Text variant="display" family="bold" style={{ fontSize: currency === 'CAD' ? 30 : 46, lineHeight: 60 }} color={amount ? 'ink' : 'inkSubtle'}>{CURRENCIES[currency].symbol}</Text>
              </Pressable>
              <TextInput
                accessibilityLabel={`Amount in ${CURRENCIES[currency].plural}`}
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
            {errors.amount ? <Text variant="caption" color="negative" accessibilityLiveRegion="polite" align="center">{errors.amount}</Text> : null}
            {isForeign(currency) && rate && typed ? (
              <Text variant="label" family="medium" color="inkMuted" align="center">
                {`≈ ${formatMoney(Math.round(typed * rate.rate))} at ${formatRate(rate.rate)}, ${keptRate ? 'the rate it was saved with' : rate.source === 'own' ? 'your own rate' : 'the market rate'}`}
              </Text>
            ) : null}
            <Pressable onPress={() => { tapFeedback(); setChoosingCurrency(true); }} accessibilityRole="button" hitSlop={8}>
              <Text variant="caption" family="semibold" color="accent">{currency === NAIRA ? 'Paid in another currency?' : `In ${CURRENCIES[currency].plural}. Change`}</Text>
            </Pressable>
          </View>

          {isForeign(currency) && sameCurrencyWallets.length ? (
            <View style={{ gap: space.xs }}>
              <Text variant="label">{type === 'credit' ? 'Which account did it go into?' : 'Which account did it come from?'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {sameCurrencyWallets.map(w => (
                  <Chip key={w.id} label={`${w.name} · ${formatForeign(walletBalance(w, allTx), w.currency)}`} selected={walletId === w.id} onPress={() => setWalletId(walletId === w.id ? null : w.id)} />
                ))}
                <Chip label="None of these" selected={!walletId} onPress={() => setWalletId(null)} />
              </View>
            </View>
          ) : null}

          <Input
            label="Description"
            placeholder={book === 'business' ? (type === 'credit' ? 'What you sold' : 'Supplier or what you paid for') : type === 'credit' ? 'Salary' : 'Groceries'}
            value={desc}
            onChangeText={changeDesc}
            error={errors.desc}
            returnKeyType="done"
          />

          <View style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label">Category</Text>
              {voiceReady ? (
                <Pressable
                  onPress={toggleVoice}
                  accessibilityRole="button"
                  accessibilityLabel={listening ? 'Stop listening' : 'Say the category'}
                  hitSlop={10}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
                >
                  <Icon name={listening ? 'stop-circle' : 'mic'} size={18} color="accent" />
                  <Text variant="label" family="semibold" color="accent">{listening ? 'Stop' : 'Say it'}</Text>
                </Pressable>
              ) : null}
            </View>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
              {quick.map(option => (
                <Chip key={option} label={option} selected={option === cat}
                  onPress={() => { setCat(option); setCatChosen(true); setHeard(null); }} />
              ))}
            </View>
            {voiceNote ? (
              <Text variant="caption" color={heard && !heard.found ? 'negative' : 'inkMuted'} accessibilityLiveRegion="polite">{voiceNote}</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={{ padding: space.xl, paddingTop: space.sm }}>
          <Button full title={editing ? 'Save changes' : 'Save transaction'} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={choosingCurrency} onClose={() => setChoosingCurrency(false)} title="Currency">
        <Text variant="label" family="regular" color="inkMuted" style={{ marginBottom: space.sm }}>
          FinSight adds everything up in naira. Foreign money is converted at your own rate if you've set one, otherwise the market rate.
        </Text>
        {[NAIRA, ...FOREIGN_CURRENCIES].map(code => {
          const r = code === NAIRA ? null : rateFor(code, market, user?.fxOwnRates);
          return (
            <Pressable
              key={code}
              onPress={() => { tapFeedback(); chooseCurrency(code); }}
              accessibilityRole="button"
              accessibilityState={{ selected: code === currency }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginBottom: space.xs,
                borderRadius: radius.md, borderWidth: code === currency ? 1.5 : 0, borderColor: c.accent,
                backgroundColor: code === currency ? c.accentSoft : pressed ? c.sunken : 'transparent',
              })}
            >
              <Text variant="heading" family="bold" style={{ width: 52 }}>{CURRENCIES[code].symbol}</Text>
              <Text variant="bodyStrong" family="semibold" style={{ flex: 1 }}>{CURRENCIES[code].name}</Text>
              {r ? <Text variant="label" color="inkMuted">{formatRate(r.rate)}</Text> : null}
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Choose a category">
        <ScrollView style={{ maxHeight: 460 }}>
          {categories.map(option => {
            const on = option === cat;
            return (
              <Pressable
                key={option}
                onPress={() => { tapFeedback(); setCat(option); setCatChosen(true); setHeard(null); setPicking(false); }}
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
