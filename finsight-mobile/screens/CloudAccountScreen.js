import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DARK, LIGHT } from '../constants/theme';
import {
  signUp, signIn, signOut, resetPassword,
  backupToCloud, restoreFromCloud, getCloudProfile, onAuthChange, currentUser,
} from '../services/cloudSync';

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, T, secure, keyboardType }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: 12, paddingHorizontal: 14 }}>
        <TextInput
          style={{ flex: 1, color: T.text, fontSize: 15, paddingVertical: 14 }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.textMuted}
          secureTextEntry={secure && !show}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(s => !s)}>
            <Ionicons name={show ? 'eye-off' : 'eye'} size={18} color={T.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value, T }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.surface2, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ color: T.text, fontWeight: '800', fontSize: 15 }}>{value}</Text>
      <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CloudAccountScreen({ theme, onBack }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const s = styles(T);

  const [mode,     setMode]     = useState('login');   // 'login' | 'signup'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [user,     setUser]     = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [syncing,  setSyncing]  = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthChange(async u => {
      setUser(u);
      if (u) {
        const p = await getCloudProfile().catch(() => null);
        setProfile(p);
        if (p?.lastBackup) {
          setLastSync(p.lastBackup?.toDate?.()?.toLocaleDateString('en-NG') || null);
        }
      }
    });
    return unsub;
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  async function handleAuth() {
    if (!email.trim() || !password.trim()) return Alert.alert('Missing fields', 'Please fill in all fields.');
    if (mode === 'signup' && !name.trim()) return Alert.alert('Missing name', 'Please enter your name.');
    if (password.length < 6) return Alert.alert('Weak password', 'Password must be at least 6 characters.');

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, name.trim());
        Alert.alert('Account created! 🎉', 'Your FinSight account is ready. Back up your data any time from this screen.');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      const msg = err.code === 'auth/user-not-found'    ? 'No account found with this email.'
                : err.code === 'auth/wrong-password'    ? 'Incorrect password.'
                : err.code === 'auth/email-already-in-use' ? 'An account already exists with this email.'
                : err.code === 'auth/invalid-email'     ? 'Invalid email address.'
                : err.code === 'auth/network-request-failed' ? 'No internet connection.'
                : err.message;
      Alert.alert('Error', msg);
    }
    setLoading(false);
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'You can sign back in any time to access your backup.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        await signOut();
        setProfile(null);
      }},
    ]);
  }

  async function handleForgotPassword() {
    if (!email.trim()) return Alert.alert('Enter email', 'Type your email above first.');
    try {
      await resetPassword(email.trim());
      Alert.alert('Email sent', 'Check your inbox for a password reset link.');
    } catch {
      Alert.alert('Error', 'Could not send reset email. Check the address and try again.');
    }
  }

  // ── Backup / Restore ──────────────────────────────────────────────────────
  async function handleBackup() {
    setSyncing(true);
    try {
      const count = await backupToCloud();
      const today = new Date().toLocaleDateString('en-NG');
      setLastSync(today);
      Alert.alert('Backup complete ✅', `${count} data sets saved to your cloud account.`);
      // Refresh profile
      const p = await getCloudProfile();
      setProfile(p);
    } catch (err) {
      Alert.alert('Backup failed', err.message || 'Check your internet connection.');
    }
    setSyncing(false);
  }

  async function handleRestore() {
    Alert.alert(
      'Restore from cloud',
      'This will overwrite your current local data with your cloud backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: async () => {
          setSyncing(true);
          try {
            const { count, date } = await restoreFromCloud();
            Alert.alert('Restored ✅', `${count} data sets restored from backup on ${date}.\n\nRestart the app to see your data.`);
          } catch (err) {
            Alert.alert('Restore failed', err.message);
          }
          setSyncing(false);
        }},
      ]
    );
  }

  // ── Signed-in view ────────────────────────────────────────────────────────
  if (user) {
    const analytics = profile?.analytics || {};
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
            <TouchableOpacity onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color={T.text} />
            </TouchableOpacity>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: '900' }}>Cloud Account</Text>
          </View>

          {/* Profile card */}
          <View style={[s.card, { marginBottom: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: T.lime + '22',
                justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: T.lime }}>
                <Text style={{ fontSize: 24 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text, fontWeight: '800', fontSize: 16 }}>
                  {profile?.name || user.displayName || 'FinSight User'}
                </Text>
                <Text style={{ color: T.textMuted, fontSize: 13 }}>{user.email}</Text>
              </View>
              <View style={{ backgroundColor: '#34D39920', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '700' }}>● SYNCED</Text>
              </View>
            </View>

            {/* Backup controls */}
            <View style={{ gap: 10 }}>
              {lastSync && (
                <Text style={{ color: T.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
                  Last backup: {lastSync}
                </Text>
              )}
              <TouchableOpacity onPress={handleBackup} disabled={syncing}
                style={{ backgroundColor: T.lime, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                {syncing ? <ActivityIndicator color="#0E120F" size="small" /> : <Ionicons name="cloud-upload" size={18} color="#0E120F" />}
                <Text style={{ color: '#0E120F', fontWeight: '900', fontSize: 15 }}>
                  {syncing ? 'Syncing…' : 'Back Up Now'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleRestore} disabled={syncing}
                style={{ backgroundColor: T.surface2, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="cloud-download" size={18} color={T.text} />
                <Text style={{ color: T.text, fontWeight: '700', fontSize: 15 }}>Restore from Cloud</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Analytics card */}
          <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10 }}>
            YOUR USAGE STATS
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <StatChip icon="📊" label="Dashboard Views"      value={analytics.dashboard_views || 0}     T={T} />
            <StatChip icon="💸" label="Transactions Added"   value={analytics.transactions_added || 0}  T={T} />
            <StatChip icon="🎯" label="Budget Checks"        value={analytics.budget_interactions || 0} T={T} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <StatChip icon="🏦" label="Savings Interactions" value={analytics.savings_interactions || 0}  T={T} />
            <StatChip icon="🤖" label="ARIA Messages"        value={analytics.aria_messages || 0}         T={T} />
            <StatChip icon="📩" label="SMS Imports"          value={analytics.sms_imports || 0}           T={T} />
          </View>

          {/* FinScore history */}
          {profile?.finscore?.history?.length > 0 && (
            <View style={s.card}>
              <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12 }}>
                FINSCORE HISTORY
              </Text>
              {[...(profile.finscore.history)].reverse().slice(0, 7).map((e, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
                  borderBottomWidth: i < 6 ? 1 : 0, borderColor: T.line }}>
                  <Text style={{ color: T.textMuted, fontSize: 13 }}>{e.date}</Text>
                  <Text style={{ color: e.score >= 80 ? '#34D399' : e.score >= 60 ? '#FBBF24' : '#F87171',
                    fontWeight: '800', fontSize: 13 }}>{e.score}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Sign out */}
          <TouchableOpacity onPress={handleSignOut} style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Sign in / Sign up view ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32, gap: 12 }}>
            <TouchableOpacity onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color={T.text} />
            </TouchableOpacity>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: '900' }}>Cloud Account</Text>
          </View>

          {/* Icon + tagline */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: T.surface,
              justifyContent: 'center', alignItems: 'center', marginBottom: 14,
              borderWidth: 2, borderColor: T.lime }}>
              <Ionicons name="cloud" size={38} color={T.lime} />
            </View>
            <Text style={{ color: T.text, fontSize: 20, fontWeight: '900', marginBottom: 6 }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 }}>
              {mode === 'login'
                ? 'Sign in to restore your data or back up to the cloud'
                : 'Your financial data stays private. We only store backups securely.'}
            </Text>
          </View>

          {/* Form */}
          <View style={s.card}>
            {mode === 'signup' && (
              <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="e.g. Kene Okafor" T={T} />
            )}
            <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@email.com" T={T} keyboardType="email-address" />
            <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="Min. 6 characters" T={T} secure />

            {mode === 'login' && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 }}>
                <Text style={{ color: T.lime, fontSize: 12, fontWeight: '700' }}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleAuth} disabled={loading}
              style={{ backgroundColor: T.lime, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 }}>
              {loading
                ? <ActivityIndicator color="#0E120F" />
                : <Text style={{ color: '#0E120F', fontWeight: '900', fontSize: 16 }}>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>}
            </TouchableOpacity>
          </View>

          {/* Toggle */}
          <TouchableOpacity onPress={() => setMode(m => m === 'login' ? 'signup' : 'login')}
            style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: T.textMuted, fontSize: 14 }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{ color: T.lime, fontWeight: '800' }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Privacy note */}
          <Text style={{ color: T.textMuted, fontSize: 11, textAlign: 'center', marginTop: 24, paddingHorizontal: 20, lineHeight: 16 }}>
            🔒 Your transaction data is encrypted and only accessible by you. We never sell or share your financial data.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  card: {
    backgroundColor: T.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: T.line, marginBottom: 16,
  },
});
