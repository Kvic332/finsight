import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View,
} from 'react-native';
import { autoBackupNote } from '../services/autoBackupRules';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from '../constants/tokens';
import {
  Button, Card, ConfirmSheet, EmptyState, IconButton, IconTile, Input, SegmentedControl, Sheet, Text, useTheme,
  useToast,
} from '../components/ui';
import {
  backupToCloud, deleteAccount, getBackupState, getCloudProfile, isAutoBackupOn, onAuthChange, resetPassword,
  restoreFromCloud, setAutoBackup, signIn, signOut, signUp,
} from '../services/cloudSync';

const AUTH_ERRORS = {
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'That password is incorrect.',
  'auth/invalid-credential': 'That email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Check it and try again.',
};

export function DeleteAccountSheet({ onClose, onDelete }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    setDeleting(true);
    setError('');
    try {
      await onDelete(password);
    } catch (err) {
      setError(AUTH_ERRORS[err.code] || "Couldn't delete your account. Check your connection and try again.");
      setDeleting(false);
    }
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Delete your account?"
      footer={(
        <>
          <Button full title="Delete account" variant="danger" loading={deleting} disabled={!password} onPress={confirm} />
          <Button full title="Keep my account" variant="ghost" onPress={onClose} />
        </>
      )}
    >
      <View style={{ gap: space.md }}>
        <Text color="inkMuted">
          This permanently deletes your login, cloud backup, profile and FinScore history. You can't undo it.
        </Text>
        <Text color="inkMuted">
          Data on this phone stays until you choose Delete everything in Settings.
        </Text>
        <Input
          label="Enter your password to confirm"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          error={error || undefined}
        />
      </View>
    </Sheet>
  );
}

function Header({ onBack }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}>
      <IconButton icon="arrow-back" label="Back" onPress={onBack} />
      <Text variant="bodyStrong" family="bold" accessibilityRole="header">Cloud backup</Text>
    </View>
  );
}

export default function CloudAccountScreen({ onBack }) {
  const { c } = useTheme();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [restored, setRestored] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoOn, setAutoOn] = useState(true);
  const [backupState, setBackupState] = useState(null);

  async function refreshAuto() {
    setAutoOn(await isAutoBackupOn());
    setBackupState(await getBackupState());
  }

  useEffect(() => onAuthChange(async u => {
    setUser(u);
    if (u) {
      const p = await getCloudProfile().catch(() => null);
      setProfile(p);
      setLastSync(p?.lastBackup?.toDate?.()?.toLocaleDateString('en-NG') || null);
      refreshAuto().catch(() => {});
    }
  }), []);

  async function toggleAuto(on) {
    setAutoOn(on);
    await setAutoBackup(on);
  }

  async function submit() {
    const next = {
      ...(email.includes('@') ? null : { email: 'Enter a valid email address' }),
      ...(password.length >= 6 ? null : { password: 'Use at least 6 characters' }),
      ...(mode === 'signup' && !name.trim() ? { name: 'Enter your name' } : null),
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, name.trim());
        toast.show('Account created', { tone: 'success' });
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setErrors({ form: AUTH_ERRORS[err.code] || "Couldn't sign you in. Try again." });
    }
    setLoading(false);
  }

  async function forgotPassword() {
    if (!email.includes('@')) { setErrors({ email: 'Enter your email first' }); return; }
    try {
      await resetPassword(email.trim());
      toast.show('Check your inbox for a reset link', { tone: 'success' });
    } catch {
      setErrors({ form: "Couldn't send the email. Check the address and try again." });
    }
  }

  async function backup() {
    setSyncing(true);
    try {
      await backupToCloud();
      setLastSync(new Date().toLocaleDateString('en-NG'));
      refreshAuto().catch(() => {});
      toast.show('Backup complete', { tone: 'success' });
    } catch (err) {
      toast.show("Couldn't back up. Check your connection and try again.", { tone: 'error' });
    }
    setSyncing(false);
  }

  async function restore() {
    setConfirmRestore(false);
    setSyncing(true);
    try {
      const { date } = await restoreFromCloud();
      setRestored(date);
      refreshAuto().catch(() => {});
    } catch (err) {
      toast.show(err.message || "Couldn't restore your backup. Try again.", { tone: 'error' });
    }
    setSyncing(false);
  }

  async function doSignOut() {
    setConfirmSignOut(false);
    await signOut();
    setProfile(null);
  }

  async function removeAccount(accountPassword) {
    await deleteAccount(accountPassword);
    setConfirmDelete(false);
    setProfile(null);
    setPassword('');
    toast.show('Your account has been deleted', { tone: 'success' });
  }

  if (user) {
    const history = [...(profile?.finscore?.history || [])].reverse().slice(0, 7);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
        <Header onBack={onBack} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.lg }}>
          <Card style={{ padding: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconTile name="cloud-done-outline" tone="accent" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyStrong" family="bold" numberOfLines={1}>{profile?.name || 'Your account'}</Text>
                <Text variant="label" family="regular" color="inkMuted" numberOfLines={1}>{user.email}</Text>
              </View>
            </View>
          </Card>

          {restored ? (
            <Card style={{ padding: space.lg }}>
              <Text variant="bodyStrong" family="bold">Backup restored</Text>
              <Text variant="label" family="regular" color="inkMuted">Your data from {restored} is back. Close and reopen FinSight to see it.</Text>
            </Card>
          ) : null}

          <View style={{ gap: space.sm }}>
            <Text variant="label" family="regular" color="inkMuted" align="center">
              {lastSync ? `Last backup: ${lastSync}` : 'You have no backup yet'}
            </Text>
            <Button full title="Back up now" icon="cloud-upload-outline" loading={syncing} onPress={backup} />
            <Button full title="Restore from backup" variant="secondary" disabled={syncing} onPress={() => setConfirmRestore(true)} />
            {syncing ? <ActivityIndicator color={c.accent} accessibilityLabel="Working" /> : null}
          </View>

          <Card style={{ padding: space.lg, gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Text variant="bodyStrong" family="bold" style={{ flex: 1 }}>Automatic backup</Text>
              <Switch
                value={autoOn}
                onValueChange={toggleAuto}
                accessibilityLabel="Automatic backup"
                trackColor={{ false: c.lineStrong, true: c.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Text variant="label" family="regular" color="inkMuted">
              {autoBackupNote({ enabled: autoOn, uid: user.uid, state: backupState })}
            </Text>
          </Card>

          <Card style={{ padding: space.lg, gap: space.xs }}>
            <Text variant="bodyStrong" family="bold">What's stored</Text>
            <Text variant="label" family="regular" color="inkMuted">
              Your backup holds your transactions, budgets, goals, debts and profile, and the app only lets your account open it. It's protected by Google Firebase's security, not by FinSight's own encryption. Your FinScore and basic usage counts are also saved with your account.
            </Text>
          </Card>

          {history.length ? (
            <View style={{ gap: space.sm }}>
              <Text variant="heading" family="bold" accessibilityRole="header">FinScore history</Text>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {history.map((e, i) => (
                  <View key={e.date} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.md + 2, borderBottomWidth: i < history.length - 1 ? 1 : 0, borderBottomColor: c.line }}>
                    <Text variant="label" family="regular" color="inkMuted">{e.date}</Text>
                    <Text variant="label" family="bold" tabular>{e.score}</Text>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <Button full title="Sign out" variant="ghost" onPress={() => setConfirmSignOut(true)} />
          <Button full title="Delete account" variant="danger" onPress={() => setConfirmDelete(true)} />
        </ScrollView>

        {confirmDelete ? <DeleteAccountSheet onClose={() => setConfirmDelete(false)} onDelete={removeAccount} /> : null}

        <ConfirmSheet
          visible={confirmRestore}
          destructive
          title="Replace what's on this phone?"
          body="Your backup will overwrite the data currently on this phone. Anything added since that backup will be lost."
          confirmLabel="Restore backup"
          onConfirm={restore}
          onCancel={() => setConfirmRestore(false)}
        />
        <ConfirmSheet
          visible={confirmSignOut}
          title="Sign out of cloud backup?"
          body="Your data stays on this phone. You can sign back in at any time."
          confirmLabel="Sign out"
          onConfirm={doSignOut}
          onCancel={() => setConfirmSignOut(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
      <Header onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: space.xl, paddingTop: 0, gap: space.lg }}>
          <EmptyState icon="cloud-outline" title="Keep a backup" body="Sign in to back up your data and restore it on a new phone. FinSight works without an account." />
          <SegmentedControl
            value={mode}
            onChange={m => { setMode(m); setErrors({}); }}
            options={[{ value: 'login', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]}
          />
          <View style={{ gap: space.md }}>
            {mode === 'signup' ? <Input label="Name" placeholder="Your name" value={name} error={errors.name} onChangeText={setName} /> : null}
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} error={errors.email} onChangeText={setEmail} />
            <Input label="Password" placeholder="At least 6 characters" secureTextEntry autoCapitalize="none" value={password} error={errors.password} onChangeText={setPassword} />
            {errors.form ? <Text variant="label" family="medium" color="negative" accessibilityLiveRegion="polite">{errors.form}</Text> : null}
          </View>
          <Button full title={mode === 'login' ? 'Sign in' : 'Create account'} loading={loading} onPress={submit} />
          {mode === 'login' ? (
            <Pressable onPress={forgotPassword} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center' }}>
              <Text variant="label" family="semibold" color="accent">Forgot password?</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
