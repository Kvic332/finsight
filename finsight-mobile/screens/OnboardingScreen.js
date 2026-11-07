import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Button, Chip, Gradient, Icon, Input, ProgressBar, Text, tapFeedback, useTheme,
} from '../components/ui';
import { parseAmount } from '../services/format';
import { normalizeGoals } from '../services/plans';
import PinScreen from './PinScreen';
import { USAGES } from '../services/usage';

const BANKS = [
  'Access Bank', 'Zenith Bank', 'GTBank', 'First Bank', 'UBA', 'Fidelity Bank', 'Sterling Bank', 'Kuda Bank',
  'OPay', 'PalmPay', 'Moniepoint', 'Carbon', 'PiggyVest', 'Cowrywise', 'Wema Bank', 'Polaris Bank', 'Union Bank',
  'Stanbic IBTC', 'Other',
];
const GOALS = ['Emergency Fund', 'New Laptop', 'Travel', 'House', 'Car', 'Business', 'Wedding', 'Education'];
const COMMON_PAYDAYS = ['1', '15', '25', '26', '27', '28', '30'];

function toggled(list, item) {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
}

function Welcome({ name, error, onName, onNext }) {
  const { c } = useTheme();
  return (
    <Gradient style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: space.xxl, justifyContent: 'space-between', gap: space.xxl }}>
            <Text variant="heading" family="bold" color="#FFFFFF">FinSight</Text>
            <View style={{ gap: space.md }}>
              <Text variant="display" family="bold" color="#FFFFFF" accessibilityRole="header" style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.2 }}>
                Know if your money will reach payday.
              </Text>
              <Text color="#FFFFFF" style={{ fontSize: 17, lineHeight: 25 }}>
                See what you can safely spend each day, before you run short.
              </Text>
            </View>
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md }}>
              <Input
                label="What should we call you?"
                placeholder="Your first name"
                value={name}
                error={error}
                onChangeText={onName}
                autoCapitalize="words"
                returnKeyType="done"
              />
              <Button full title="Get started" onPress={onNext} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Gradient>
  );
}

export default function OnboardingScreen({ onComplete }) {
  const { c, scheme } = useTheme();
  const [step, setStep] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [data, setData] = useState({ name: '', usage: 'salary', income: '', salaryDay: '25', banks: [], goals: [] });
  const tracking = data.usage === 'tracking';
  const business = data.usage === 'business';
  const LAST = 4;

  const set = patch => setData(d => ({ ...d, ...patch }));

  function next() {
    if (step === 0 && !data.name.trim()) { setErrors({ name: 'Enter your name to continue' }); return; }
    // Business income is optional: it varies, and recent months are used once recorded.
    if (step === 2 && !business && !parseAmount(data.income)) { setErrors({ income: 'Enter your monthly income, like 450,000' }); return; }
    setErrors({});
    // Someone only tracking spending isn't asked about income or payday.
    if (step === 1 && tracking) setStep(3);
    else if (step < LAST) setStep(s => s + 1);
    else setShowPin(true);
  }

  if (showPin) {
    return (
      <PinScreen
        mode="create"
        onCancel={() => setShowPin(false)}
        onSuccess={() => onComplete({
          name: data.name.trim(),
          usage: data.usage,
          income: tracking ? 0 : parseAmount(data.income) || 0,
          salaryDay: tracking ? '' : data.salaryDay,
          banks: data.banks,
          goals: normalizeGoals(data.goals),
          setupComplete: true,
          createdAt: new Date().toISOString(),
        })}
      />
    );
  }

  if (step === 0) {
    return <Welcome name={data.name} error={errors.name} onName={v => { set({ name: v }); setErrors({}); }} onNext={next} />;
  }

  const steps = {
    1: {
      title: 'How will you use FinSight?',
      body: 'This shapes your Home screen. You can change it any time in Settings.',
      content: (
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {USAGES.map(u => {
            const on = data.usage === u.value;
            return (
              <Pressable
                key={u.value}
                onPress={() => { tapFeedback(); set({ usage: u.value, ...(u.value === 'business' ? { salaryDay: '' } : null) }); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg,
                  borderWidth: on ? 1.5 : 1, borderColor: on ? c.accent : c.line,
                  backgroundColor: on ? c.accentSoft : pressed ? c.sunken : c.surface,
                })}
              >
                <Icon name={u.icon} size={24} color={on ? 'accent' : 'inkMuted'} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" family="semibold">{u.label}</Text>
                  <Text variant="label" family="regular" color="inkMuted">{u.about}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ),
    },
    2: {
      title: business ? 'What does the business bring in?' : 'What comes in each month?',
      body: business
        ? 'Optional. Roughly what you take home in a usual month. Once you record a few months of income, FinSight uses your real average.'
        : 'This lets FinSight work out what you can safely spend.',
      content: (
        <View style={{ gap: space.xl }}>
          <Input
            label={business ? 'Usual monthly income (optional)' : 'Monthly income'}
            prefix="₦"
            placeholder="450,000"
            keyboardType="numeric"
            value={data.income}
            error={errors.income}
            onChangeText={v => { set({ income: v }); setErrors({}); }}
          />
          <View style={{ gap: space.sm }}>
            <Text variant="label">When do you get paid?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {COMMON_PAYDAYS.map(d => (
                <Chip key={d} label={`Day ${d}`} selected={data.salaryDay === d} onPress={() => set({ salaryDay: d })} />
              ))}
              <Chip label="Last day" selected={data.salaryDay === '31'} onPress={() => set({ salaryDay: '31' })} />
              <Chip label="It varies" selected={data.salaryDay === ''} onPress={() => set({ salaryDay: '' })} />
            </View>
            <Text variant="caption" color="inkMuted">You can set any other day in Settings.</Text>
          </View>
        </View>
      ),
    },
    3: {
      title: 'Which banks do you use?',
      body: 'Optional. This helps FinSight recognise your bank alerts and gives ARIA better answers.',
      content: (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {BANKS.map(b => <Chip key={b} label={b} selected={data.banks.includes(b)} onPress={() => set({ banks: toggled(data.banks, b) })} />)}
        </View>
      ),
    },
    4: {
      title: 'What are you saving for?',
      body: 'Optional. Pick anything that matters to you. You can add or remove goals later in Plan.',
      content: (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {GOALS.map(g => <Chip key={g} label={g} selected={data.goals.includes(g)} onPress={() => set({ goals: toggled(data.goals, g) })} />)}
        </View>
      ),
    },
  };
  const current = steps[step];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <Pressable
            onPress={() => { tapFeedback(); setErrors({}); setStep(s => (s === 3 && tracking ? 1 : s - 1)); }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="arrow-back" size={24} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar value={step / LAST} label={`Step ${step} of ${LAST}`} />
          </View>
          <Text variant="label" color="inkMuted" tabular>{`${step} of ${LAST}`}</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: space.xl, gap: space.sm }}>
          <Text variant="title" family="bold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36 }}>{current.title}</Text>
          <Text color="inkMuted" style={{ marginBottom: space.lg }}>{current.body}</Text>
          {current.content}
        </ScrollView>
        <View style={{ padding: space.xl, gap: space.xs }}>
          <Button full title={step === LAST ? 'Continue to PIN' : 'Continue'} onPress={next} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
