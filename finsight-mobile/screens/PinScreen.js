import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { DARK, LIGHT } from '../constants/theme';

const PIN_LENGTH = 6;

export default function PinScreen({ theme, mode = 'create', onSuccess, onForgot, biometricEnabled = false }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const [pin, setPin]             = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage]         = useState(mode === 'create' ? 'create' : 'enter');
  const [error, setError]         = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const s = styles(T);

  useEffect(() => {
    checkBiometric();
  }, []);

  // Auto-attempt biometric when unlocking (not creating PIN)
  useEffect(() => {
    if (stage === 'enter' && biometricEnabled && bioAvailable) {
      tryBiometric();
    }
  }, [bioAvailable]);

  async function checkBiometric() {
    try {
      const hasHw      = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(hasHw && isEnrolled);
    } catch {}
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
    } catch {}
  }

  function shake() {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handlePress(digit) {
    setError('');
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length < PIN_LENGTH) return;

    setTimeout(async () => {
      if (stage === 'create') {
        setConfirmPin(newPin); setPin(''); setStage('confirm');
      } else if (stage === 'confirm') {
        if (newPin === confirmPin) {
          await AsyncStorage.setItem('finsight_pin', newPin);
          onSuccess();
        } else {
          setError('PINs do not match. Try again.');
          shake(); setPin(''); setStage('create'); setConfirmPin('');
        }
      } else if (stage === 'enter') {
        const saved = await AsyncStorage.getItem('finsight_pin');
        if (newPin === saved) { onSuccess(); }
        else { setError('Incorrect PIN. Try again.'); shake(); setPin(''); }
      }
    }, 120);
  }

  function handleDelete() { setPin(p => p.slice(0, -1)); setError(''); }

  const KEYS = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['','0','⌫'],
  ];

  const title    = stage === 'create' ? 'Create your PIN'
                 : stage === 'confirm' ? 'Confirm your PIN'
                 : 'Enter your PIN';
  const subtitle = stage === 'create' ? 'Choose a 6-digit PIN to secure your FinSight'
                 : stage === 'confirm' ? 'Enter the same PIN again to confirm'
                 : 'Your data is protected';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]}>
      <View style={s.container}>

        {/* Brand */}
        <View style={s.brand}>
          <View style={[s.brandMark, { backgroundColor: '#13131F', borderWidth: 1, borderColor: '#6366F1' }]}>
            <Text style={[s.brandLetter, { color: '#818CF8' }]}>f</Text>
          </View>
          <Text style={[s.brandName, { color: T.ink }]}>FinSight</Text>
        </View>

        <Text style={[s.title, { color: T.ink }]}>{title}</Text>
        <Text style={[s.subtitle, { color: T.mute }]}>{subtitle}</Text>

        {/* Dots */}
        <Animated.View style={[s.dots, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[
              s.dot, { borderColor: T.line2 },
              i < pin.length && { backgroundColor: T.lime, borderColor: T.lime },
            ]} />
          ))}
        </Animated.View>

        {error
          ? <Text style={[s.error, { color: T.rose }]}>{error}</Text>
          : <View style={{ height: 20 }} />}

        {/* Keypad */}
        <View style={s.keypad}>
          {KEYS.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((key, ki) => (
                key === '' ? <View key={ki} style={s.keyEmpty} /> :
                key === '⌫' ? (
                  <TouchableOpacity key={ki} style={s.keyDelete} onPress={handleDelete} activeOpacity={0.6}>
                    <Text style={[s.deleteText, { color: T.mute }]}>⌫</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity key={ki}
                    style={[s.key, { backgroundColor: T.surface, borderColor: T.line }]}
                    onPress={() => handlePress(key)} activeOpacity={0.7}>
                    <Text style={[s.keyText, { color: T.ink }]}>{key}</Text>
                  </TouchableOpacity>
                )
              ))}
            </View>
          ))}
        </View>

        {/* Biometric button — only in unlock mode */}
        {stage === 'enter' && biometricEnabled && bioAvailable && (
          <TouchableOpacity onPress={tryBiometric} style={s.bioBtn} activeOpacity={0.75}>
            <Text style={{ fontSize: 32 }}>🫆</Text>
            <Text style={[s.bioLabel, { color: T.limeDeep }]}>Use fingerprint</Text>
          </TouchableOpacity>
        )}

        {/* Forgot PIN */}
        {stage === 'enter' && onForgot && (
          <TouchableOpacity onPress={onForgot} style={s.forgotBtn}>
            <Text style={[s.forgotText, { color: T.mute }]}>Forgot PIN?</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe:       { flex: 1 },
  container:  { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:32, gap:16 },
  brand:      { flexDirection:'row', alignItems:'center', gap:10, marginBottom:16 },
  brandMark:  { width:40, height:40, borderRadius:10, justifyContent:'center', alignItems:'center' },
  brandLetter:{ fontSize:26, fontStyle:'italic', fontWeight:'400' },
  brandName:  { fontSize:20, fontWeight:'800', letterSpacing:-0.5 },
  title:      { fontSize:26, fontWeight:'800', textAlign:'center', letterSpacing:-0.5 },
  subtitle:   { fontSize:14, textAlign:'center', lineHeight:20 },
  dots:       { flexDirection:'row', gap:14, marginVertical:24 },
  dot:        { width:16, height:16, borderRadius:8, borderWidth:2, backgroundColor:'transparent' },
  error:      { fontSize:13, fontWeight:'600', textAlign:'center', minHeight:20 },
  keypad:     { gap:12, width:'100%', maxWidth:280 },
  row:        { flexDirection:'row', justifyContent:'center', gap:16 },
  key:        { width:72, height:72, borderRadius:36, justifyContent:'center', alignItems:'center', borderWidth:1, elevation:2 },
  keyText:    { fontSize:26, fontWeight:'300' },
  keyEmpty:   { width:72, height:72 },
  keyDelete:  { width:72, height:72, justifyContent:'center', alignItems:'center' },
  deleteText: { fontSize:22 },
  bioBtn:     { alignItems:'center', gap:6, marginTop:8 },
  bioLabel:   { fontSize:13, fontWeight:'700' },
  forgotBtn:  { marginTop:16, padding:10 },
  forgotText: { fontSize:14, fontWeight:'600' },
});
