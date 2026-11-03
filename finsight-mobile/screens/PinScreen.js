import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StatusBar, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { space } from '../constants/tokens';
import { ConfirmSheet, Gradient, Icon, Text, tapFeedback } from '../components/ui';
import { checkPin, lockWaitSeconds, savePin } from '../services/pinStore';
import { formatWait } from '../services/pinPolicy';

const PIN_LENGTH = 6;
const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['bio', '0', 'del']];

function Key({ children, onPress, label }) {
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.14)',
      })}
    >
      {children}
    </Pressable>
  );
}

export default function PinScreen({ mode = 'create', onSuccess, onForgot, onCancel, biometricEnabled = false }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage] = useState(mode === 'create' ? 'create' : 'enter');
  const [error, setError] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [confirmForgot, setConfirmForgot] = useState(false);
  const [wait, setWait] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkBiometric();
    if (mode !== 'create') lockWaitSeconds().then(setWait).catch(() => {});
  }, []);

  // Counts down the lock after too many wrong tries.
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  // Offer fingerprint straight away when unlocking.
  useEffect(() => {
    if (stage === 'enter' && biometricEnabled && bioAvailable) tryBiometric();
  }, [bioAvailable]);

  async function checkBiometric() {
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(hasHw && isEnrolled);
    } catch { /* no fingerprint hardware */ }
  }

  async function tryBiometric() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Use fingerprint to unlock FinSight',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) onSuccess();
    } catch { /* they can use the PIN instead */ }
  }

  function shake() {
    if (Platform.OS !== 'web') Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handlePress(digit) {
    if (pin.length >= PIN_LENGTH || wait > 0) return;
    setError('');
    const next = pin + digit;
    setPin(next);
    if (next.length < PIN_LENGTH) return;

    setTimeout(async () => {
      if (stage === 'create') {
        setConfirmPin(next); setPin(''); setStage('confirm');
      } else if (stage === 'confirm') {
        if (next === confirmPin) {
          try {
            await savePin(next);
            onSuccess();
          } catch (e) {
            setError("Couldn't save your PIN. Try again.");
            shake(); setPin(''); setStage('create'); setConfirmPin('');
          }
        } else {
          setError("Those PINs didn't match. Start again.");
          shake(); setPin(''); setStage('create'); setConfirmPin('');
        }
      } else {
        try {
          const result = await checkPin(next);
          if (result.ok) { onSuccess(); return; }
          setWait(result.waitSeconds);
          setError(result.waitSeconds ? 'Too many wrong tries.' : 'Wrong PIN. Try again.');
        } catch (e) {
          setError("Couldn't check your PIN. Try again.");
        }
        shake(); setPin('');
      }
    }, 120);
  }

  // Prove it's the phone's owner to keep the data. Otherwise the data must go,
  // or "Forgot PIN" would be a way around the PIN.
  async function forgotPin() {
    if (bioAvailable) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm it\'s you to reset your PIN',
          cancelLabel: 'Cancel',
        });
        if (result.success) {
          setError(''); setPin(''); setWait(0); setStage('create');
          return;
        }
      } catch { /* falls through to the delete option */ }
    }
    setConfirmForgot(true);
  }

  const title = stage === 'create' ? 'Create your PIN' : stage === 'confirm' ? 'Confirm your PIN' : 'Welcome back';
  const subtitle = stage === 'create' ? 'Choose 6 digits to protect your money data'
    : stage === 'confirm' ? 'Enter the same 6 digits again'
    : 'Enter your PIN to unlock';
  const showBio = stage === 'enter' && biometricEnabled && bioAvailable;

  return (
    <Gradient style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.lg }}>
        <View style={{ alignSelf: 'stretch', minHeight: 44, paddingHorizontal: space.xl, alignItems: 'flex-end', justifyContent: 'center' }}>
          {onCancel ? (
            <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={10}>
              <Text variant="bodyStrong" color="#FFFFFF">Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ alignItems: 'center', paddingHorizontal: space.xl }}>
          <Text variant="heading" family="bold" color="#FFFFFF" style={{ marginBottom: space.xl }}>FinSight</Text>
          <Text variant="title" family="bold" color="#FFFFFF" align="center" accessibilityRole="header">{title}</Text>
          <Text color="#FFFFFF" align="center" style={{ marginTop: space.xs }}>{subtitle}</Text>
          <Animated.View
            accessible
            accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}
            style={{ flexDirection: 'row', gap: space.lg, marginTop: space.xxl, transform: [{ translateX: shakeAnim }] }}
          >
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View key={i} style={{
                width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF',
                backgroundColor: i < pin.length ? '#FFFFFF' : 'transparent',
              }} />
            ))}
          </Animated.View>
          <View style={{ minHeight: 28, justifyContent: 'center', marginTop: space.sm }}>
            {error || wait > 0 ? (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: space.md, paddingVertical: space.xxs + 1 }}>
                <Text variant="label" family="semibold" color="#A30E42" accessibilityLiveRegion="assertive">
                  {wait > 0 ? `Too many wrong tries. Wait ${formatWait(wait)}.` : error}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ gap: space.md }}>
          {KEYS.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: space.xl }}>
              {row.map(key => {
                if (key === 'bio') {
                  return showBio
                    ? <Key key={key} label="Unlock with fingerprint" onPress={tryBiometric}><Icon name="finger-print" size={30} color="#FFFFFF" /></Key>
                    : <View key={key} style={{ width: 76, height: 76 }} />;
                }
                if (key === 'del') {
                  return (
                    <Key key={key} label="Delete last digit" onPress={() => { setPin(p => p.slice(0, -1)); setError(''); }}>
                      <Icon name="backspace-outline" size={28} color="#FFFFFF" />
                    </Key>
                  );
                }
                return <Key key={key} label={key} onPress={() => handlePress(key)}><Text variant="title" family="semibold" color="#FFFFFF" style={{ fontSize: 28 }}>{key}</Text></Key>;
              })}
            </View>
          ))}
        </View>

        <View style={{ minHeight: 44, justifyContent: 'center' }}>
          {stage === 'enter' && onForgot ? (
            <Pressable onPress={forgotPin} accessibilityRole="button" hitSlop={10}>
              <Text variant="bodyStrong" color="#FFFFFF">Forgot PIN?</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
      <ConfirmSheet
        visible={confirmForgot}
        destructive
        title="Delete your data to reset?"
        body="We couldn't confirm it's you, so the only way to reset your PIN is to delete all your FinSight data from this phone. You can restore a cloud backup afterwards if you made one."
        confirmLabel="Delete data and start again"
        onConfirm={() => { setConfirmForgot(false); onForgot(); }}
        onCancel={() => setConfirmForgot(false)}
      />
    </Gradient>
  );
}
