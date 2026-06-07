import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, KeyboardAvoidingView, Platform, AppState, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { DARK, LIGHT, CAT_ICONS, CAT_COLORS } from '../constants/theme';
import { awardXP } from '../services/xpService';
import { trackEvent } from '../services/cloudSync';

const CATEGORIES  = ['Food','Transport','Entertainment','Utilities','Health','Savings','Income','Shopping','Other'];
const SOURCES     = ['All','Manual','SMS','Push'];

// ── Shared form — defined OUTSIDE component to prevent remount on every keystroke ──
function TxForm({ data, setData, T, s }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={[s.fieldLabel, { color: T.mute }]}>DESCRIPTION</Text>
        <TextInput
          style={[s.input, { backgroundColor: T.surface, borderColor: T.line, color: T.ink }]}
          placeholder="e.g. Shoprite groceries" placeholderTextColor={T.mute}
          value={data.desc} onChangeText={v => setData(d => ({ ...d, desc: v }))} autoFocus
        />
      </View>
      <View>
        <Text style={[s.fieldLabel, { color: T.mute }]}>AMOUNT (₦)</Text>
        <TextInput
          style={[s.input, { backgroundColor: T.surface, borderColor: T.line, color: T.limeDeep, fontSize: 28, fontWeight: '700' }]}
          placeholder="0" placeholderTextColor={T.mute}
          value={String(data.amount)} onChangeText={v => setData(d => ({ ...d, amount: v }))}
          keyboardType="numeric"
        />
      </View>
      <View>
        <Text style={[s.fieldLabel, { color: T.mute }]}>TYPE</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {['debit','credit'].map(t => (
            <TouchableOpacity key={t}
              style={[s.typeBtn, { borderColor: data.type===t ? T.lime : T.line, backgroundColor: data.type===t ? T.surface2 : T.surface }]}
              onPress={() => setData(d => ({ ...d, type: t }))}>
              <Text style={{ color: data.type===t ? T.lime : T.ink2, fontWeight:'700', fontSize:14 }}>
                {t === 'debit' ? '↓ Debit' : '↑ Credit'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View>
        <Text style={[s.fieldLabel, { color: T.mute }]}>CATEGORY</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat}
              style={[s.catPill, { borderColor: data.cat===cat ? T.lime : T.line, backgroundColor: data.cat===cat ? T.surface2 : T.surface }]}
              onPress={() => setData(d => ({ ...d, cat }))}>
              <Text style={{ fontSize:13, color: data.cat===cat ? T.lime : T.ink2, fontWeight:'500' }}>
                {CAT_ICONS[cat]} {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
const DATE_FILTERS = [
  { label: 'All time', key: 'all' },
  { label: 'This month', key: 'month' },
  { label: 'This week', key: 'week' },
  { label: 'Today', key: 'today' },
];

function isWithinRange(dateStr, key) {
  if (key === 'all') return true;
  // dateStr is like "18/05/2026" from toLocaleDateString('en-NG')
  const parts = dateStr?.split('/');
  if (!parts || parts.length < 3) return false;
  const txDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  const now = new Date();
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek  = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === 'today') return txDate >= startOfDay;
  if (key === 'week')  return txDate >= startOfWeek;
  if (key === 'month') return txDate >= startOfMonth;
  return true;
}

export default function TransactionsScreen({ theme, user }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const [transactions, setTransactions] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [dateFilter,   setDateFilter]   = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showAdd,  setShowAdd]  = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newTx,  setNewTx]  = useState({ desc:'', amount:'', type:'debit', cat:'Food' });
  const [editTx, setEditTx] = useState(null);
  const searchRef = useRef(null);
  const s = styles(T);

  async function load() {
    const raw = await AsyncStorage.getItem('finsight_transactions');
    setTransactions(raw ? JSON.parse(raw) : []);
  }

  useFocusEffect(useCallback(() => { load(); }, []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load(); });
    return () => sub.remove();
  }, []);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = transactions.filter(tx => {
    if (sourceFilter !== 'All' && tx.source !== sourceFilter.toLowerCase()) return false;
    if (!isWithinRange(tx.date, dateFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tx.desc?.toLowerCase().includes(q) ||
        tx.cat?.toLowerCase().includes(q) ||
        tx.bank?.toLowerCase().includes(q) ||
        String(tx.amount).includes(q)
      );
    }
    return true;
  });

  // ── Add ──────────────────────────────────────────────────────────────────────
  async function addTransaction() {
    if (!newTx.desc || !newTx.amount) return;
    const tx = {
      id: Date.now().toString(),
      desc: newTx.desc, amount: parseInt(newTx.amount),
      type: newTx.type, cat: newTx.cat,
      source: 'manual', date: new Date().toLocaleDateString('en-NG'),
    };
    const updated = [tx, ...transactions];
    await AsyncStorage.setItem('finsight_transactions', JSON.stringify(updated));
    setTransactions(updated);
    setNewTx({ desc:'', amount:'', type:'debit', cat:'Food' });
    setShowAdd(false);
    awardXP('tx_log');
    trackEvent('transactions_added').catch(() => {});
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(tx) {
    setEditTx({ ...tx, amount: String(tx.amount) });
    setShowEdit(true);
  }

  async function saveEdit() {
    if (!editTx.desc || !editTx.amount) return;
    const updated = transactions.map(t =>
      t.id === editTx.id ? { ...editTx, amount: parseInt(editTx.amount) } : t
    );
    await AsyncStorage.setItem('finsight_transactions', JSON.stringify(updated));
    setTransactions(updated);
    setShowEdit(false); setEditTx(null);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  function confirmDelete(tx) {
    Alert.alert('Delete Transaction', `Delete "${tx.desc}" (₦${tx.amount.toLocaleString()})?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = transactions.filter(t => t.id !== tx.id);
        await AsyncStorage.setItem('finsight_transactions', JSON.stringify(updated));
        setTransactions(updated);
      }},
    ]);
  }

  function onLongPress(tx) {
    Alert.alert(tx.desc, `₦${tx.amount.toLocaleString()} · ${tx.type} · ${tx.date}`, [
      { text: '✏️  Edit',   onPress: () => openEdit(tx) },
      { text: '🗑️  Delete', style: 'destructive', onPress: () => confirmDelete(tx) },
      { text: 'Cancel',    style: 'cancel' },
    ]);
  }

  const activeFilters = (searchQuery.trim() ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'All' ? 1 : 0);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.eyebrow, { color: T.mute }]}>LEDGER</Text>
          <Text style={[s.title, { color: T.ink }]}>Transactions</Text>
          <Text style={[s.sub, { color: T.mute }]}>{transactions.length} total · {filtered.length} shown</Text>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: T.lime }]} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[s.searchRow, { backgroundColor: T.surface, borderColor: T.line }]}>
        <Ionicons name="search-outline" size={16} color={T.mute} style={{ marginRight: 8 }} />
        <TextInput
          ref={searchRef}
          style={[s.searchInput, { color: T.ink }]}
          placeholder="Search by name, category, bank…"
          placeholderTextColor={T.mute}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
            <Ionicons name="close-circle" size={16} color={T.mute} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 42 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems:'center' }}>
        {DATE_FILTERS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setDateFilter(f.key)}
            style={[s.filterChip, { borderColor: T.line, backgroundColor: T.surface },
              dateFilter === f.key && { backgroundColor: T.limeDeep, borderColor: T.limeDeep }]}
            activeOpacity={0.7}>
            <Text style={[s.filterChipText, { color: T.mute },
              dateFilter === f.key && { color: '#fff' }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ width: 1, height: 16, backgroundColor: T.line, marginHorizontal: 4 }} />
        {SOURCES.map(f => (
          <TouchableOpacity key={f} onPress={() => setSourceFilter(f)}
            style={[s.filterChip, { borderColor: T.line, backgroundColor: T.surface },
              sourceFilter === f && { backgroundColor: T.ink, borderColor: T.ink }]}
            activeOpacity={0.7}>
            <Text style={[s.filterChipText, { color: T.mute },
              sourceFilter === f && { color: T.lime }]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Active filter summary */}
      {activeFilters > 0 && (
        <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, marginTop:6, gap:8 }}>
          <Text style={{ color: T.mute, fontSize:11 }}>{filtered.length} result{filtered.length!==1?'s':''}</Text>
          <TouchableOpacity onPress={() => { setSearchQuery(''); setDateFilter('all'); setSourceFilter('All'); }}
            style={{ backgroundColor: T.rose+'22', paddingHorizontal:10, paddingVertical:3, borderRadius:999 }}>
            <Text style={{ color: T.rose, fontSize:11, fontWeight:'700' }}>Clear all filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Transaction list */}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>
              {searchQuery || dateFilter !== 'all' ? '🔍' : '📭'}
            </Text>
            <Text style={[s.emptyText, { color: T.mute }]}>
              {searchQuery
                ? `No results for "${searchQuery}"`
                : dateFilter !== 'all'
                ? `No transactions in this period`
                : 'No transactions yet.\nAdd one or import from SMS.'}
            </Text>
            {(searchQuery || dateFilter !== 'all') && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setDateFilter('all'); setSourceFilter('All'); }}
                style={{ marginTop: 14, backgroundColor: T.limeDeep, paddingHorizontal:20, paddingVertical:10, borderRadius:12 }}>
                <Text style={{ color:'#fff', fontWeight:'700' }}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[s.list, { backgroundColor: T.surface }]}>
            {filtered.map((tx, i) => (
              <TouchableOpacity
                key={tx.id || i}
                onLongPress={() => onLongPress(tx)}
                delayLongPress={350}
                activeOpacity={0.75}
                style={[s.txRow, {
                  borderBottomColor: T.line,
                  borderBottomWidth: i < filtered.length - 1 ? StyleSheet.hairlineWidth : 0,
                }]}
              >
                <View style={[s.txStripe, { backgroundColor: tx.type === 'credit' ? T.green : T.rose }]} />
                <View style={[s.txIcon, { backgroundColor: tx.type === 'credit' ? T.green+'22' : T.rose+'1A' }]}>
                  <Text style={{ fontSize: 20 }}>{CAT_ICONS[tx.cat] || '📦'}</Text>
                </View>
                <View style={{ flex:1, minWidth:0 }}>
                  <Text style={[s.txName, { color: T.ink }]} numberOfLines={1}>{tx.desc}</Text>
                  <View style={s.txMeta}>
                    <View style={[s.badge, { backgroundColor: T.surface2, borderColor: T.line }]}>
                      <Text style={[s.badgeText, { color: T.mute }]}>
                        {tx.source === 'sms' ? 'SMS' : tx.source === 'push' ? 'Push' : 'Manual'}
                      </Text>
                    </View>
                    {tx.bank && (
                      <View style={[s.badge, { backgroundColor: T.surface2, borderColor: T.line }]}>
                        <Text style={[s.badgeText, { color: T.mute }]}>{tx.bank}</Text>
                      </View>
                    )}
                    <Text style={[s.txDate, { color: T.mute2 }]}>{tx.date}</Text>
                  </View>
                </View>
                <View style={{ alignItems:'flex-end', flexShrink:0 }}>
                  <Text style={[s.txAmt, { color: tx.type === 'credit' ? T.green : T.rose }]}>
                    {tx.type === 'credit' ? '+' : '−'}₦{tx.amount.toLocaleString()}
                  </Text>
                  <View style={[s.catBadge, { backgroundColor: T.surface2, borderColor: T.line }]}>
                    <Text style={[s.txCat, { color: T.mute }]}>{tx.cat}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Add Modal ──────────────────────────────────────────────────────────── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1, backgroundColor:T.bg }}>
          <View style={[s.modalHeader, { borderBottomColor: T.line }]}>
            <Text style={[s.modalTitle, { color: T.ink }]}>New Transaction</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={[s.modalClose, { color: T.mute }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <TxForm data={newTx} setData={setNewTx} T={T} s={s} />
          <View style={[s.modalFooter, { borderTopColor: T.line }]}>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: T.lime }]} onPress={addTransaction}>
              <Text style={s.saveBtnText}>Add Transaction</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Modal ─────────────────────────────────────────────────────────── */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1, backgroundColor:T.bg }}>
          <View style={[s.modalHeader, { borderBottomColor: T.line }]}>
            <TouchableOpacity onPress={() => { setShowEdit(false); if (editTx) confirmDelete(transactions.find(t=>t.id===editTx.id)||editTx); }}
              style={{ paddingVertical:4, paddingHorizontal:2 }}>
              <Text style={{ color: T.rose, fontWeight:'700', fontSize:14 }}>🗑️ Delete</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: T.ink }]}>Edit Transaction</Text>
            <TouchableOpacity onPress={() => setShowEdit(false)}>
              <Text style={[s.modalClose, { color: T.mute }]}>✕</Text>
            </TouchableOpacity>
          </View>
          {editTx && <TxForm data={editTx} setData={setEditTx} T={T} s={s} />}
          <View style={[s.modalFooter, { borderTopColor: T.line }]}>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: T.lime }]} onPress={saveEdit}>
              <Text style={s.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start',
    paddingHorizontal:20, paddingTop:18, paddingBottom:10,
  },
  eyebrow: { fontSize:9, letterSpacing:2.5, fontWeight:'700', marginBottom:4 },
  title:   { fontSize:28, fontWeight:'800', letterSpacing:-0.8 },
  sub:     { fontSize:12, marginTop:4, fontWeight:'500' },
  addBtn:  { borderRadius:14, paddingHorizontal:18, paddingVertical:11, marginTop:8, elevation:3 },
  addBtnText: { color:'#0E120F', fontWeight:'800', fontSize:14 },

  searchRow: {
    flexDirection:'row', alignItems:'center',
    marginHorizontal:16, marginBottom:8,
    borderRadius:14, borderWidth:1, paddingHorizontal:14, paddingVertical:10,
  },
  searchInput: { flex:1, fontSize:14, fontWeight:'500', padding:0 },

  filterChip: {
    paddingHorizontal:13, paddingVertical:6, borderRadius:999, borderWidth:1,
    height:30, justifyContent:'center', alignItems:'center',
  },
  filterChipText: { fontSize:12, fontWeight:'700' },

  empty: { alignItems:'center', paddingVertical:60 },
  emptyText: { textAlign:'center', fontSize:14, lineHeight:22 },
  list: { borderRadius:20, overflow:'hidden', borderWidth:1, borderColor:T.line },

  txRow: { flexDirection:'row', alignItems:'center', paddingVertical:14, paddingRight:16, gap:12 },
  txStripe: { width:3, alignSelf:'stretch', borderRadius:0 },
  txIcon: { width:44, height:44, borderRadius:13, justifyContent:'center', alignItems:'center' },
  txName: { fontSize:14, fontWeight:'600', marginBottom:4, letterSpacing:-0.1 },
  txMeta: { flexDirection:'row', gap:5, alignItems:'center', flexWrap:'wrap' },
  txDate: { fontSize:10, fontWeight:'500' },
  txAmt:  { fontSize:15, fontWeight:'800', letterSpacing:-0.3 },
  catBadge: { paddingHorizontal:7, paddingVertical:2, borderRadius:6, borderWidth:1, marginTop:4 },
  txCat: { fontSize:10, fontWeight:'600' },
  badge: { paddingHorizontal:7, paddingVertical:2, borderRadius:999, borderWidth:1 },
  badgeText: { fontSize:10, fontWeight:'600' },

  modalHeader: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingHorizontal:20, paddingVertical:18, borderBottomWidth:1,
  },
  modalTitle:  { fontSize:20, fontWeight:'800', letterSpacing:-0.3 },
  modalClose:  { fontSize:20, padding:4 },
  fieldLabel:  { fontSize:10, letterSpacing:2.5, fontWeight:'700', marginBottom:8 },
  input:       { borderWidth:1, borderRadius:14, padding:16, fontSize:16, fontWeight:'500' },
  typeBtn:     { flex:1, borderWidth:1, borderRadius:14, padding:14, alignItems:'center' },
  catPill:     { paddingHorizontal:12, paddingVertical:8, borderRadius:12, borderWidth:1 },
  modalFooter: { padding:20, borderTopWidth:1 },
  saveBtn:     { borderRadius:16, padding:17, alignItems:'center' },
  saveBtnText: { color:'#0E120F', fontWeight:'800', fontSize:16 },
});
