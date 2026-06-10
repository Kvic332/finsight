import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';
import { DARK, LIGHT } from '../constants/theme';
import { trackEvent } from '../services/cloudSync';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';

const QUICK_QUESTIONS = [
  'What are my top expenses?',
  'Am I on track with savings?',
  'Where can I cut spending?',
  'How long will my money last?',
  'Best investment for me now?',
  'How do I improve my FinScore?',
];

// ── Voice helpers (module-level so they don't re-create) ──────────────────────
const VOICE_OPTIONS = { language: 'en-US', pitch: 0.82, rate: 0.92 };

function cleanForSpeech(text) {
  return text
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '')
    .replace(/₦/g, 'naira ').replace(/→/g, '').replace(/•/g, '')
    .replace(/\n+/g, ' ').trim();
}

export default function ARIAScreen({ theme, user }) {
  const T = theme === 'dark' ? DARK : LIGHT;
  const s = styles(T);

  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `Hey ${user?.name?.split(' ')[0] || 'there'} 👋 I'm ARIA — your personal finance AI. I can see your spending patterns, predict cash flow, and give you honest advice. Ask me anything or tap the mic to speak.`,
  }]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [transactions,setTransactions]= useState([]);
  const [budgets,     setBudgets]     = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking,  setIsSpeaking]  = useState(false);
  const [autoSpeak,   setAutoSpeak]   = useState(true);
  const [voiceReady,  setVoiceReady]  = useState(false);

  const scrollRef  = useRef(null);
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const micAnim    = useRef(new Animated.Value(1)).current;

  // ── Load transactions whenever screen is focused ───────────────────────────
  useFocusEffect(useCallback(() => {
    Promise.all([
      AsyncStorage.getItem('finsight_transactions'),
      AsyncStorage.getItem('finsight_budgets'),
    ]).then(([tRaw, bRaw]) => {
      setTransactions(tRaw ? JSON.parse(tRaw) : []);
      setBudgets(bRaw ? JSON.parse(bRaw) : []);
    });
  }, []));

  // ── Voice (STT) setup ──────────────────────────────────────────────────────
  useEffect(() => {
    Voice.onSpeechStart   = () => { setIsListening(true); startMicPulse(); };
    Voice.onSpeechEnd     = () => { setIsListening(false); stopMicPulse(); };
    Voice.onSpeechError   = () => { setIsListening(false); stopMicPulse(); };
    Voice.onSpeechResults = (e) => {
      const text = e.value?.[0] || '';
      if (text) {
        setInput(text);
        send(text);
      }
    };

    Voice.isAvailable().then(avail => setVoiceReady(!!avail)).catch(() => setVoiceReady(false));

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Animations ─────────────────────────────────────────────────────────────
  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ])).start();
  }
  function stopPulse() { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }

  function startMicPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(micAnim, { toValue: 1.3, duration: 400, useNativeDriver: true }),
      Animated.timing(micAnim, { toValue: 1,   duration: 400, useNativeDriver: true }),
    ])).start();
  }
  function stopMicPulse() { micAnim.stopAnimation(); micAnim.setValue(1); }

  // ── Rich context for ARIA ──────────────────────────────────────────────────
  function buildContext() {
    const income = user?.income || 0;
    const debits  = transactions.filter(t => t.type === 'debit');
    const credits = transactions.filter(t => t.type === 'credit');
    const totalSpend  = debits.reduce((s, t) => s + t.amount, 0);
    const totalSaved  = credits.filter(t => t.cat === 'Savings').reduce((s, t) => s + t.amount, 0);
    const totalIncome = credits.filter(t => t.cat === 'Income').reduce((s, t) => s + t.amount, 0);
    const effectiveIncome = totalIncome > 0 ? totalIncome : income;
    const balance = effectiveIncome - totalSpend + totalSaved;
    const dailySpend = totalSpend / 30;
    const daysLeft = dailySpend > 0 ? Math.round(balance / dailySpend) : 365;
    const savingsRate = effectiveIncome > 0 ? Math.round((totalSaved / effectiveIncome) * 100) : 0;

    // Category breakdown of spending
    const catTotals = {};
    debits.forEach(t => { catTotals[t.cat] = (catTotals[t.cat] || 0) + t.amount; });
    const catSummary = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `${cat} ₦${amt.toLocaleString()}`)
      .join(', ');

    // Budget summary
    const monthKey = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
    const budgetSummary = budgets.map(b => {
      const spent = transactions.filter(t => {
        if (t.type !== 'debit') return false;
        const parts = (t.date||'').split('/');
        const txKey = parts.length===3 ? `${parts[2]}-${parts[1].padStart(2,'0')}` : '';
        const catMatch = (t.cat||'').toLowerCase() === (b.cat||'').toLowerCase();
        const kwMatch = (b.keywords||[]).some(k=>(t.desc||'').toLowerCase().includes(k.toLowerCase()));
        return txKey === monthKey && (catMatch || kwMatch);
      }).reduce((s,t)=>s+(t.amount||0),0);
      const pct = b.limit>0 ? Math.round(spent/b.limit*100) : 0;
      return `${b.icon}${b.name}: ₦${spent.toLocaleString()}/₦${b.limit.toLocaleString()} (${pct}%${pct>=100?' EXCEEDED':pct>=80?' WARNING':''})`;
    }).join(' | ');

    // Goals (handle object array from SettingsScreen)
    const goalsSummary = (user?.goals || [])
      .map(g => typeof g === 'object' ? `${g.name} (target ₦${(g.target || 0).toLocaleString()})` : String(g))
      .join(', ');

    // All transactions summary
    const recentTx = transactions.slice(0, 15)
      .map(t => `${t.type === 'debit' ? '-' : '+'}₦${t.amount.toLocaleString()} ${t.desc} [${t.cat}]`)
      .join('; ');

    return `
USER PROFILE:
Name: ${user?.name || 'User'} | Employment: ${user?.employmentType || 'Not specified'}
Monthly Income: ₦${effectiveIncome.toLocaleString()} | Salary Day: Day ${user?.salaryDay || 'not set'}
Banks: ${(user?.banks || []).join(', ') || 'Not specified'}

FINANCIAL POSITION (${transactions.length} transactions tracked):
Estimated Balance: ₦${balance.toLocaleString()}
Total Spent: ₦${totalSpend.toLocaleString()} | Total Saved: ₦${totalSaved.toLocaleString()}
Savings Rate: ${savingsRate}% | Daily Burn Rate: ₦${Math.round(dailySpend).toLocaleString()}
Broke Clock: ${daysLeft >= 365 ? '365+ days (healthy)' : `${daysLeft} days at current pace`}

SPENDING BY CATEGORY: ${catSummary || 'No spending data'}
ALL TRANSACTIONS: ${recentTx || 'None recorded yet'}
SAVINGS GOALS: ${goalsSummary || 'None set'}
MONTHLY BUDGETS: ${budgetSummary || 'No budgets set'}
    `.trim();
  }

  // ── Voice input (STT) ──────────────────────────────────────────────────────
  async function toggleMic() {
    if (isListening) {
      try { await Voice.stop(); } catch (e) {}
      setIsListening(false);
      stopMicPulse();
      return;
    }
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    try {
      setInput('');
      await Voice.start('en-US');
    } catch (e) {
      Alert.alert('Voice unavailable', 'Speech recognition is not available on this device. Please type your question instead.');
    }
  }

  // ── Voice output (TTS) ────────────────────────────────────────────────────
  function speakText(text) {
    if (!autoSpeak) return;
    if (isSpeaking) Speech.stop();
    const clean = cleanForSpeech(text);
    setIsSpeaking(true);
    Speech.speak(clean, {
      ...VOICE_OPTIONS,
      onDone:  () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  function toggleSpeak() {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    setAutoSpeak(prev => !prev);
  }

  // ── Send message to ARIA ───────────────────────────────────────────────────
  async function send(text) {
    const msg = (text || input).trim();
    if (!msg) return;
    if (isListening) { try { await Voice.stop(); } catch (e) {} }
    setInput('');
    setLoading(true);
    startPulse();

    const userMsg   = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    trackEvent('aria_messages').catch(() => {});

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 600,
          system: `You are ARIA, a brilliant personal finance AI for a Nigerian user. You are direct, warm, confident, and smart — like a trusted financial advisor friend. Always use ₦ for Nigerian amounts. Keep responses concise (3-5 sentences unless asked for detail). Be specific with numbers from the user's actual data. Here is the user's complete financial context:\n\n${buildContext()}`,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data  = await response.json();
      const reply = data.content?.[0]?.text || 'Sorry, I had trouble connecting. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      speakText(reply);
    } catch (e) {
      const errMsg = 'Connection error. Check your internet and try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setLoading(false);
      stopPulse();
    }
  }

  const isBusy = loading || isListening;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>

      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.line }]}>
        <Animated.View style={[s.ariaAvatar, { backgroundColor: T.ink, transform: [{ scale: pulseAnim }] }]}>
          <Text style={{ fontSize: 20 }}>🤖</Text>
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: T.ink }]}>ARIA</Text>
          <Text style={[s.headerSub, { color: loading ? T.limeDeep : isListening ? T.amber : T.mute }]}>
            {loading ? 'Thinking...' : isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Your AI Finance Advisor'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {/* Speaker toggle */}
          <TouchableOpacity onPress={toggleSpeak}
            style={[s.iconBtn, { backgroundColor: T.surface2 }]}>
            <Text style={{ fontSize: 16 }}>{autoSpeak ? (isSpeaking ? '🔊' : '🔈') : '🔇'}</Text>
          </TouchableOpacity>
          <View style={[s.statusDot, { backgroundColor: loading ? T.amber : '#34D399' }]} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, i) => (
            <View key={i} style={[s.msgWrap, msg.role === 'user' ? s.userWrap : s.ariaWrap]}>
              {msg.role === 'assistant' && (
                <View style={s.msgAvatar}>
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                </View>
              )}
              <View style={[
                s.bubble,
                msg.role === 'user'
                  ? { backgroundColor: T.limeDeep, borderBottomRightRadius: 4 }
                  : { backgroundColor: T.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: T.line },
              ]}>
                <Text style={[s.msgText, { color: msg.role === 'user' ? '#FFFFFF' : T.ink }]}>
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={s.ariaWrap}>
              <View style={s.msgAvatar}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={[s.bubble, { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }]}>
                <ActivityIndicator size="small" color={T.limeDeep} />
              </View>
            </View>
          )}

          {/* Quick questions — shown only on fresh conversation */}
          {messages.length === 1 && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={[s.quickLabel, { color: T.mute }]}>QUICK QUESTIONS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_QUESTIONS.map((q, i) => (
                  <TouchableOpacity key={i} style={[s.quickPill, { backgroundColor: T.surface, borderColor: T.line }]}
                    onPress={() => send(q)}>
                    <Text style={[s.quickText, { color: T.ink2 }]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input row */}
        <View style={[s.inputRow, { backgroundColor: T.bg, borderTopColor: T.line }]}>

          {/* Mic button */}
          <Animated.View style={{ transform: [{ scale: micAnim }] }}>
            <TouchableOpacity
              style={[s.micBtn, {
                backgroundColor: isListening ? T.rose : T.surface2,
                borderColor: isListening ? T.rose : T.line,
              }]}
              onPress={toggleMic}
              disabled={loading}
            >
              <Text style={{ fontSize: 20 }}>{isListening ? '⏹' : '🎙️'}</Text>
            </TouchableOpacity>
          </Animated.View>

          <TextInput
            style={[s.input, { backgroundColor: T.surface, borderColor: T.line, color: T.ink }]}
            placeholder={isListening ? 'Listening...' : 'Ask ARIA anything...'}
            placeholderTextColor={T.mute}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!isListening}
          />

          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: input.trim() ? T.lime : T.surface2 }]}
            onPress={() => send()}
            disabled={isBusy || !input.trim()}
          >
            <Text style={{ fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (T) => StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1,
  },
  ariaAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerSub:   { fontSize: 12, marginTop: 1 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  iconBtn:     { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },

  msgWrap:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userWrap: { justifyContent: 'flex-end' },
  ariaWrap: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: T.surface2, justifyContent: 'center', alignItems: 'center',
  },
  bubble:  { maxWidth: '80%', borderRadius: 18, padding: 14 },
  msgText: { fontSize: 14, lineHeight: 20 },

  quickLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  quickPill:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  quickText:  { fontSize: 12, fontWeight: '500' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1, paddingBottom: 90,
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
});
