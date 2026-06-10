import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DARK, LIGHT } from '../constants/theme';
import { subscribeAllUsers } from '../services/cloudSync';

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(ts) {
  if (!ts) return 999;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function fmt(n) { return (n || 0).toLocaleString(); }

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ T, icon, label, value, sub, color }) {
  return (
    <View style={{
      flex: 1, backgroundColor: T.surface, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: T.line, alignItems: 'center', gap: 4,
    }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ color: color || T.lime, fontSize: 22, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: T.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
      {sub ? <Text style={{ color: T.textMuted, fontSize: 10, textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}

// ── Feature Bar ───────────────────────────────────────────────────────────────
function FeatureBar({ T, icon, label, value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>{icon} {label}</Text>
        <Text style={{ color: T.lime, fontSize: 13, fontWeight: '800' }}>{fmt(value)}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: T.surface2, borderRadius: 99, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: T.lime, borderRadius: 99 }} />
      </View>
    </View>
  );
}

// ── User Row ──────────────────────────────────────────────────────────────────
function UserRow({ T, u, index }) {
  const days = daysSince(u.lastSeen);
  const active = days <= 7;
  const score = u.finscore?.current || 0;
  const scoreColor = score >= 80 ? '#34D399' : score >= 60 ? '#FBBF24' : '#F87171';
  const totalEvents = Object.values(u.analytics || {}).reduce((s, v) => s + (v || 0), 0);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
      borderBottomWidth: 1, borderColor: T.line, gap: 10,
    }}>
      {/* Rank */}
      <Text style={{ color: T.textMuted, fontSize: 12, fontWeight: '700', width: 22, textAlign: 'center' }}>
        {index + 1}
      </Text>

      {/* Avatar */}
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: active ? '#34D39920' : T.surface2,
        borderWidth: 1.5, borderColor: active ? '#34D399' : T.line,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 16 }}>👤</Text>
      </View>

      {/* Name + email */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
          {u.name || 'Unknown'}
        </Text>
        <Text style={{ color: T.textMuted, fontSize: 11 }} numberOfLines={1}>{u.email}</Text>
      </View>

      {/* Stats */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ color: scoreColor, fontWeight: '800', fontSize: 13 }}>
          {score > 0 ? `${score}` : '—'}
        </Text>
        <Text style={{ color: T.textMuted, fontSize: 10 }}>
          {active ? `Active ${days === 0 ? 'today' : `${days}d ago`}` : `${days}d ago`}
        </Text>
      </View>

      {/* Event count badge */}
      <View style={{ backgroundColor: T.lime + '22', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
        <Text style={{ color: T.lime, fontSize: 11, fontWeight: '800' }}>{fmt(totalEvents)}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminDashboardScreen({ theme, onBack }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const s = styles(T);

  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [lastUpdate,setLastUpdate] = useState(null);

  useEffect(() => {
    const unsub = subscribeAllUsers(data => {
      setUsers(data);
      setLoading(false);
      setLastUpdate(new Date().toLocaleTimeString('en-NG'));
    });
    return unsub;
  }, []);

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const totalUsers  = users.length;
  const activeToday = users.filter(u => daysSince(u.lastSeen) === 0).length;
  const active7d    = users.filter(u => daysSince(u.lastSeen) <= 7).length;
  const active30d   = users.filter(u => daysSince(u.lastSeen) <= 30).length;

  const scores   = users.map(u => u.finscore?.current || 0).filter(s => s > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;

  const sum = key => users.reduce((s, u) => s + (u.analytics?.[key] || 0), 0);
  const totalTx       = sum('transactions_added');
  const totalAria     = sum('aria_messages');
  const totalDash     = sum('dashboard_views');
  const totalSavings  = sum('savings_interactions');
  const totalSMS      = sum('sms_imports');
  const totalBudget   = sum('budget_interactions');
  const totalInvest   = sum('investments_views');
  const totalSettings = sum('settings_interactions');
  const maxEvents     = Math.max(totalTx, totalAria, totalDash, totalSavings, totalSMS, totalBudget, 1);

  const usersWithBackup = users.filter(u => u.lastBackup).length;
  const xpTotal = users.reduce((s, u) => s + (u.xp?.total || 0), 0);

  // Sort users by total events desc
  const sortedUsers = [...users].sort((a, b) => {
    const ea = Object.values(a.analytics || {}).reduce((s, v) => s + (v || 0), 0);
    const eb = Object.values(b.analytics || {}).reduce((s, v) => s + (v || 0), 0);
    return eb - ea;
  });

  const scoreColor = avgScore >= 80 ? '#34D399' : avgScore >= 60 ? '#FBBF24' : '#F87171';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} tintColor={T.lime} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: '900' }}>Admin Dashboard</Text>
            {lastUpdate && (
              <Text style={{ color: T.textMuted, fontSize: 11 }}>Live · updated {lastUpdate}</Text>
            )}
          </View>
          <View style={{ backgroundColor: '#34D39920', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '700' }}>● LIVE</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 }}>
            <ActivityIndicator size="large" color={T.lime} />
            <Text style={{ color: T.textMuted }}>Loading user data…</Text>
          </View>
        ) : (
          <>
            {/* ── Overview stats ──────────────────────────────────────────── */}
            <Text style={s.sectionLabel}>OVERVIEW</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <StatCard T={T} icon="👥" label="Total Users"   value={totalUsers}  />
              <StatCard T={T} icon="🟢" label="Active Today"  value={activeToday} color="#34D399" />
              <StatCard T={T} icon="📅" label="Active 7 Days" value={active7d}    color="#FBBF24" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              <StatCard T={T} icon="📆" label="Active 30 Days"  value={active30d}        />
              <StatCard T={T} icon="☁️" label="Cloud Backups"   value={usersWithBackup}  color="#818CF8" />
              <StatCard T={T} icon="⚡" label="Total XP Earned" value={fmt(xpTotal)}     color="#FBBF24" />
            </View>

            {/* ── FinScore stats ──────────────────────────────────────────── */}
            <Text style={s.sectionLabel}>FINSCORE</Text>
            <View style={[s.card, { flexDirection: 'row', gap: 0, marginBottom: 20 }]}>
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: scoreColor, fontSize: 32, fontWeight: '900' }}>{avgScore}</Text>
                <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '700' }}>AVG SCORE</Text>
              </View>
              <View style={{ width: 1, backgroundColor: T.line }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: '#34D399', fontSize: 32, fontWeight: '900' }}>{maxScore}</Text>
                <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '700' }}>HIGHEST</Text>
              </View>
              <View style={{ width: 1, backgroundColor: T.line }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: T.lime, fontSize: 32, fontWeight: '900' }}>
                  {scores.filter(s => s >= 70).length}
                </Text>
                <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '700' }}>SCORE 70+</Text>
              </View>
            </View>

            {/* ── Feature usage ───────────────────────────────────────────── */}
            <Text style={s.sectionLabel}>FEATURE USAGE (ALL TIME)</Text>
            <View style={[s.card, { marginBottom: 20 }]}>
              <FeatureBar T={T} icon="💸" label="Transactions Logged" value={totalTx}      max={maxEvents} />
              <FeatureBar T={T} icon="📊" label="Dashboard Views"     value={totalDash}    max={maxEvents} />
              <FeatureBar T={T} icon="🤖" label="ARIA Messages"       value={totalAria}    max={maxEvents} />
              <FeatureBar T={T} icon="🎯" label="Budget Interactions" value={totalBudget}  max={maxEvents} />
              <FeatureBar T={T} icon="🏦" label="Savings"             value={totalSavings} max={maxEvents} />
              <FeatureBar T={T} icon="📩" label="SMS Imports"         value={totalSMS}     max={maxEvents} />
              <FeatureBar T={T} icon="📈" label="Investments Views"   value={totalInvest}  max={maxEvents} />
              <FeatureBar T={T} icon="⚙️" label="Settings"           value={totalSettings} max={maxEvents} />
            </View>

            {/* ── User list ───────────────────────────────────────────────── */}
            <Text style={s.sectionLabel}>USERS ({totalUsers}) — sorted by activity</Text>
            <View style={s.card}>
              {/* Header row */}
              <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderColor: T.line, marginBottom: 4 }}>
                <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '700', width: 22 }}>#</Text>
                <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '700', flex: 1, marginLeft: 46 }}>USER</Text>
                <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '700', marginRight: 36 }}>SCORE</Text>
                <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '700' }}>EVENTS</Text>
              </View>
              {sortedUsers.length === 0 ? (
                <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 20 }}>No users yet</Text>
              ) : (
                sortedUsers.map((u, i) => <UserRow key={u.id} T={T} u={u} index={i} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: T.bg },
  sectionLabel: { color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  card: {
    backgroundColor: T.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: T.line, marginBottom: 8,
  },
});
