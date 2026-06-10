import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Alert, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { DARK, LIGHT } from '../constants/theme';

// ── Preset budget templates ──────────────────────────────────────────────────
const PRESETS = [
  { icon:'🍔', name:'Food',              cat:'Food'          },
  { icon:'🚗', name:'Transport',         cat:'Transport'     },
  { icon:'💡', name:'Utilities',         cat:'Utilities'     },
  { icon:'📱', name:'Data & Airtime',    cat:'Utilities'     },
  { icon:'🎬', name:'Netflix',           cat:'Entertainment' },
  { icon:'🎵', name:'Spotify',           cat:'Entertainment' },
  { icon:'📺', name:'DSTV',              cat:'Entertainment' },
  { icon:'🤖', name:'AI Subscription',   cat:'Entertainment' },
  { icon:'🎮', name:'Gaming',            cat:'Entertainment' },
  { icon:'🛍️', name:'Shopping',          cat:'Shopping'      },
  { icon:'🏥', name:'Health',            cat:'Health'        },
  { icon:'🏠', name:'Rent',              cat:'Other'         },
  { icon:'✈️', name:'Travel',            cat:'Other'         },
  { icon:'📚', name:'Education',         cat:'Other'         },
  { icon:'💰', name:'Savings',           cat:'Savings'       },
  { icon:'✏️', name:'Custom',            cat:'Other'         },
];

const EMOJI_LIST = ['🍔','🚗','💡','📱','🎬','🎵','📺','🤖','🎮','🛍️','🏥','🏠','✈️','📚','💰','🍺','☕','🎁','💊','🐾','🏋️','🎸','🧴','👗','💈'];

const STORAGE_KEY = 'finsight_budgets';

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// Robustly parse a date string (DD/MM/YYYY, M/D/YYYY, ISO, etc.) into a
// "YYYY-MM" month-key so we can compare against getMonthKey().
function parseTxMonthKey(txDate) {
  if (!txDate) return '';

  // ISO 8601  →  "2026-05-18" or "2026-05-18T..."
  if (/^\d{4}-\d{2}-\d{2}/.test(txDate)) {
    return txDate.slice(0, 7); // "2026-05"
  }

  // Slash-separated  →  "18/5/2026"  or  "5/18/2026"
  const parts = txDate.split('/');
  if (parts.length === 3) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    const yr = parts[2].length === 4 ? parts[2] : null;
    if (!yr) return '';

    // If first number > 12 it must be a day → DD/MM/YYYY
    // If second number > 12 it must be a day → MM/DD/YYYY
    // Otherwise default to DD/MM/YYYY (Nigerian locale)
    let month, day;
    if (a > 12) { day = a; month = b; }          // DD/MM/YYYY
    else if (b > 12) { month = a; day = b; }      // MM/DD/YYYY
    else { day = a; month = b; }                  // assume DD/MM/YYYY

    return `${yr}-${String(month).padStart(2, '0')}`;
  }

  return '';
}

// Sum transactions for the current month that match this budget item
function calcSpent(transactions, budget) {
  const monthKey = getMonthKey();

  const validKeywords = (budget.keywords || [])
    .map(k => (k || '').trim().toLowerCase())
    .filter(k => k.length >= 2);

  return transactions
    .filter(tx => {
      if (tx.type !== 'debit') return false;
      const txMonthKey = parseTxMonthKey(tx.date || '');
      if (txMonthKey !== monthKey) return false;
      const catMatch = (tx.cat || '').toLowerCase() === (budget.cat || '').toLowerCase();
      if (catMatch) return true;
      if (validKeywords.length === 0) return false;
      const desc = (tx.desc || '').toLowerCase();
      return validKeywords.some(k => desc.includes(k));
    })
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color, trackColor }) {
  const clamped = Math.min(pct, 100);
  return (
    <View style={{ height:8, backgroundColor: trackColor || '#2A2E27', borderRadius:99, overflow:'hidden', flex:1 }}>
      <View style={{ width:`${clamped}%`, height:'100%', backgroundColor:color, borderRadius:99 }} />
    </View>
  );
}

// ── Budget Card ───────────────────────────────────────────────────────────────
function BudgetCard({ T, budget, spent, onEdit, onDelete }) {
  const pct     = budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0;
  const over    = spent > budget.limit;
  const warning = pct >= 80 && !over;
  const color   = over ? '#F87171' : warning ? '#FBBF24' : '#818CF8';
  const remaining = budget.limit - spent;

  return (
    <View style={{
      backgroundColor: T.surface, borderRadius: 20, padding: 18, marginBottom: 12,
      borderWidth: 1,
      borderColor: over ? '#F87171' : T.line,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    }}>
      {/* Top row: icon + name + actions */}
      <View style={{ flexDirection:'row', alignItems:'center', marginBottom:14 }}>
        <View style={{
          width: 46, height: 46, borderRadius: 13,
          backgroundColor: T.surface2, justifyContent:'center', alignItems:'center', marginRight:12,
        }}>
          <Text style={{ fontSize: 24 }}>{budget.icon}</Text>
        </View>
        <View style={{ flex:1 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <Text style={{ color:T.text, fontWeight:'800', fontSize:15, letterSpacing:-0.2 }}>{budget.name}</Text>
            {over    && <Text style={{ fontSize:12 }}>🔴</Text>}
            {warning && !over && <Text style={{ fontSize:12 }}>⚠️</Text>}
          </View>
          <Text style={{ color: over ? '#F87171' : warning ? '#FBBF24' : T.textMuted, fontSize:11, marginTop:2, fontWeight:'600' }}>
            {over
              ? `🚨 Exceeded by ₦${Math.abs(remaining).toLocaleString()}`
              : warning
              ? `⚡ Only ${100 - pct}% of budget left`
              : `₦${remaining.toLocaleString()} remaining`}
          </Text>
        </View>
        <View style={{ flexDirection:'row', gap:4 }}>
          <TouchableOpacity onPress={onEdit}
            style={{ width:34, height:34, borderRadius:10, backgroundColor:T.surface2, justifyContent:'center', alignItems:'center' }}>
            <Text style={{ fontSize:14 }}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}
            style={{ width:34, height:34, borderRadius:10, backgroundColor:'#F8717120', justifyContent:'center', alignItems:'center' }}>
            <Text style={{ fontSize:14 }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
        <ProgressBar pct={pct} color={color} trackColor={T.line} />
        <Text style={{ color, fontWeight:'800', fontSize:13, minWidth:40, textAlign:'right' }}>{pct}%</Text>
      </View>

      {/* Spend vs budget stats */}
      <View style={{ flexDirection:'row', gap:8 }}>
        <View style={{ flex:1, backgroundColor:T.surface2, borderRadius:10, padding:10 }}>
          <Text style={{ color:T.textMuted, fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:3 }}>SPENT</Text>
          <Text style={{ color:T.text, fontWeight:'800', fontSize:14 }}>₦{spent.toLocaleString()}</Text>
        </View>
        <View style={{ flex:1, backgroundColor:T.surface2, borderRadius:10, padding:10 }}>
          <Text style={{ color:T.textMuted, fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:3 }}>BUDGET</Text>
          <Text style={{ color:T.text, fontWeight:'800', fontSize:14 }}>₦{budget.limit.toLocaleString()}</Text>
        </View>
      </View>

    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BudgetScreen({ theme, user }) {
  const T = theme === 'dark' ? DARK : LIGHT;

  const [budgets,       setBudgets]       = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [showAdd,       setShowAdd]       = useState(false);
  const [showPresets,   setShowPresets]   = useState(false);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [editingId,     setEditingId]     = useState(null);

  // Form state
  const [form, setForm] = useState({ icon:'🍔', name:'', cat:'Food', limit:'', keywords:'' });

  // ── Hardware back button — close whichever modal is open ─────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showEmoji)  { setShowEmoji(false);  return true; }
      if (showAdd)    { setShowAdd(false);     return true; }
      return false; // let system handle it (go to previous tab)
    });
    return () => sub.remove();
  }, [showEmoji, showAdd]);

  // ── Request notification permission on first load ────────────────────────
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  // ── Load data on focus + auto-check alerts ────────────────────────────────
  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  async function loadData() {
    try {
      const [bRaw, tRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem('finsight_transactions'),
      ]);
      const loadedBudgets = bRaw ? JSON.parse(bRaw) : [];
      let loadedTxs = tRaw ? JSON.parse(tRaw) : [];

      // ── One-time cleanup: remove fake transactions created by budget alert notifications ──
      // These are transactions whose description matches our own alert notification text.
      const alertPhrases = ['budget exceeded', 'budget warning', 'budget alert'];
      const cleaned = loadedTxs.filter(tx => {
        const desc = (tx.desc || '').toLowerCase();
        return !alertPhrases.some(p => desc.includes(p));
      });
      if (cleaned.length !== loadedTxs.length) {
        loadedTxs = cleaned;
        await AsyncStorage.setItem('finsight_transactions', JSON.stringify(cleaned));
        // Also clear alert-sent flags so legitimate alerts can fire again with correct data
        const allKeys = await AsyncStorage.getAllKeys();
        const alertKeys = allKeys.filter(k => k.startsWith('finsight_budget_alerted_'));
        if (alertKeys.length) await AsyncStorage.multiRemove(alertKeys);
      }

      setBudgets(loadedBudgets);
      setTransactions(loadedTxs);
      // Auto-check alerts every time we load fresh data
      if (loadedBudgets.length) checkBudgetAlerts(loadedBudgets, loadedTxs);
    } catch (e) {
      console.error('[Budget] loadData error', e);
    }
  }

  async function saveBudgets(updated) {
    setBudgets(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // ── Check budgets and send notifications ──────────────────────────────────
  async function checkBudgetAlerts(updatedBudgets, txs) {
    try {
      for (const b of updatedBudgets) {
        try {
          const spent = calcSpent(txs, b);
          const pct   = b.limit > 0 ? (spent / b.limit) * 100 : 0;
          const alertKey = `finsight_budget_alerted_${b.id}_${getMonthKey()}`;
          const alerted  = await AsyncStorage.getItem(alertKey);

          if (pct >= 100 && alerted !== 'exceeded') {
            await AsyncStorage.setItem(alertKey, 'exceeded');
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `🔴 Budget Exceeded: ${b.icon} ${b.name}`,
                body: `You've spent ₦${spent.toLocaleString()} — over your ₦${b.limit.toLocaleString()} budget!`,
                sound: true,
              },
              trigger: null,
            });
          } else if (pct >= 80 && pct < 100 && !alerted) {
            await AsyncStorage.setItem(alertKey, 'warned');
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `⚠️ Budget Warning: ${b.icon} ${b.name}`,
                body: `You've used ${Math.round(pct)}% of your ₦${b.limit.toLocaleString()} budget.`,
                sound: true,
              },
              trigger: null,
            });
          }
        } catch (innerErr) {
          console.error('[Budget] alert check error for', b.name, innerErr);
        }
      }
    } catch (e) {
      console.error('[Budget] checkBudgetAlerts error', e);
    }
  }

  // ── Add / Edit budget ────────────────────────────────────────────────────
  function openAdd() {
    setEditingId(null);
    setForm({ icon:'🍔', name:'', cat:'Food', limit:'', keywords:'' });
    setShowAdd(true);
  }

  function openEdit(b) {
    setEditingId(b.id);
    setForm({ icon:b.icon, name:b.name, cat:b.cat, limit:String(b.limit), keywords:(b.keywords||[]).join(', ') });
    setShowAdd(true);
  }

  async function saveBudgetItem() {
    if (!form.name.trim()) return Alert.alert('Name required', 'Please enter a budget name.');
    const limit = parseFloat(form.limit.replace(/,/g,''));
    if (!limit || limit <= 0) return Alert.alert('Amount required', 'Please enter a valid budget limit.');
    const keywords = form.keywords ? form.keywords.split(',').map(k=>k.trim()).filter(Boolean) : [];

    let updated;
    if (editingId) {
      updated = budgets.map(b => b.id === editingId
        ? { ...b, icon:form.icon, name:form.name, cat:form.cat, limit, keywords }
        : b);
    } else {
      const newBudget = {
        id: `${Date.now()}`,
        icon: form.icon,
        name: form.name,
        cat:  form.cat,
        limit,
        keywords,
        createdMonth: getMonthKey(),
      };
      updated = [...budgets, newBudget];
    }
    await saveBudgets(updated);
    await checkBudgetAlerts(updated, transactions);
    setShowAdd(false);
  }

  function deleteBudget(id) {
    Alert.alert('Delete Budget', 'Remove this budget item?', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        const updated = budgets.filter(b => b.id !== id);
        await saveBudgets(updated);
      }},
    ]);
  }

  // ── Summary totals ───────────────────────────────────────────────────────
  const totalLimit = budgets.reduce((s,b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s,b) => s + calcSpent(transactions, b), 0);
  const totalPct   = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const summaryColor = totalPct >= 100 ? '#F87171' : totalPct >= 80 ? '#FBBF24' : '#818CF8';
  const monthName = new Date().toLocaleDateString('en-NG', { month:'long', year:'numeric' });

  const s = styles(T);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom:40 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.label}>BUDGET</Text>
            <Text style={s.title}>Planner</Text>
          </View>
          <TouchableOpacity onPress={openAdd} style={s.addBtn}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Monthly summary card ────────────────────────────────────────── */}
        {budgets.length > 0 && (
          <View style={[s.card, { marginBottom:20 }]}>
            <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:2, marginBottom:4 }}>
              {monthName.toUpperCase()}
            </Text>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:12 }}>
              <View>
                <Text style={{ color:T.text, fontSize:28, fontWeight:'900' }}>
                  ₦{totalSpent.toLocaleString()}
                </Text>
                <Text style={{ color:T.textMuted, fontSize:12 }}>of ₦{totalLimit.toLocaleString()} budgeted</Text>
              </View>
              <View style={{ alignItems:'flex-end', justifyContent:'center' }}>
                <Text style={{ color:summaryColor, fontSize:28, fontWeight:'900' }}>{totalPct}%</Text>
                <Text style={{ color:T.textMuted, fontSize:11 }}>used</Text>
              </View>
            </View>
            <ProgressBar pct={totalPct} color={summaryColor} />
            <Text style={{ color:T.textMuted, fontSize:12, marginTop:8 }}>
              ₦{Math.max(0, totalLimit - totalSpent).toLocaleString()} remaining this month
            </Text>
          </View>
        )}

        {/* ── Budget items ─────────────────────────────────────────────────── */}
        {budgets.length === 0 ? (
          <View style={{ alignItems:'center', paddingTop:60, gap:12 }}>
            <Text style={{ fontSize:52 }}>📊</Text>
            <Text style={{ color:T.text, fontSize:18, fontWeight:'800' }}>No budgets yet</Text>
            <Text style={{ color:T.textMuted, fontSize:14, textAlign:'center', paddingHorizontal:32 }}>
              Tap "+ Add" to set spending limits for food, transport, Netflix, data and more.
            </Text>
            <TouchableOpacity onPress={openAdd} style={[s.addBtn, { marginTop:12 }]}>
              <Text style={s.addBtnText}>+ Create First Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map(b => (
            <BudgetCard
              key={b.id}
              T={T}
              budget={b}
              spent={calcSpent(transactions, b)}
              onEdit={() => openEdit(b)}
              onDelete={() => deleteBudget(b.id)}
            />
          ))
        )}

      </ScrollView>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowAdd(false); setEditingId(null); }}>
        <View style={{ flex:1, backgroundColor:T.bg }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center',
            padding:20, borderBottomWidth:1, borderColor:T.line2 }}>
            <Text style={{ color:T.text, fontSize:18, fontWeight:'800' }}>
              {editingId ? 'Edit Budget' : 'New Budget'}
            </Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={{ color:T.textMuted, fontSize:16 }}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:20, gap:16 }}>

            {/* Preset templates */}
            {!editingId && (
              <View>
                <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:10 }}>
                  QUICK TEMPLATES
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:4 }}>
                  <View style={{ flexDirection:'row', gap:8 }}>
                    {PRESETS.map(p => (
                      <TouchableOpacity key={p.name} onPress={() => setForm(f => ({ ...f, icon:p.icon, name:p.name==='Custom'?'':p.name, cat:p.cat }))}
                        style={{ backgroundColor:T.surface, borderRadius:12, paddingHorizontal:12, paddingVertical:8,
                          borderWidth: form.name===p.name ? 2 : 0, borderColor:T.lime }}>
                        <Text style={{ fontSize:18 }}>{p.icon}</Text>
                        <Text style={{ color:T.text, fontSize:10, marginTop:2, fontWeight:'600' }}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Icon picker */}
            <View>
              <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:8 }}>ICON</Text>
              <TouchableOpacity onPress={() => setShowEmoji(true)}
                style={{ width:64, height:64, backgroundColor:T.surface, borderRadius:16,
                  justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:T.line2 }}>
                <Text style={{ fontSize:30 }}>{form.icon}</Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <View>
              <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:8 }}>BUDGET NAME</Text>
              <TextInput
                style={{ backgroundColor:T.surface, borderRadius:12, padding:14, color:T.text, fontSize:16 }}
                placeholder="e.g. Netflix, Food, Data Sub..."
                placeholderTextColor={T.textMuted}
                value={form.name}
                onChangeText={v => setForm(f=>({...f, name:v}))}
              />
            </View>

            {/* Monthly limit */}
            <View>
              <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:8 }}>MONTHLY LIMIT (₦)</Text>
              <TextInput
                style={{ backgroundColor:T.surface, borderRadius:12, padding:14, color:T.text, fontSize:16 }}
                placeholder="e.g. 50000"
                placeholderTextColor={T.textMuted}
                keyboardType="numeric"
                value={form.limit}
                onChangeText={v => setForm(f=>({...f, limit:v}))}
              />
            </View>

            {/* Category */}
            <View>
              <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:8 }}>TRACK FROM CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection:'row', gap:8 }}>
                  {['Food','Transport','Utilities','Entertainment','Health','Savings','Shopping','Other'].map(cat => (
                    <TouchableOpacity key={cat} onPress={() => setForm(f=>({...f, cat}))}
                      style={{ backgroundColor: form.cat===cat ? T.lime : T.surface,
                        borderRadius:20, paddingHorizontal:14, paddingVertical:8 }}>
                      <Text style={{ color: form.cat===cat ? '#0E120F' : T.text, fontWeight:'700', fontSize:13 }}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Keywords */}
            <View>
              <Text style={{ color:T.textMuted, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:4 }}>EXTRA KEYWORDS (optional)</Text>
              <Text style={{ color:T.textMuted, fontSize:11, marginBottom:8 }}>
                Catches mis-categorised transactions — only used when the category above doesn't match. e.g. "netflix, spotify"
              </Text>
              <TextInput
                style={{ backgroundColor:T.surface, borderRadius:12, padding:14, color:T.text, fontSize:14 }}
                placeholder="netflix, spotify, dstv..."
                placeholderTextColor={T.textMuted}
                value={form.keywords}
                onChangeText={v => setForm(f=>({...f, keywords:v}))}
              />
            </View>

            <TouchableOpacity onPress={saveBudgetItem}
              style={{ backgroundColor:T.lime, borderRadius:14, padding:16, alignItems:'center', marginTop:8 }}>
              <Text style={{ color:'#0E120F', fontWeight:'900', fontSize:16 }}>
                {editingId ? 'Save Changes' : 'Create Budget'}
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </Modal>

      {/* ── Emoji picker modal ───────────────────────────────────────────── */}
      <Modal visible={showEmoji} transparent animationType="fade" onRequestClose={() => setShowEmoji(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center' }}>
          <View style={{ backgroundColor:T.surface, borderRadius:20, padding:20, width:'80%' }}>
            <Text style={{ color:T.text, fontWeight:'800', fontSize:16, marginBottom:16, textAlign:'center' }}>Pick an Icon</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
              {EMOJI_LIST.map(e => (
                <TouchableOpacity key={e} onPress={() => { setForm(f=>({...f, icon:e})); setShowEmoji(false); }}
                  style={{ width:48, height:48, justifyContent:'center', alignItems:'center',
                    backgroundColor: form.icon===e ? T.lime+'33' : T.bg, borderRadius:12 }}>
                  <Text style={{ fontSize:26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowEmoji(false)} style={{ marginTop:16, alignItems:'center' }}>
              <Text style={{ color:T.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe:    { flex:1, backgroundColor:T.bg },
  scroll:  { flex:1, paddingHorizontal:16, paddingTop:8 },
  header:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end', paddingTop:18, paddingBottom:8 },
  label:   { color:T.textMuted, fontSize:9, fontWeight:'700', letterSpacing:2.5, marginBottom:4 },
  title:   { color:T.text, fontSize:32, fontWeight:'900', letterSpacing:-0.8 },
  card: {
    backgroundColor:T.surface, borderRadius:20, padding:20,
    borderWidth:1, borderColor:T.line,
    shadowColor:'#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.05, shadowRadius:8, elevation:2,
  },
  addBtn: {
    backgroundColor:T.lime, borderRadius:14,
    paddingHorizontal:18, paddingVertical:11,
    shadowColor:'#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.12, shadowRadius:6, elevation:3,
  },
  addBtnText: { color:'#0E120F', fontWeight:'900', fontSize:14 },
});
