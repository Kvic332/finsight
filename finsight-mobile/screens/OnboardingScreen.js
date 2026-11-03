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
  const [data, setData] = useState({ name: '', income: '', salaryDay: '25', banks: [], goals: [] });

  const set = patch => setData(d => ({ ...d, ...patch }));

  function next() {
    if (step === 0 && !data.name.trim()) { setErrors({ name: 'Enter your name to continue' }); return; }
    if (step === 1 && !parseAmount(data.income)) { setErrors({ income: 'Enter your monthly income, like 450,000' }); return; }
    setErrors({});
    if (step < 3) setStep(s => s + 1);
    else setShowPin(true);
  }

  if (showPin) {
    return (
      <PinScreen
        mode="create"
        onCancel={() => setShowPin(false)}
        onSuccess={() => onComplete({
          name: data.name.trim(),
          income: parseAmount(data.income) || 0,
          salaryDay: data.salaryDay,
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
      title: 'What comes in each month?',
      body: 'This lets FinSight work out what you can safely spend.',
      content: (
        <View style={{ gap: space.xl }}>
          <Input
            label="Monthly income"
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
    2: {
      title: 'Which banks do you use?',
      body: 'Optional. This helps FinSight recognise your bank alerts and gives ARIA better answers.',
      content: (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {BANKS.map(b => <Chip key={b} label={b} selected={data.banks.includes(b)} onPress={() => set({ banks: toggled(data.banks, b) })} />)}
        </View>
      ),
    },
    3: {
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
            onPress={() => { tapFeedback(); setErrors({}); setStep(s => s - 1); }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="arrow-back" size={24} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar value={step / 3} label={`Step ${step} of 3`} />
          </View>
          <Text variant="label" color="inkMuted" tabular>{step} of 3</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: space.xl, gap: space.sm }}>
          <Text variant="title" family="bold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36 }}>{current.title}</Text>
          <Text color="inkMuted" style={{ marginBottom: space.lg }}>{current.body}</Text>
          {current.content}
        </ScrollView>
        <View style={{ padding: space.xl, gap: space.xs }}>
          <Button full title={step === 3 ? 'Continue to PIN' : 'Continue'} onPress={next} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
