import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import { DARK } from '../constants/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanAmount(str) {
  if (str === null || str === undefined || str === '') return 0;
  const num = parseFloat(String(str).replace(/[₦,\s]/g, ''));
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseDate(str) {
  if (!str) return new Date().toLocaleDateString('en-NG');
  const s = String(str).trim();

  // Excel serial date number (e.g. 45678)
  if (/^\d{5}$/.test(s)) {
    try {
      const d = XLSX.SSF.parse_date_code(parseInt(s));
      if (d) {
        const day = String(d.d).padStart(2, '0');
        const mon = String(d.m).padStart(2, '0');
        return `${day}/${mon}/${d.y}`;
      }
    } catch(e) {}
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const mon = m1[2].padStart(2, '0');
    const yr  = m1[3].length === 2 ? `20${m1[3]}` : m1[3];
    return `${day}/${mon}/${yr}`;
  }

  // YYYY-MM-DD (ISO)
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;

  // DD Mon YYYY  e.g. "16 Apr 2026"
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const m3 = s.toLowerCase().match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/);
  if (m3) {
    const day = m3[1].padStart(2, '0');
    const mon = String(months[m3[2]] || 1).padStart(2, '0');
    return `${day}/${mon}/${m3[3]}`;
  }

  return new Date().toLocaleDateString('en-NG');
}

function detectCategory(desc) {
  const d = String(desc).toLowerCase();
  if (/food|eat|restaurant|shoprite|grocery|market|chicken|pizza|cafe/i.test(d))           return 'Food';
  if (/uber|bolt|transport|fuel|petrol|bus|ride|taxi/i.test(d))                            return 'Transport';
  if (/netflix|spotify|dstv|showmax|cinema|gaming|apple|google play/i.test(d))             return 'Entertainment';
  if (/electricity|nepa|ikedc|ekedc|water|airtime|data|mtn|glo|airtel|9mobile/i.test(d))  return 'Utilities';
  if (/hospital|pharmacy|health|doctor|clinic|medic/i.test(d))                            return 'Health';
  if (/savings|cowrywise|piggyvest|piggy|save/i.test(d))                                  return 'Savings';
  if (/salary|payroll|wages/i.test(d))                                                     return 'Income';
  if (/transfer|trf|sent|payment/i.test(d))                                                return 'Transfer';
  return 'Other';
}

// ── Find the real header row (skip bank metadata at top) ─────────────────────
function findHeaderRowIndex(rows) {
  const keywords = ['date','credit','debit','amount','narration','description','balance','particulars'];
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    const cells = rows[i].map(c => String(c ?? '').toLowerCase().replace(/[^a-z]/g, ''));
    const hits  = keywords.filter(kw => cells.some(c => c.includes(kw)));
    if (hits.length >= 2) return i; // found a row with at least 2 known column names
  }
  return 0; // fallback
}

// ── Core parser — works on array-of-arrays (rows) ─────────────────────────────
function parseRows(rows) {
  if (!rows || rows.length < 2) return [];

  // Find the real header row (skips metadata lines at the top of bank exports)
  const headerIdx = findHeaderRowIndex(rows);

  // Normalise header row: lowercase, strip non-alpha chars
  const rawHeader = rows[headerIdx].map(h => String(h ?? '').toLowerCase().replace(/[^a-z]/g, ''));

  const col = (...names) => {
    for (const n of names) {
      const idx = rawHeader.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx   = col('date','valuedate','txdate','transdate','bookingdate','postingdate');
  const descIdx   = col('description','narration','details','particulars','remarks','ref','beneficiary','memo');
  const debitIdx  = col('debit','withdrawal','dr','withdraw');
  const creditIdx = col('credit','deposit','cr','lodgement');
  const amtIdx    = col('amount','transactionamount','value','transamt');
  const typeIdx   = col('type','txtype','transtype','drorcr','drcr','drcrflag','crdr');

  const transactions = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols = rows[i].map(c => String(c ?? '').trim());
    if (cols.every(c => !c)) continue; // skip blank rows

    const dateStr = dateIdx  >= 0 ? cols[dateIdx]  : '';
    const desc    = descIdx  >= 0 ? cols[descIdx]  : (cols.find(c => c.length > 5) || 'Bank Transaction');
    let debit     = debitIdx >= 0 ? cleanAmount(cols[debitIdx])  : 0;
    let credit    = creditIdx >= 0 ? cleanAmount(cols[creditIdx]) : 0;
    const typeStr = typeIdx  >= 0 ? (cols[typeIdx] || '').toLowerCase() : '';

    // Single amount column — use type col to decide direction
    if (debit === 0 && credit === 0 && amtIdx >= 0) {
      const amt = cleanAmount(cols[amtIdx]);
      if      (typeStr.includes('dr') || typeStr.includes('debit'))   debit  = amt;
      else if (typeStr.includes('cr') || typeStr.includes('credit'))  credit = amt;
      else                                                             debit  = amt;
    }

    const amount = debit > 0 ? debit : credit;
    if (amount < 10) continue;

    const type = credit > 0 && debit === 0 ? 'credit' : 'debit';
    const cat  = detectCategory(desc);

    transactions.push({
      id:        `import_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
      desc:      desc.slice(0, 60).trim() || 'Bank Transaction',
      amount:    Math.round(amount),
      type,
      cat:       type === 'credit' && cat === 'Other' ? 'Income' : cat,
      bank:      '',
      source:    'import',
      date:      parseDate(dateStr),
      timestamp: Date.now(),
    });
  }

  return transactions;
}

// ── CSV → rows ────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"')                   { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else                                   { current += line[i]; }
  }
  result.push(current.trim());
  return result;
}

function csvToRows(content) {
  return content.split(/\r?\n/).filter(l => l.trim()).map(l => parseCSVLine(l));
}

// ── XLSX/XLS → rows via SheetJS ───────────────────────────────────────────────
function xlsxToRows(base64Content) {
  const workbook = XLSX.read(base64Content, { type: 'base64', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BankImportScreen({ theme, navigation, onClose }) {
  const T = theme === 'dark' ? DARK : DARK;
  const s = styles(T);

  const [loading,   setLoading]   = useState(false);
  const [preview,   setPreview]   = useState(null);
  const [fileName,  setFileName]  = useState('');
  const [importing, setImporting] = useState(false);

  async function pickFile() {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) { setLoading(false); return; }

      const asset = result.assets[0];
      const name  = asset.name || 'statement';
      setFileName(name);

      // Read the file first
      const ext = name.split('.').pop().toLowerCase();
      let fileData = null;

      if (ext === 'xlsx' || ext === 'xls') {
        fileData = { type: 'xlsx', data: await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' }).catch(() => null) };
      } else {
        fileData = { type: 'csv',  data: await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8'   }).catch(() => null) };
      }

      if (!fileData.data) {
        Alert.alert('Cannot read file', 'Could not read this file. Try exporting as CSV from your bank app.');
        setLoading(false); return;
      }

      // Defer the heavy parsing so the loading spinner renders first
      setTimeout(() => {
        try {
          let rows = [];
          if (fileData.type === 'xlsx') {
            rows = xlsxToRows(fileData.data);
          } else {
            rows = csvToRows(fileData.data);
          }

          // Cap at 500 most recent to keep the app responsive
          const MAX = 500;
          const parsed = parseRows(rows).slice(0, MAX);

          if (!parsed.length) {
            Alert.alert(
              'No transactions found',
              'Could not extract transactions from this file.\n\nMake sure columns include: Date, Description, Debit/Credit or Amount.'
            );
            setLoading(false); return;
          }

          setPreview(parsed);
          setLoading(false);
        } catch (e) {
          setLoading(false);
          Alert.alert('Parse error', 'Could not read the file contents. Try exporting as CSV instead.');
        }
      }, 100); // 100ms delay lets the spinner render before heavy work starts

    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Could not open file. Please try a CSV or Excel (.xlsx) file from your bank.');
    }
  }

  async function confirmImport() {
    if (!preview?.length) return;
    try {
      setImporting(true);
      const raw      = await AsyncStorage.getItem('finsight_transactions');
      const existing = raw ? JSON.parse(raw) : [];
      const existingKeys = new Set(existing.map(t => `${t.amount}_${t.date}_${t.desc?.slice(0,10)}`));

      const toAdd = preview.filter(t => {
        const key = `${t.amount}_${t.date}_${t.desc?.slice(0,10)}`;
        return !existingKeys.has(key);
      });

      if (!toAdd.length) {
        Alert.alert('Already imported', 'All these transactions are already in your ledger.');
        setImporting(false); return;
      }

      await AsyncStorage.setItem('finsight_transactions', JSON.stringify([...toAdd, ...existing]));
      setImporting(false);
      setPreview(null);
      setFileName('');
      Alert.alert('✅ Imported!', `${toAdd.length} transaction${toAdd.length !== 1 ? 's' : ''} added to your ledger.`);
      if (onClose) onClose();
    } catch (e) {
      setImporting(false);
      Alert.alert('Import failed', e.message);
    }
  }

  const totalCredit = preview?.filter(t => t.type === 'credit').reduce((s,t) => s+t.amount, 0) || 0;
  const totalDebit  = preview?.filter(t => t.type === 'debit').reduce((s,t) => s+t.amount, 0) || 0;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose || (() => navigation?.goBack())} style={s.backBtn}>
          <Text style={{ color:T.text, fontSize:20 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={s.label}>IMPORT</Text>
          <Text style={s.title}>Bank Statement</Text>
        </View>
      </View>

      <ScrollView style={{ flex:1, paddingHorizontal:16 }} contentContainerStyle={{ paddingBottom:40 }}>

        {!preview ? (
          <>
            {/* Supported formats badge row */}
            <View style={[s.card, { marginBottom:16 }]}>
              <Text style={{ color:T.text, fontWeight:'800', fontSize:14, marginBottom:10 }}>
                Supported formats
              </Text>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
                {['📊 Excel .xlsx', '📄 CSV .csv', '📑 Text .txt'].map(f => (
                  <View key={f} style={{ backgroundColor:T.surface2, borderRadius:8, paddingHorizontal:10, paddingVertical:6 }}>
                    <Text style={{ color:T.lime, fontWeight:'700', fontSize:12 }}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Bank instructions */}
            <View style={[s.card, { marginBottom:20 }]}>
              <Text style={{ color:T.text, fontWeight:'800', fontSize:14, marginBottom:12 }}>
                How to get your statement
              </Text>
              {[
                { bank:'GTBank',   step:'App → Accounts → Statement → Download CSV/Excel' },
                { bank:'PalmPay',  step:'App → Me → Transaction History → Export' },
                { bank:'Fidelity', step:'Internet Banking → Reports → Download CSV' },
                { bank:'Access',   step:'App → More → Statement → Export' },
                { bank:'Kuda',     step:'App → Transactions → Export CSV' },
                { bank:'Any bank', step:'Internet banking → Statement → Download CSV or Excel' },
              ].map(({ bank, step }) => (
                <View key={bank} style={{ flexDirection:'row', marginBottom:8, gap:8 }}>
                  <Text style={{ color:T.lime, fontWeight:'800', minWidth:70, fontSize:12 }}>{bank}</Text>
                  <Text style={{ color:T.textMuted, flex:1, fontSize:12 }}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Pick file button */}
            {loading ? (
              <View style={{ alignItems:'center', paddingTop:20 }}>
                <ActivityIndicator color={T.lime} size="large" />
                <Text style={{ color:T.textMuted, marginTop:12 }}>Reading file...</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={pickFile} style={s.pickBtn}>
                <Text style={{ fontSize:36, marginBottom:8 }}>📂</Text>
                <Text style={{ color:'#0E120F', fontWeight:'900', fontSize:18 }}>Choose File</Text>
                <Text style={{ color:'#0E120F', opacity:0.7, fontSize:13, marginTop:4 }}>
                  Excel (.xlsx) or CSV — tap to browse
                </Text>
              </TouchableOpacity>
            )}

            <Text style={{ color:T.textMuted, fontSize:12, textAlign:'center', marginTop:20, lineHeight:18 }}>
              🔒 Your data stays on your phone — nothing is uploaded to any server.
            </Text>
          </>
        ) : (
          <>
            {/* Summary card */}
            <View style={[s.card, { marginBottom:16 }]}>
              <Text style={{ color:T.textMuted, fontSize:9, fontWeight:'700', letterSpacing:2.5, marginBottom:6 }}>
                {fileName}
              </Text>
              <Text style={{ color:T.text, fontSize:24, fontWeight:'900', letterSpacing:-0.5, marginBottom:14 }}>
                {preview.length} transactions found
              </Text>
              <View style={{ flexDirection:'row', gap:10 }}>
                <View style={{ flex:1, backgroundColor:(T.green||'#34D399')+'22', borderRadius:12, padding:12, borderWidth:1, borderColor:(T.green||'#34D399')+'44' }}>
                  <Text style={{ color:T.textMuted, fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:4 }}>CREDITS</Text>
                  <Text style={{ color:T.green||'#34D399', fontWeight:'800', fontSize:16, letterSpacing:-0.3 }}>+₦{totalCredit.toLocaleString()}</Text>
                </View>
                <View style={{ flex:1, backgroundColor:'#E5454518', borderRadius:12, padding:12, borderWidth:1, borderColor:'#E5454533' }}>
                  <Text style={{ color:T.textMuted, fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:4 }}>DEBITS</Text>
                  <Text style={{ color:'#E54545', fontWeight:'800', fontSize:16, letterSpacing:-0.3 }}>−₦{totalDebit.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Transaction preview list */}
            <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:10 }}>
              PREVIEW (first 20)
            </Text>
            {preview.slice(0, 20).map((tx, i) => (
              <View key={tx.id} style={[s.txRow, { borderTopWidth: i === 0 ? 0 : 1 }]}>
                <View style={{ flex:1 }}>
                  <Text style={{ color:T.text, fontWeight:'600', fontSize:13 }} numberOfLines={1}>
                    {tx.desc}
                  </Text>
                  <Text style={{ color:T.textMuted, fontSize:11, marginTop:2 }}>
                    {tx.date} · {tx.cat}
                  </Text>
                </View>
                <Text style={{ color: tx.type === 'credit' ? '#34D399' : '#F87171', fontWeight:'800', fontSize:14 }}>
                  {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                </Text>
              </View>
            ))}
            {preview.length > 20 && (
              <Text style={{ color:T.textMuted, textAlign:'center', marginTop:8, fontSize:12 }}>
                +{preview.length - 20} more transactions
              </Text>
            )}

            {/* Action buttons */}
            <View style={{ flexDirection:'row', gap:12, marginTop:24 }}>
              <TouchableOpacity onPress={() => { setPreview(null); setFileName(''); }}
                style={[s.btn, { flex:1, backgroundColor:T.surface }]}>
                <Text style={{ color:T.text, fontWeight:'700' }}>← Try Another</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmImport} disabled={importing}
                style={[s.btn, { flex:2, backgroundColor:T.lime }]}>
                {importing
                  ? <ActivityIndicator color="#0E120F" />
                  : <Text style={{ color:'#0E120F', fontWeight:'900', fontSize:15 }}>
                      Import {preview.length} Transactions
                    </Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe:    { flex:1, backgroundColor:T.bg },
  header:  { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingTop:16, paddingBottom:8, gap:12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
    justifyContent:'center', alignItems:'center',
  },
  label:   { color:T.textMuted, fontSize:9, fontWeight:'700', letterSpacing:2.5 },
  title:   { color:T.text, fontSize:26, fontWeight:'900', letterSpacing:-0.5 },
  card: {
    backgroundColor:T.surface, borderRadius:20, padding:18,
    borderWidth:1, borderColor:T.line,
    shadowColor:'#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.05, shadowRadius:8, elevation:2,
  },
  pickBtn: {
    backgroundColor: T.lime, borderRadius: 22,
    paddingVertical: 36, paddingHorizontal: 24,
    alignItems:'center', justifyContent:'center',
    shadowColor: '#6366F1', shadowOffset: {width:0,height:4},
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  txRow: {
    paddingVertical:12, flexDirection:'row', alignItems:'center',
    gap:12, borderTopWidth:1, borderTopColor:T.line,
  },
  btn: { borderRadius: 16, padding: 16, alignItems:'center', justifyContent:'center' },
});
