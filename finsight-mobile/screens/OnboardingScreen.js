import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DARK, LIGHT } from '../constants/theme';
import PinScreen from './PinScreen';

const { width } = Dimensions.get('window');

const BANKS = [
  'Access Bank','Zenith Bank','GTBank','First Bank','UBA',
  'Fidelity Bank','Sterling Bank','Kuda Bank','OPay','PalmPay',
  'Moniepoint','Carbon','Piggyvest','Cowrywise','Wema Bank',
  'Polaris Bank','Union Bank','Stanbic IBTC','Citibank','Other',
];
const GOALS = ['Emergency Fund','New Laptop','Travel','House','Car','Business','Wedding','Education'];
const PERSONALITIES = [
  { id:'saver', label:'🐿️ The Saver', desc:'I save first, spend later' },
  { id:'spender', label:'🦋 The Spender', desc:'I enjoy my money now' },
  { id:'investor', label:'🦅 The Investor', desc:'I make my money work' },
  { id:'balanced', label:'⚖️ The Balanced', desc:'I try to do it all' },
];

// Salary days 1-31 plus special options
const SALARY_DAYS = Array.from({length:31}, (_,i)=>`${i+1}`).concat(['Last day','Variable']);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function OnboardingScreen({ onComplete, theme }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const [step, setStep] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [data, setData] = useState({
    name:'', email:'', phone:'', income:'', salaryDay:'25',
    banks:[], goals:[], personality:'',
  });

  const totalSteps = 7; // welcome+email, verify, profile, income, banks, goals, personality
  const progress = (step / (totalSteps - 1)) * 100;
  const s = styles(T);

  function next() {
    if (step === 0) {
      if (!data.name.trim()) return Alert.alert('Required','Please enter your name');
      if (!data.email.trim() || !data.email.includes('@')) return Alert.alert('Required','Please enter a valid email');
    }
    if (step === 1 && !otpSent) return Alert.alert('Verify','Please verify your email first');
    if (step === 2) {
      if (!data.phone.trim()) return Alert.alert('Required','Please enter your phone number');
    }
    if (step === 3) {
      if (!data.income.trim()) return Alert.alert('Required','Please enter your monthly income');
    }
    if (step < totalSteps - 1) setStep(s => s + 1);
    else setShowPin(true); // Last step → create PIN
  }

  async function sendOTP() {
    if (!data.email.includes('@')) return Alert.alert('Invalid','Please enter a valid email address');
    setOtpLoading(true);
    await new Promise(r => setTimeout(r, 1500)); // Simulate API call
    const otp = generateOTP();
    setGeneratedOTP(otp);
    setOtpLoading(false);
    // In production: send real email via SendGrid/Mailgun
    // For now show OTP in alert (development mode)
    Alert.alert(
      '📧 OTP Sent',
      `Your verification code has been sent to ${data.email}\n\n[Development mode: ${otp}]`,
      [{ text: 'OK' }]
    );
  }

  function verifyOTP() {
    if (otpCode === generatedOTP) {
      setOtpSent(true);
      setStep(2);
    } else {
      Alert.alert('Wrong code','The OTP you entered is incorrect. Please try again.');
    }
  }

  const steps = [
    // Step 0 — Welcome + Name + Email
    <View key={0} style={s.stepWrap}>
      <View style={[s.brandMark, { backgroundColor: T.ink }]}>
        <Text style={[s.brandLetter, { color: T.lime }]}>f</Text>
      </View>
      <Text style={[s.heroTitle, { color: T.ink }]}>
        Personal Finance,{'\n'}<Text style={{ color: T.lime, fontStyle:'italic' }}>Clearer.</Text>
      </Text>
      <Text style={[s.heroSub, { color: T.mute }]}>
        Track every naira. Understand your money. Build wealth — one transaction at a time.
      </Text>
      <View style={s.fieldGroup}>
        <View style={s.fieldWrap}>
          <Text style={[s.fieldLabel, { color: T.mute }]}>FULL NAME</Text>
          <TextInput style={[s.input, { backgroundColor:T.surface, borderColor:T.line, color:T.ink }]}
            placeholder="e.g. John Doe"
            placeholderTextColor={T.mute} value={data.name}
            onChangeText={v => setData({...data, name:v})} autoFocus />
        </View>
        <View style={s.fieldWrap}>
          <Text style={[s.fieldLabel, { color: T.mute }]}>EMAIL ADDRESS</Text>
          <TextInput style={[s.input, { backgroundColor:T.surface, borderColor:T.line, color:T.ink }]}
            placeholder="you@example.com"
            placeholderTextColor={T.mute} value={data.email}
            onChangeText={v => setData({...data, email:v})}
            keyboardType="email-address" autoCapitalize="none" />
        </View>
      </View>
      <View style={[s.trustBadge, { backgroundColor:T.surface, borderColor:T.line }]}>
        <Text style={{ fontSize:12 }}>🔒</Text>
        <Text style={[s.trustText, { color: T.mute }]}>256-bit encrypted · No card required · Free forever</Text>
      </View>
    </View>,

    // Step 1 — Email OTP Verification
    <View key={1} style={s.stepWrap}>
      <Text style={[s.stepEyebrow, { color: T.mute }]}>STEP 02 · VERIFY EMAIL</Text>
      <Text style={[s.stepTitle, { color: T.ink }]}>Check your inbox.</Text>
      <Text style={[s.stepSub, { color: T.mute }]}>
        We'll send a 6-digit code to{'\n'}<Text style={{ color: T.limeDeep, fontWeight:'700' }}>{data.email || 'your email'}</Text>
      </Text>
      {!otpSent ? (
        <View style={{ gap: 16 }}>
          <TouchableOpacity
            style={[s.otpSendBtn, { backgroundColor: T.ink }]}
            onPress={sendOTP} disabled={otpLoading}
          >
            {otpLoading
              ? <ActivityIndicator color={T.lime} />
              : <Text style={[s.otpSendText, { color: T.lime }]}>Send verification code →</Text>
            }
          </TouchableOpacity>
          <View style={s.fieldWrap}>
            <Text style={[s.fieldLabel, { color: T.mute }]}>ENTER 6-DIGIT CODE</Text>
            <TextInput
              style={[s.input, s.otpInput, { backgroundColor:T.surface, borderColor:T.line, color:T.limeDeep }]}
              placeholder="000000"
              placeholderTextColor={T.mute}
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
          <TouchableOpacity
            style={[s.verifyBtn, { backgroundColor: otpCode.length===6 ? T.lime : T.surface2 }]}
            onPress={verifyOTP} disabled={otpCode.length < 6}
          >
            <Text style={[s.verifyText, { color: otpCode.length===6 ? T.ink : T.mute }]}>Verify Email</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.verifiedBox, { backgroundColor:T.limeDeep+'22', borderColor:T.limeDeep }]}>
          <Text style={{ fontSize:32 }}>✅</Text>
          <Text style={[s.verifiedText, { color: T.limeDeep }]}>Email verified!</Text>
        </View>
      )}
    </View>,

    // Step 2 — Phone
    <View key={2} style={s.stepWrap}>
      <Text style={[s.stepEyebrow, { color: T.mute }]}>STEP 03 · CONTACT</Text>
      <Text style={[s.stepTitle, { color: T.ink }]}>Your phone number</Text>
      <Text style={[s.stepSub, { color: T.mute }]}>Used for SMS transaction detection and account recovery.</Text>
      <View style={s.fieldWrap}>
        <Text style={[s.fieldLabel, { color: T.mute }]}>PHONE NUMBER</Text>
        <View style={{ flexDirection:'row', gap:10 }}>
          <View style={[s.countryCode, { backgroundColor:T.surface, borderColor:T.line }]}>
            <Text style={[{ color:T.ink, fontWeight:'600' }]}>🇳🇬 +234</Text>
          </View>
          <TextInput
            style={[s.input, { flex:1, backgroundColor:T.surface, borderColor:T.line, color:T.ink }]}
            placeholder="800 000 0000"
            placeholderTextColor={T.mute}
            value={data.phone}
            onChangeText={v => setData({...data, phone:v})}
            keyboardType="phone-pad"
            autoFocus
          />
        </View>
      </View>
    </View>,

    // Step 3 — Income + Salary Day
    <View key={3} style={s.stepWrap}>
      <Text style={[s.stepEyebrow, { color: T.mute }]}>STEP 04 · INCOME</Text>
      <Text style={[s.stepTitle, { color: T.ink }]}>What's your monthly income?</Text>
      <Text style={[s.stepSub, { color: T.mute }]}>This helps calculate your FinScore and personalize ARIA's advice.</Text>
      <View style={s.fieldWrap}>
        <Text style={[s.fieldLabel, { color: T.mute }]}>MONTHLY INCOME (₦)</Text>
        <TextInput
          style={[s.input, { fontSize:28, fontWeight:'700', color:T.limeDeep, backgroundColor:T.surface, borderColor:T.line }]}
          placeholder="450,000"
          placeholderTextColor={T.mute}
          value={data.income}
          onChangeText={v => setData({...data, income:v})}
          keyboardType="numeric" autoFocus
        />
      </View>
      <View style={s.fieldWrap}>
        <Text style={[s.fieldLabel, { color: T.mute }]}>SALARY DAY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {SALARY_DAYS.map(d => (
            <TouchableOpacity key={d}
              style={[s.pill, { borderColor:T.line, backgroundColor:T.surface }, data.salaryDay===d && { backgroundColor:T.ink, borderColor:T.ink }]}
              onPress={() => setData({...data, salaryDay:d})}
            >
              <Text style={[s.pillText, { color:T.ink2 }, data.salaryDay===d && { color:T.lime }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>,

    // Step 4 — Banks
    <View key={4} style={s.stepWrap}>
      <Text style={[s.stepEyebrow, { color: T.mute }]}>STEP 05 · BANKS</Text>
      <Text style={[s.stepTitle, { color: T.ink }]}>Which banks do you use?</Text>
      <Text style={[s.stepSub, { color: T.mute }]}>Helps us accurately parse your SMS alerts and notifications.</Text>
      <View style={s.pillGrid}>
        {BANKS.map(b => (
          <TouchableOpacity key={b}
            style={[s.pill, { borderColor:T.line, backgroundColor:T.surface }, data.banks.includes(b) && { backgroundColor:T.ink, borderColor:T.ink }]}
            onPress={() => {
              const banks = data.banks.includes(b) ? data.banks.filter(x=>x!==b) : [...data.banks, b];
              setData({...data, banks});
            }}
          >
            <Text style={[s.pillText, { color:T.ink2 }, data.banks.includes(b) && { color:T.lime }]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 5 — Goals
    <View key={5} style={s.stepWrap}>
      <Text style={[s.stepEyebrow, { color: T.mute }]}>STEP 06 · GOALS</Text>
      <Text style={[s.stepTitle, { color: T.ink }]}>What are you saving for?</Text>
      <Text style={[s.stepSub, { color: T.mute }]}>Pick your priorities — ARIA will help you stay on track.</Text>
      <View style={s.pillGrid}>
        {GOALS.map(g => (
          <TouchableOpacity key={g}
            style={[s.pill, s.pillLg, { borderColor:T.line, backgroundColor:T.surface }, data.goals.includes(g) && { backgroundColor:T.ink, borderColor:T.ink }]}
            onPress={() => {
              const goals = data.goals.includes(g) ? data.goals.filter(x=>x!==g) : [...data.goals, g];
              setData({...data, goals});
            }}
          >
            <Text style={[s.pillText, { color:T.ink2 }, data.goals.includes(g) && { color:T.lime }]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 6 — Personality
    <View key={6} style={s.stepWrap}>
      <Text style={[s.stepEyebrow, { color: T.mute }]}>STEP 07 · PERSONALITY</Text>
      <Text style={[s.stepTitle, { color: T.ink }]}>What's your money style?</Text>
      <Text style={[s.stepSub, { color: T.mute }]}>Shapes how ARIA speaks to you and what advice she gives.</Text>
      <View style={{ gap: 12 }}>
        {PERSONALITIES.map(p => (
          <TouchableOpacity key={p.id}
            style={[s.personalityCard, { backgroundColor:T.surface, borderColor:T.line }, data.personality===p.id && { borderColor:T.lime, backgroundColor:T.surface2 }]}
            onPress={() => setData({...data, personality:p.id})}
          >
            <Text style={[s.personalityLabel, { color:T.ink }]}>{p.label}</Text>
            <Text style={[s.personalityDesc, { color:T.mute }]}>{p.desc}</Text>
            {data.personality===p.id && <View style={[s.checkDot, { backgroundColor:T.lime }]} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>,
  ];

  if (showPin) {
    return (
      <PinScreen
        theme={theme}
        mode="create"
        onSuccess={() => {
          onComplete({
            ...data,
            income: parseInt(data.income.replace(/,/g,'')) || 0,
            setupComplete: true,
            createdAt: new Date().toISOString(),
          });
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]}>
      {/* Progress */}
      <View style={[s.progressTrack, { backgroundColor: T.line }]}>
        <View style={[s.progressFill, { width:`${progress}%`, backgroundColor:T.lime }]} />
      </View>
      <View style={s.stepCounter}>
        <Text style={[s.stepCountText, { color: T.mute }]}>{step + 1} / {totalSteps}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {steps[step]}
        </ScrollView>

        <View style={[s.footer, { borderTopColor:T.line, backgroundColor:T.bg }]}>
          {step > 0 && (
            <TouchableOpacity style={s.backBtn} onPress={() => setStep(s=>s-1)}>
              <Text style={[s.backText, { color:T.mute }]}>← Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.nextBtn, { backgroundColor:T.lime }]} onPress={next} activeOpacity={0.85}>
            <Text style={s.nextText}>
              {step === totalSteps-1 ? 'Create PIN & Start →' : 'Continue →'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe: { flex:1 },
  scroll: { padding:24, paddingBottom:40 },
  stepWrap: { flex:1, gap:18 },
  progressTrack: { height:3 },
  progressFill: { height:3, borderRadius:2 },
  stepCounter: { padding:16, paddingBottom:8, alignItems:'flex-end' },
  stepCountText: { fontSize:12, fontWeight:'600', letterSpacing:1 },

  brandMark: { width:56, height:56, borderRadius:14, justifyContent:'center', alignItems:'center', marginBottom:4 },
  brandLetter: { fontSize:34, fontStyle:'italic', fontWeight:'400' },
  heroTitle: { fontSize:36, fontWeight:'800', lineHeight:42, letterSpacing:-1 },
  heroSub: { fontSize:15, lineHeight:22 },

  stepEyebrow: { fontSize:10, letterSpacing:2, fontWeight:'700' },
  stepTitle: { fontSize:26, fontWeight:'800', letterSpacing:-0.5, lineHeight:32 },
  stepSub: { fontSize:14, lineHeight:20 },

  fieldGroup: { gap:14 },
  fieldWrap: { gap:8 },
  fieldLabel: { fontSize:10, letterSpacing:2, fontWeight:'700' },
  input: { borderWidth:1, borderRadius:14, padding:16, fontSize:16, color:'#000', fontWeight:'500' },
  otpInput: { fontSize:28, fontWeight:'700', letterSpacing:8, textAlign:'center' },

  countryCode: { borderWidth:1, borderRadius:14, padding:16, justifyContent:'center' },

  otpSendBtn: { borderRadius:14, padding:16, alignItems:'center' },
  otpSendText: { fontSize:15, fontWeight:'700' },
  verifyBtn: { borderRadius:14, padding:16, alignItems:'center' },
  verifyText: { fontSize:15, fontWeight:'700' },
  verifiedBox: { borderRadius:16, padding:24, alignItems:'center', gap:10, borderWidth:1 },
  verifiedText: { fontSize:18, fontWeight:'700' },

  trustBadge: { flexDirection:'row', alignItems:'center', gap:8, padding:12, borderRadius:12, borderWidth:1 },
  trustText: { fontSize:12 },

  pillRow: { gap:8, paddingVertical:4 },
  pillGrid: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  pill: { paddingHorizontal:14, paddingVertical:9, borderRadius:999, borderWidth:1 },
  pillLg: { paddingHorizontal:16, paddingVertical:11 },
  pillText: { fontSize:13, fontWeight:'500' },

  personalityCard: { borderRadius:16, padding:18, borderWidth:1.5, position:'relative' },
  personalityLabel: { fontSize:16, fontWeight:'700', marginBottom:4 },
  personalityDesc: { fontSize:13 },
  checkDot: { position:'absolute', top:18, right:18, width:10, height:10, borderRadius:5 },

  footer: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:20, paddingBottom:28, borderTopWidth:1 },
  backBtn: { padding:10 },
  backText: { fontSize:14, fontWeight:'600' },
  nextBtn: { flex:1, marginLeft:12, borderRadius:14, padding:16, alignItems:'center' },
  nextText: { fontSize:15, fontWeight:'800', color:'#0E120F' },
});
