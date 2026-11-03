import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { space } from '../constants/tokens';
import {
  Button, Card, CategoryTile, IconButton, IconTile, Money, Text, useTheme, useToast,
} from '../components/ui';
import { newImports } from '../services/alerts';
import { formatMoney } from '../services/format';
import { csvToRows, parseRows, xlsxToRows } from '../services/statementParser';
import { loadTransactions, saveTransactions } from '../services/transactions';

const MAX_ROWS = 500;
const HOW_TO = [
  ['GTBank', 'App, then Accounts, then Statement'],
  ['PalmPay', 'App, then Me, then Transaction History'],
  ['Fidelity', 'Internet Banking, then Reports'],
  ['Access', 'App, then More, then Statement'],
  ['Kuda', 'App, then Transactions'],
  ['Any bank', 'Internet banking, then Statement'],
];

export default function BankImportScreen({ onClose }) {
  const { c } = useTheme();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  async function pickFile() {
    try {
      setError('');
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) { setLoading(false); return; }
      const asset = result.assets[0];
      const name = asset.name || 'statement';
      setFileName(name);
      const isExcel = /\.xlsx?$/i.test(name);
      const data = await FileSystem.readAsStringAsync(asset.uri, { encoding: isExcel ? 'base64' : 'utf8' }).catch(() => null);
      if (!data) {
        setError("We couldn't read this file. Try exporting it as CSV from your bank.");
        setLoading(false);
        return;
      }
      // Parsing a large file blocks the screen, so let the spinner draw first.
      setTimeout(() => {
        try {
          const parsed = parseRows(isExcel ? xlsxToRows(data) : csvToRows(data)).slice(0, MAX_ROWS);
          if (parsed.length) setPreview(parsed);
          else setError("We couldn't find any transactions. The file needs columns for date, description, and debit and credit or amount.");
        } catch (e) {
          setError("We couldn't read this file. Try exporting it as CSV from your bank.");
        }
        setLoading(false);
      }, 100);
    } catch (e) {
      setLoading(false);
      setError("We couldn't open this file. Try a CSV or Excel file from your bank.");
    }
  }

  async function confirmImport() {
    try {
      setImporting(true);
      const existing = await loadTransactions();
      const fresh = newImports(existing, preview);
      if (!fresh.length) {
        toast.show('These transactions are already in your activity.');
        setImporting(false);
        return;
      }
      await saveTransactions([...fresh, ...existing]);
      toast.show(`${fresh.length} ${fresh.length === 1 ? 'transaction' : 'transactions'} imported`, { tone: 'success' });
      setImporting(false);
      onClose?.();
    } catch (e) {
      setImporting(false);
      toast.show("Couldn't save these transactions. Try again.", { tone: 'error' });
    }
  }

  const moneyIn = preview?.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0) || 0;
  const moneyOut = preview?.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0) || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}>
        <IconButton icon="arrow-back" label="Back" onPress={onClose} />
        <Text variant="bodyStrong" family="bold" accessibilityRole="header">Upload a statement</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.lg }}>
        {!preview ? (
          <>
            <Card style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
              <IconTile name="document-text-outline" size={56} tone="accent" />
              <Text variant="heading" family="bold" align="center">Choose your statement</Text>
              <Text variant="label" family="regular" color="inkMuted" align="center">Excel or CSV. It's read on your phone, not uploaded anywhere.</Text>
              {error ? <Text variant="label" family="medium" color="negative" align="center" accessibilityLiveRegion="polite">{error}</Text> : null}
              <View style={{ alignSelf: 'stretch', marginTop: space.sm }}>
                {loading
                  ? <ActivityIndicator color={c.accent} accessibilityLabel="Reading your file" />
                  : <Button full title="Choose file" onPress={pickFile} />}
              </View>
            </Card>
            <View style={{ gap: space.sm }}>
              <Text variant="heading" family="bold" accessibilityRole="header">Where to find it</Text>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {HOW_TO.map(([bank, where], i) => (
                  <View key={bank} style={{ flexDirection: 'row', gap: space.md, padding: space.md + 2, borderBottomWidth: i < HOW_TO.length - 1 ? 1 : 0, borderBottomColor: c.line }}>
                    <Text variant="label" family="bold" style={{ width: 70 }}>{bank}</Text>
                    <Text variant="label" family="regular" color="inkMuted" style={{ flex: 1 }}>{where}</Text>
                  </View>
                ))}
              </Card>
            </View>
          </>
        ) : (
          <>
            <Card style={{ padding: space.xl }}>
              <Text variant="label" family="regular" color="inkMuted" numberOfLines={1}>{fileName}</Text>
              <Text variant="title" family="bold">{preview.length} transactions found</Text>
              <View style={{ flexDirection: 'row', gap: space.xl, marginTop: space.md }}>
                <View>
                  <Text variant="caption" color="inkMuted">Money in</Text>
                  <Money value={moneyIn} family="bold" tone="positive" showSign />
                </View>
                <View>
                  <Text variant="caption" color="inkMuted">Money out</Text>
                  <Text variant="bodyStrong" family="bold" tabular>{formatMoney(-moneyOut)}</Text>
                </View>
              </View>
            </Card>
            <Text variant="heading" family="bold" accessibilityRole="header">First few transactions</Text>
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {preview.slice(0, 8).map((tx, i, list) => {
                const money = tx.type === 'credit' ? tx.amount : -tx.amount;
                return (
                  <View key={tx.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: c.line }}>
                    <CategoryTile category={tx.cat} size={40} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyStrong" family="semibold" numberOfLines={1}>{tx.desc}</Text>
                      <Text variant="caption" color="inkMuted">{tx.date}</Text>
                    </View>
                    <Money value={money} family="bold" tone="auto" showSign={money > 0} />
                  </View>
                );
              })}
            </Card>
            <Button full title={`Import ${preview.length} transactions`} loading={importing} onPress={confirmImport} />
            <Button full title="Choose a different file" variant="ghost" onPress={() => { setPreview(null); setFileName(''); }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
