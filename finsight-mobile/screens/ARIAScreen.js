import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '../services/dataStore';
import * as Speech from 'expo-speech';
import { fontFamily, radius, space, type } from '../constants/tokens';
import {
  Chip, Gradient, Icon, IconButton, Text, tapFeedback, useTheme, useToast,
} from '../components/ui';
import Voice from '../services/voice';
import { trackEvent } from '../services/cloudSync';
import { askAria } from '../services/ariaClient';
import { debtsContext } from '../services/debts';
import { computePaydayPlan, formatRunway } from '../services/finance';
import { budgetSpent } from '../services/plans';

const QUICK_QUESTIONS = [
  'What are my top expenses?',
  'Will my money reach payday?',
  'Where can I cut spending?',
  'Am I on track with savings?',
  'How do I improve my FinScore?',
  'How do I start investing?',
];

const VOICE_OPTIONS = { language: 'en-US', pitch: 1, rate: 0.95 };

function cleanForSpeech(text) {
  return text.replace(/[*#•→]/g, '').replace(/₦/g, 'naira ').replace(/\n+/g, ' ').trim();
}

function AriaMark({ size = 32 }) {
  return (
    <Gradient style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="sparkles" size={Math.round(size * 0.5)} color="#FFFFFF" />
    </Gradient>
  );
}

function Bubble({ role, children }) {
  const { c } = useTheme();
  const shape = {
    maxWidth: '82%', paddingHorizontal: space.lg - 2, paddingVertical: space.md - 1, borderRadius: 20,
    overflow: 'hidden',
  };
  if (role === 'user') {
    return (
      <View style={{ alignSelf: 'flex-end', ...shape, borderBottomRightRadius: 6 }}>
        <Gradient fill />
        <Text color="#FFFFFF" selectable>{children}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
      <AriaMark size={28} />
      <View style={{ ...shape, flexShrink: 1, backgroundColor: c.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: c.line }}>
        <Text selectable>{children}</Text>
      </View>
    </View>
  );
}

export default function ARIAScreen({ navigation, user }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const firstName = user?.name?.split(' ')[0];

  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `Hi${firstName ? ` ${firstName}` : ''}, I'm ARIA. I can see your spending and budgets, so ask me anything about your money.`,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [debts, setDebts] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Off by default: reading someone's money out loud shouldn't happen unasked.
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);

  const scrollRef = useRef(null);
  const micScale = useRef(new Animated.Value(1)).current;
  const sendRef = useRef(null);

  useFocusEffect(useCallback(() => {
    Promise.all([
      AsyncStorage.getItem('finsight_transactions'),
      AsyncStorage.getItem('finsight_budgets'),
      AsyncStorage.getItem('finsight_debts'),
    ]).then(([tRaw, bRaw, dRaw]) => {
      setTransactions(tRaw ? JSON.parse(tRaw) : []);
      setBudgets(bRaw ? JSON.parse(bRaw) : []);
      setDebts(dRaw ? JSON.parse(dRaw) : []);
    });
  }, []));

  useEffect(() => {
    Voice.onSpeechStart = () => { setIsListening(true); pulseMic(); };
    Voice.onSpeechEnd = () => { setIsListening(false); stopMic(); };
    Voice.onSpeechError = () => { setIsListening(false); stopMic(); };
    Voice.onSpeechResults = e => {
      const text = e.value?.[0] || '';
      if (text) { setInput(text); sendRef.current?.(text); }
    };
    Voice.isAvailable().then(avail => setVoiceReady(!!avail)).catch(() => setVoiceReady(false));
    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  function pulseMic() {
    Animated.loop(Animated.sequence([
      Animated.timing(micScale, { toValue: 1.15, duration: 400, useNativeDriver: true }),
      Animated.timing(micScale, { toValue: 1, duration: 400, useNativeDriver: true }),
    ])).start();
  }
  function stopMic() { micScale.stopAnimation(); micScale.setValue(1); }

  function buildContext() {
    const stats = computePaydayPlan(user, transactions);
    const catSummary = Object.entries(stats.categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `${cat} ₦${amt.toLocaleString()}`)
      .join(', ');
    const budgetSummary = budgets.map(b => {
      const spent = budgetSpent(b, transactions);
      const pct = b.limit > 0 ? Math.round(spent / b.limit * 100) : 0;
      return `${b.name}${b.oneOff ? ' (one-off, not monthly)' : ''}: ₦${spent.toLocaleString()}/₦${b.limit.toLocaleString()} (${pct}%${pct >= 100 ? ' EXCEEDED' : pct >= 80 ? ' WARNING' : ''})`;
    }).join(' | ');
    const goalsSummary = (user?.goals || [])
      .map(g => (typeof g === 'object' ? `${g.name} (₦${(g.saved || 0).toLocaleString()} saved of ₦${(g.target || 0).toLocaleString()})` : String(g)))
      .join(', ');
    const recentTx = transactions.slice(0, 15)
      .map(t => `${t.type === 'debit' ? '-' : '+'}₦${t.amount.toLocaleString()} ${t.desc} [${t.cat}]`)
      .join('; ');

    return `
USER PROFILE:
Name: ${user?.name || 'User'} | Employment: ${user?.employmentType || 'Not specified'}
Monthly Income: ₦${stats.income.toLocaleString()} | Salary Day: Day ${user?.salaryDay || 'not set'}
Banks: ${(user?.banks || []).join(', ') || 'Not specified'}

THIS PAY PERIOD (${transactions.length} transactions tracked in total, ${stats.cycle.daysToGo} days until the next payday):
Estimated left until payday: ₦${stats.left.toLocaleString()} (an estimate from income and logged transactions, not a bank balance)
Safe to spend per day until payday: ₦${stats.safePerDay.toLocaleString()}
Spent: ₦${stats.totalSpend.toLocaleString()} | Saved: ₦${stats.totalSaved.toLocaleString()}
Savings Rate: ${stats.savingsRate}% | Daily spending: ₦${Math.round(stats.dailySpend).toLocaleString()}
Broke Clock: ${formatRunway(stats.daysLeft)} at current pace

SPENDING BY CATEGORY THIS PAY PERIOD: ${catSummary || 'No spending data'}
RECENT TRANSACTIONS: ${recentTx || 'None recorded yet'}
SAVINGS GOALS: ${goalsSummary || 'None set'}
MONTHLY BUDGETS: ${budgetSummary || 'No budgets set'}
DEBTS, MOST EXPENSIVE FIRST: ${debtsContext(debts)}
    `.trim();
  }

  async function toggleMic() {
    tapFeedback();
    if (isListening) {
      try { await Voice.stop(); } catch (e) { /* already stopped */ }
      setIsListening(false);
      stopMic();
      return;
    }
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    try {
      setInput('');
      await Voice.start('en-US');
    } catch (e) {
      toast.show("Voice isn't available on this phone. Type your question instead.", { tone: 'error' });
    }
  }

  function speak(text) {
    if (!autoSpeak) return;
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(cleanForSpeech(text), {
      ...VOICE_OPTIONS,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  function toggleSpeak() {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    toast.show(autoSpeak ? 'ARIA will stop reading replies aloud' : 'ARIA will read replies aloud');
    setAutoSpeak(on => !on);
  }

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (isListening) { try { await Voice.stop(); } catch (e) { /* already stopped */ } }
    setInput('');
    setLoading(true);
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    trackEvent('aria_messages').catch(() => {});
    try {
      const reply = await askAria(next, buildContext());
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: e.message }]);
    } finally {
      setLoading(false);
    }
  }
  sendRef.current = send;

  const status = loading ? 'Thinking' : isListening ? 'Listening' : isSpeaking ? 'Speaking' : 'Your money assistant';
  const canSend = !!input.trim() && !loading && !isListening;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Gradient style={{
        paddingTop: insets.top + space.xs, paddingBottom: space.md, paddingHorizontal: space.sm,
        flexDirection: 'row', alignItems: 'center', gap: space.xs,
      }}>
        <IconButton icon="arrow-back" label="Back" color="#FFFFFF" onPress={() => navigation?.goBack()} />
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: space.xs }}>
          <Text variant="heading" family="bold" color="#FFFFFF" accessibilityRole="header">ARIA</Text>
          <Text variant="caption" color="#FFFFFF" accessibilityLiveRegion="polite">{status}</Text>
        </View>
        <IconButton
          icon={autoSpeak ? 'volume-high-outline' : 'volume-mute-outline'}
          label={autoSpeak ? 'Stop reading replies aloud' : 'Read replies aloud'}
          color="#FFFFFF"
          onPress={toggleSpeak}
        />
      </Gradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
        >
          {messages.map((m, i) => <Bubble key={i} role={m.role}>{m.content}</Bubble>)}
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <AriaMark size={28} />
              <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
                <ActivityIndicator size="small" color={c.accent} />
              </View>
            </View>
          ) : null}
          {messages.length === 1 ? (
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <Text variant="label" family="semibold" color="inkMuted">Try asking</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {QUICK_QUESTIONS.map(q => <Chip key={q} label={q} onPress={() => send(q)} />)}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, backgroundColor: c.surface,
          paddingHorizontal: space.md, paddingTop: space.sm + 2, paddingBottom: space.xs,
          borderTopWidth: 1, borderTopColor: c.line,
        }}>
          {voiceReady ? (
            <Animated.View style={{ transform: [{ scale: micScale }] }}>
              <Pressable
                onPress={toggleMic}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={isListening ? 'Stop listening' : 'Ask by voice'}
                style={{
                  width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isListening ? c.negativeSoft : c.sunken,
                }}
              >
                <Icon name={isListening ? 'stop' : 'mic-outline'} size={22} color={isListening ? 'negative' : 'ink'} />
              </Pressable>
            </Animated.View>
          ) : null}
          <TextInput
            accessibilityLabel="Ask ARIA a question"
            value={input}
            onChangeText={setInput}
            placeholder={isListening ? 'Listening' : 'Ask about your money'}
            placeholderTextColor={c.inkSubtle}
            multiline
            maxLength={500}
            editable={!isListening}
            style={{
              flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: space.lg, paddingTop: space.md - 1, paddingBottom: space.md - 1,
              borderRadius: radius.lg - 2, backgroundColor: c.sunken, color: c.ink,
              fontFamily: fontFamily.regular, fontSize: type.body.fontSize, outlineStyle: 'none',
            }}
          />
          <Pressable
            onPress={() => { tapFeedback(); send(); }}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.sunken }}
          >
            {canSend ? <Gradient fill /> : null}
            <Icon name="arrow-up" size={22} color={canSend ? '#FFFFFF' : 'inkSubtle'} />
          </Pressable>
        </View>
        <View style={{ backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, space.xs), paddingHorizontal: space.md }}>
          <Text variant="caption" color="inkSubtle" align="center">ARIA can make mistakes. General information, not financial advice.</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
