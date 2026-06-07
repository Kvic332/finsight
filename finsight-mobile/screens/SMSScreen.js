import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT, CAT_ICONS } from '../constants/theme';

const BANKS = {
  'access': 'Access Bank', 'zenith': 'Zenith Bank', 'gtb': 'GTBank', 'gtbank': 'GTBank',
  'first bank': 'First Bank', 'firstbank': 'First Bank', 'uba': 'UBA',
  'fidelity': 'Fidelity Bank', 'sterling': 'Sterling Bank', 'kuda': 'Kuda Bank',
  'opay': 'OPay', 'palmpay': 'PalmPay', 'moniepoint': 'Moniepoint',
  'carbon': 'Carbon', 'wema': 'Wema Bank', 'stanbic': 'Stanbic IBTC',
  'polaris': 'Polaris Bank', 'union bank': 'Union Bank',
};

function detectBank(text) {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(BANKS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

// ── Only process genuine bank transaction SMS ─────────────────────────────────
function isBankTransaction(text) {
  // Must mention a known bank OR have bank-specific structural patterns
  const hasBankName = detectBank(text) !== null;
  const hasBankPattern = /\b(acct|a\/c|account\s*no|avail(?:able)?\s*bal|new\s*bal|bal[:\s]|trf|ref\s*no|trans(?:action)?\s*id|DR[:\s]|CR[:\s])\b/i.test(text);
  return hasBankName || hasBankPattern;
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  if (lower.includes('shoprite') || lower.includes('grocery') || lower.includes('market') || lower.includes('food') || lower.includes('eat')) return 'Food';
  if (lower.includes('uber') || lower.includes('bolt') || lower.includes('transport') || lower.includes('fuel') || lower.includes('petrol')) return 'Transport';
  if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('dstv') || lower.includes('showmax')) return 'Entertainment';
  if (lower.includes('electricity') || lower.includes('water') || lower.includes('nepa') || lower.includes('ikedc') || lower.includes('ekedc')) return 'Utilities';
  if (lower.includes('hospital') || lower.includes('pharmacy') || lower.includes('health') || lower.includes('doctor')) return 'Health';
  if (lower.includes('savings') || lower.includes('cowrywise') || lower.includes('piggyvest') || lower.includes('piggy')) return 'Savings';
  if (lower.includes('salary') || lower.includes('credit alert') || lower.includes('payment received')) return 'Income';
  return 'Other';
}

function parseSMS(text) {
  const results = [];
  // Split by blank line OR by common SMS separators
  const blocks = text
    .split(/\n\s*\n/)
    .flatMap(b => b.includes('Acct:') && b.split('Acct:').length > 2
      ? b.split('Acct:').filter(s => s.trim()).map(s => 'Acct:' + s)
      : [b])
    .filter(b => b.trim().length > 10);

  for (const block of blocks) {
    // ── Skip non-bank noise (Jumia, subscriptions, OTPs, promotions) ──────────
    if (!isBankTransaction(block)) continue;

    let amount = 0;
    let type = 'debit';
    let desc = '';

    // ── Structured format: CR:N100.00 / DR:N50,000 (Fidelity, GTBank SMS) ─────
    const crMatch = block.match(/\bCR[:\s]+N?\s*([\d,]+(?:\.\d{2})?)/i);
    const drMatch = block.match(/\bDR[:\s]+N?\s*([\d,]+(?:\.\d{2})?)/i);

    if (crMatch) {
      amount = parseInt(crMatch[1].replace(/,/g, ''));
      type = 'credit';
    } else if (drMatch) {
      amount = parseInt(drMatch[1].replace(/,/g, ''));
      type = 'debit';
    }

    // ── Description from Desc: field (Fidelity) ───────────────────────────────
    const descStructured = block.match(/\bDesc[:\s]+([^\n]+)/i);
    if (descStructured) desc = descStructured[1].trim().slice(0, 60);

    // ── Natural language patterns if structured didn't find amount ─────────────
    if (amount < 10) {
      const nlPatterns = [
        { re: /(?:debited?|withdrawn?|charged?|deducted)[^\dN₦]*[N₦]?\s*([\d,]+(?:\.\d{2})?)/i, type: 'debit' },
        { re: /(?:credited?|received?|funded)[^\dN₦]*[N₦]?\s*([\d,]+(?:\.\d{2})?)/i, type: 'credit' },
        { re: /[N₦]\s*([\d,]+(?:\.\d{2})?)/i, type: null },
        { re: /(?:amount|sum)[:\s]+([\d,]+(?:\.\d{2})?)/i, type: null },
        { re: /NGN\s*([\d,]+(?:\.\d{2})?)/i, type: null },
      ];

      for (const { re, type: t } of nlPatterns) {
        const m = block.match(re);
        if (m) {
          amount = parseInt(m[1].replace(/,/g, ''));
          if (t) type = t;
          break;
        }
      }

      // Override type from context keywords
      // Credit = money coming IN to your account
      if (/credit(?:ed)?|received|incoming|funded|salary|refund|topup|cashback|lodgement|inflow|deposit/i.test(block)) type = 'credit';
      // Debit = money going OUT of your account (including transfers you initiate)
      if (/debit(?:ed)?|withdrawn?|charged?|deducted|payment of|via pos|atm|\bsent\b|transfer(?:red)? to|trf to|send|transfer out/i.test(block)) type = 'debit';
    }

    if (amount < 10) continue;

    // ── Description fallback ───────────────────────────────────────────────────
    if (!desc) {
      const descMatch = block.match(/(?:at|from|to|for|narr?(?:ation)?)[:\s]+([^.\n,]+)/i)
        || block.match(/(?:ref|description)[:\s]+([^.\n,]+)/i);
      desc = descMatch
        ? descMatch[1].trim().slice(0, 60)
        : block.split('\n')[0].trim().slice(0, 60);
    }

    // ── Date from DT: field (Fidelity: DT:15/MAY/26) ─────────────────────────
    let date = new Date().toLocaleDateString('en-NG');
    const dtMatch = block.match(/\bDT[:\s]+(\d+)\/(\w+)\/(\d+)/i);
    if (dtMatch) {
      const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
      try {
        const yr = parseInt(dtMatch[3]) + (parseInt(dtMatch[3]) < 100 ? 2000 : 0);
        const mo = months[dtMatch[2].toUpperCase()];
        if (mo !== undefined) {
          date = new Date(yr, mo, parseInt(dtMatch[1])).toLocaleDateString('en-NG');
        }
      } catch (_) {}
    }

    results.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      desc: desc || 'SMS Transaction',
      amount,
      type,
      cat: detectCategory(block),
      bank: detectBank(block),
      source: 'sms',
      date,
      raw: block.trim(),
    });
  }

  return results;
}

export default function SMSScreen({ theme, user }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const [step, setStep] = useState(0); // 0=paste, 1=review, 2=done
  const [smsText, setSmsText] = useState('');
  const [parsed, setParsed] = useState([]);
  const [selected, setSelected] = useState([]);
  const s = styles(T);

  function handleParse() {
    if (!smsText.trim()) return Alert.alert('Empty', 'Please paste your SMS messages first');
    const results = parseSMS(smsText);
    if (results.length === 0) return Alert.alert('No transactions found', 'Make sure you paste bank alert SMS messages. Try separating each SMS with a blank line.');
    setParsed(results);
    setSelected(results.map(r => r.id));
    setStep(1);
  }

  async function handleImport() {
    const toImport = parsed.filter(p => selected.includes(p.id));
    const raw = await AsyncStorage.getItem('finsight_transactions');
    const existing = raw ? JSON.parse(raw) : [];
    const updated = [...toImport, ...existing];
    await AsyncStorage.setItem('finsight_transactions', JSON.stringify(updated));
    setParsed([]);
    setSmsText('');
    setSelected([]);
    setStep(2);
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Text style={[s.eyebrow, { color: T.mute }]}>IMPORT</Text>
        <Text style={[s.title, { color: T.ink }]}>SMS Import</Text>

        {/* Step indicators */}
        <View style={s.steps}>
          {['Paste', 'Review', 'Done'].map((label, i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <View style={[s.stepDot, { backgroundColor: i <= step ? T.lime : T.surface, borderColor: i <= step ? T.lime : T.line }]}>
                <Text style={[s.stepNum, { color: i <= step ? T.ink : T.mute }]}>{i + 1}</Text>
              </View>
              <Text style={[s.stepLabel, { color: i === step ? T.ink : T.mute }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Step 0: Paste */}
        {step === 0 && (
          <View style={{ gap: 16 }}>
            <View style={[s.infoBox, { backgroundColor: T.surface, borderColor: T.line }]}>
              <Text style={[s.infoTitle, { color: T.limeDeep }]}>📱 How to import</Text>
              <Text style={[s.infoText, { color: T.mute }]}>
                1. Open your Messages app{'\n'}
                2. Copy bank alert SMS messages{'\n'}
                3. Paste them below — we'll extract all transactions automatically
              </Text>
            </View>
            <TextInput
              style={[s.smsInput, { backgroundColor: T.surface, borderColor: T.line, color: T.ink }]}
              placeholder={'Paste your bank SMS alerts here...\n\nExample:\nYour account has been debited N50,000 at GTBank ATM...\n\nYour Zenith Bank account was credited N450,000 salary credit...'}
              placeholderTextColor={T.mute}
              value={smsText}
              onChangeText={setSmsText}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: T.lime }]}
              onPress={handleParse}
            >
              <Text style={s.primaryBtnText}>Parse SMS Messages →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 1: Review */}
        {step === 1 && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[s.reviewTitle, { color: T.ink }]}>{parsed.length} transactions found</Text>
              <TouchableOpacity onPress={() => setSelected(selected.length === parsed.length ? [] : parsed.map(p => p.id))}>
                <Text style={[s.selectAll, { color: T.limeDeep }]}>{selected.length === parsed.length ? 'Deselect all' : 'Select all'}</Text>
              </TouchableOpacity>
            </View>

            {parsed.map((tx, i) => (
              <TouchableOpacity
                key={tx.id}
                style={[s.txCard, { backgroundColor: T.surface, borderColor: selected.includes(tx.id) ? T.lime : T.line }]}
                onPress={() => toggleSelect(tx.id)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.checkbox, { backgroundColor: selected.includes(tx.id) ? T.lime : T.surface2, borderColor: selected.includes(tx.id) ? T.lime : T.line }]}>
                    {selected.includes(tx.id) && <Text style={{ fontSize: 12, color: T.ink, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <View style={[s.txIcon, { backgroundColor: tx.type === 'credit' ? T.limeDeep + '22' : T.surface2 }]}>
                    <Text style={{ fontSize: 18 }}>{CAT_ICONS[tx.cat] || '📦'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.txName, { color: T.ink }]} numberOfLines={1}>{tx.desc}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                      <Text style={[s.txMeta, { color: T.mute }]}>{tx.cat}</Text>
                      {tx.bank && <Text style={[s.txMeta, { color: T.mute }]}>· {tx.bank}</Text>}
                    </View>
                  </View>
                  <Text style={[s.txAmt, { color: tx.type === 'credit' ? T.limeDeep : T.rose }]}>
                    {tx.type === 'credit' ? '+' : '−'}₦{tx.amount.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[s.ghostBtn, { borderColor: T.line }]} onPress={() => setStep(0)}>
                <Text style={[s.ghostBtnText, { color: T.ink2 }]}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, { flex: 1, backgroundColor: selected.length > 0 ? T.lime : T.surface2 }]}
                onPress={handleImport}
                disabled={selected.length === 0}
              >
                <Text style={[s.primaryBtnText, { color: selected.length > 0 ? T.ink : T.mute }]}>
                  Import {selected.length} transactions →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <View style={[s.doneCard, { backgroundColor: T.surface }]}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
            <Text style={[s.doneTitle, { color: T.ink }]}>Imported successfully!</Text>
            <Text style={[s.doneSub, { color: T.mute }]}>Your transactions have been added to your dashboard. Check the Transactions tab to review them.</Text>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: T.lime, marginTop: 24 }]} onPress={() => { setStep(0); setSmsText(''); }}>
              <Text style={s.primaryBtnText}>Import More SMS</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 24 },
  steps: { flexDirection: 'row', marginBottom: 28, alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  stepNum: { fontSize: 13, fontWeight: '800' },
  stepLabel: { fontSize: 11, fontWeight: '600' },
  infoBox: { borderRadius: 16, padding: 18, borderWidth: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  infoText: { fontSize: 13, lineHeight: 22 },
  smsInput: { borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 13, minHeight: 180 },
  primaryBtn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryBtnText: { color: '#0E120F', fontWeight: '800', fontSize: 15 },
  ghostBtn: { borderWidth: 1, borderRadius: 14, padding: 16, alignItems: 'center', paddingHorizontal: 20 },
  ghostBtnText: { fontWeight: '600', fontSize: 14 },
  reviewTitle: { fontSize: 17, fontWeight: '700' },
  selectAll: { fontSize: 13, fontWeight: '600' },
  txCard: { borderRadius: 16, padding: 14, borderWidth: 1.5 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txName: { fontSize: 14, fontWeight: '500' },
  txMeta: { fontSize: 11 },
  txAmt: { fontSize: 14, fontWeight: '700' },
  doneCard: { borderRadius: 20, padding: 32, alignItems: 'center' },
  doneTitle: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  doneSub: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
