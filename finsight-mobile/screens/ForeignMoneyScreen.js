import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '../services/dataStore';
import { space } from '../constants/tokens';
import {
  Badge, Button, Card, Chip, ConfirmSheet, EmptyState, IconTile, Input, ListRow, Sheet, Text, useToast,
} from '../components/ui';
import {
  convertFromWallet, CURRENCIES, FOREIGN_CURRENCIES, formatForeign, formatRate, nairaIncome, rateFor,
  setWalletBalance, toNaira, walletBalance, walletsInNaira,
} from '../services/currency';
import { currentRates, loadWallets, saveWallets } from '../services/fxStore';
import { formatMoney } from '../services/format';
import { loadTransactions } from '../services/transactions';
import { parseNumber } from '../services/catalogRules';

const updatedLabel = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

function OwnRateSheet({ currency, market, own, onClose, onSave }) {
  const [text, setText] = useState(own ? String(own) : '');
  const [error, setError] = useState('');
  function save(clear) {
    if (clear) { onSave(null); return; }
    const value = parseNumber(text);
    if (!(value >= 100 && value <= 20000)) { setError('Enter naira for one unit, like 1,550'); return; }
    onSave(value);
  }
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Your ${CURRENCIES[currency].name} rate`}
      footer={(
        <>
          <Button full title="Use my rate" onPress={() => save(false)} />
          {own ? <Button full title="Use the market rate instead" variant="ghost" onPress={() => save(true)} /> : null}
        </>
      )}
    >
      <View style={{ gap: space.md }}>
        <Text color="inkMuted">
          {`The rate you actually get, from your bank, Grey or a dealer. FinSight uses it for new ${CURRENCIES[currency].name} amounts instead of the market rate${market ? ` (${formatRate(market)})` : ''}.`}
        </Text>
        <Input label={`Naira for ${CURRENCIES[currency].symbol}1`} prefix="₦" keyboardType="decimal-pad" placeholder="1,550" value={text} error={error} onChangeText={v => { setText(v); setError(''); }} />
      </View>
    </Sheet>
  );
}

function WalletForm({ wallet, transactions, onClose, onSave, onDelete }) {
  const [name, setName] = useState(wallet?.name || '');
  const [currency, setCurrency] = useState(wallet?.currency || 'USD');
  const [balance, setBalance] = useState(wallet ? String(walletBalance(wallet, transactions)) : '');
  const [errors, setErrors] = useState({});
  function save() {
    const value = parseNumber(balance);
    const next = {
      ...(name.trim() ? null : { name: 'Name it, like Grey or Domiciliary' }),
      ...(value >= 0 && balance.trim() ? null : { balance: 'Enter what is in it now, like 800' }),
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    const base = wallet ? { ...wallet, name: name.trim(), currency } : { id: `w_${Date.now()}`, name: name.trim(), currency, opening: 0, conversions: [] };
    onSave(setWalletBalance(base, value, transactions));
  }
  return (
    <Sheet
      visible
      onClose={onClose}
      title={wallet ? `Edit ${wallet.name}` : 'Add a foreign account'}
      footer={(
        <>
          <Button full title={wallet ? 'Save changes' : 'Add account'} onPress={save} />
          {wallet ? <Button full title="Delete account" variant="ghost" onPress={onDelete} /> : null}
        </>
      )}
    >
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
        <Input label="Account name" placeholder="Grey, Payoneer, Domiciliary" value={name} error={errors.name} onChangeText={setName} />
        {!wallet ? (
          <View style={{ gap: space.xs }}>
            <Text variant="label">Currency</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {FOREIGN_CURRENCIES.map(code => <Chip key={code} label={`${CURRENCIES[code].symbol} ${CURRENCIES[code].name}`} selected={currency === code} onPress={() => setCurrency(code)} />)}
            </View>
          </View>
        ) : null}
        <Input label="What's in it now" prefix={CURRENCIES[currency].symbol} keyboardType="decimal-pad" placeholder="800" value={balance} error={errors.balance}
          hint="Check your app. After this, money in and out that you record for this account updates it." onChangeText={setBalance} />
      </ScrollView>
    </Sheet>
  );
}

function ConvertForm({ wallet, transactions, suggestedRate, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState(suggestedRate ? String(Math.round(suggestedRate)) : '');
  const [error, setError] = useState('');
  const balance = walletBalance(wallet, transactions);
  const value = parseNumber(amount);
  const rateValue = parseNumber(rate);
  function save() {
    const result = convertFromWallet(wallet, value, rateValue, transactions);
    if (result.error) { setError(result.error); return; }
    onSave(result);
  }
  return (
    <Sheet visible onClose={onClose} title={`Convert from ${wallet.name}`} footer={<Button full title="Record conversion" onPress={save} />}>
      <View style={{ gap: space.md }}>
        <Text color="inkMuted">{`You have ${formatForeign(balance, wallet.currency)}. Record money you changed to naira. It moves between your own accounts, so it isn't counted as income or spending.`}</Text>
        <Input label="Amount converted" prefix={CURRENCIES[wallet.currency].symbol} keyboardType="decimal-pad" placeholder="500" value={amount} onChangeText={v => { setAmount(v); setError(''); }} />
        <Input label={`Rate you got, naira for ${CURRENCIES[wallet.currency].symbol}1`} prefix="₦" keyboardType="decimal-pad" value={rate} onChangeText={v => { setRate(v); setError(''); }} />
        {value > 0 && rateValue > 0 ? <Text variant="bodyStrong" family="bold">{`You received about ${formatMoney(Math.round(value * rateValue))}`}</Text> : null}
        {error ? <Text variant="caption" color="negative" accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
    </Sheet>
  );
}

export default function ForeignMoneyScreen({ user, setUser }) {
  const toast = useToast();
  const [rates, setRates] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [form, setForm] = useState(null);
  const [converting, setConverting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load(force = false) {
    const [saved, w, t] = await Promise.all([currentRates({ force }), loadWallets(), loadTransactions()]);
    setRates(saved);
    setWallets(w);
    setTransactions(t);
  }
  useFocusEffect(useCallback(() => { load().catch(() => {}); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load(true).catch(() => {});
    setRefreshing(false);
  }

  const own = user?.fxOwnRates || {};
  const market = rates?.rates || {};

  async function saveOwnRate(currency, value) {
    const nextOwn = { ...own };
    if (value) nextOwn[currency] = value; else delete nextOwn[currency];
    const updated = { ...user, fxOwnRates: nextOwn };
    // Someone paid in this currency sees their income follow the new rate.
    if (updated.incomeCurrency === currency) updated.income = nairaIncome(updated, market);
    await AsyncStorage.setItem('finsight_user', JSON.stringify(updated));
    setUser(updated);
    setEditingRate(null);
    toast.show(value ? `Using your rate of ${formatRate(value)}` : 'Using the market rate', { tone: 'success' });
  }

  async function persistWallets(next) {
    await saveWallets(next);
    setWallets(next);
  }

  async function saveWallet(wallet) {
    const exists = wallets.some(w => w.id === wallet.id);
    await persistWallets(exists ? wallets.map(w => (w.id === wallet.id ? wallet : w)) : [...wallets, wallet]);
    setForm(null);
    toast.show(exists ? `${wallet.name} updated` : `${wallet.name} added`, { tone: 'success' });
  }

  async function saveConversion({ wallet, conversion }) {
    await persistWallets(wallets.map(w => (w.id === wallet.id ? wallet : w)));
    setConverting(null);
    toast.show(`${formatForeign(conversion.amount, wallet.currency)} converted, about ${formatMoney(conversion.naira)}`, { tone: 'success' });
  }

  async function removeWallet() {
    await persistWallets(wallets.filter(w => w.id !== deleting.id));
    setDeleting(null);
    setForm(null);
    toast.show('Account deleted');
  }

  const totalNaira = walletsInNaira(wallets, transactions, market, own);

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.md + 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="heading" family="bold">Exchange rates</Text>
        <Text variant="label" family="regular" color="inkMuted">
          {rates
            ? `Market rates, updated ${updatedLabel(rates.fetchedAt)}. If you get a different rate, set your own and FinSight will use it.`
            : "Couldn't get exchange rates yet. Pull down to try again once you're online."}
        </Text>
        <Card style={{ paddingVertical: space.xs }}>
          {FOREIGN_CURRENCIES.map((code, i) => {
            const r = rateFor(code, market, own);
            return (
              <ListRow
                key={code}
                leading={<Text variant="heading" family="bold" style={{ width: 44 }}>{CURRENCIES[code].symbol}</Text>}
                title={CURRENCIES[code].name}
                subtitle={own[code] ? `Your rate · market ${market[code] ? formatRate(market[code]) : 'not available'}` : 'Market rate'}
                value={r ? formatRate(r.rate) : '—'}
                divider={i < FOREIGN_CURRENCIES.length - 1}
                onPress={() => setEditingRate(code)}
              />
            );
          })}
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md }}>
          <Text variant="heading" family="bold">Foreign accounts</Text>
          {wallets.length ? <Button title="Add" variant="secondary" onPress={() => setForm({})} /> : null}
        </View>
        {wallets.length ? (
          <>
            <Text variant="label" family="regular" color="inkMuted">{`Worth about ${formatMoney(totalNaira)} at today's rates.`}</Text>
            {wallets.map(w => {
              const balance = walletBalance(w, transactions);
              const naira = toNaira(balance, w.currency, market, own)?.naira;
              return (
                <Card key={w.id} style={{ padding: space.lg, gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <IconTile name="wallet-outline" tone="accent" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyStrong" family="bold" numberOfLines={1}>{w.name}</Text>
                      <Text variant="label" family="regular" color="inkMuted">{naira !== undefined ? `About ${formatMoney(naira)}` : CURRENCIES[w.currency].name}</Text>
                    </View>
                    <Text variant="heading" family="bold">{formatForeign(balance, w.currency)}</Text>
                  </View>
                  {(w.conversions || []).length ? (
                    <Badge label={`Last converted ${formatForeign(w.conversions[w.conversions.length - 1].amount, w.currency)} at ${formatRate(w.conversions[w.conversions.length - 1].rate)}`} />
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <View style={{ flex: 1 }}><Button full title="Edit balance" variant="secondary" onPress={() => setForm({ wallet: w })} /></View>
                    <View style={{ flex: 1 }}><Button full title="Convert to ₦" onPress={() => setConverting(w)} /></View>
                  </View>
                </Card>
              );
            })}
          </>
        ) : (
          <EmptyState
            icon="wallet-outline"
            title="No foreign accounts yet"
            body="Add dollars in Grey, Payoneer or a domiciliary account to see them in naira, and record what you convert."
            action={<Button title="Add an account" onPress={() => setForm({})} />}
          />
        )}
      </ScrollView>

      {editingRate ? (
        <OwnRateSheet currency={editingRate} market={market[editingRate]} own={own[editingRate]} onClose={() => setEditingRate(null)} onSave={v => saveOwnRate(editingRate, v)} />
      ) : null}
      {form ? (
        <WalletForm wallet={form.wallet} transactions={transactions} onClose={() => setForm(null)} onSave={saveWallet} onDelete={() => setDeleting(form.wallet)} />
      ) : null}
      {converting ? (
        <ConvertForm wallet={converting} transactions={transactions} suggestedRate={rateFor(converting.currency, market, own)?.rate} onClose={() => setConverting(null)} onSave={saveConversion} />
      ) : null}
      <ConfirmSheet
        visible={!!deleting}
        title={`Delete ${deleting?.name}?`}
        body="Transactions you recorded for it stay in Activity. Only the account and its balance go."
        confirmLabel="Delete account"
        destructive
        onConfirm={removeWallet}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
