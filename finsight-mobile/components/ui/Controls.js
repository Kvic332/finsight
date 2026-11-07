import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { fontFamily, motion, radius, space, TOUCH_TARGET, type } from '../../constants/tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { tapFeedback, useReducedMotion, useTheme } from './theme';

export function Chip({ label, selected, onPress, icon }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => ({
        minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1,
        flexDirection: 'row', alignItems: 'center', gap: space.xs, overflow: 'hidden',
        // Selected is a soft tint with an accent outline, not a gradient.
        backgroundColor: selected ? c.accentSoft : pressed ? c.lineStrong : c.sunken,
        borderColor: selected ? c.accent : 'transparent',
      })}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? 'onAccentSoft' : 'ink'} /> : null}
      <Text variant="label" family={selected ? 'semibold' : 'medium'} color={selected ? 'onAccentSoft' : 'ink'}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral', icon }) {
  const { c } = useTheme();
  const tones = {
    neutral: { bg: c.sunken, fg: 'inkMuted' },
    accent: { bg: c.accentSoft, fg: 'onAccentSoft' },
    positive: { bg: c.positiveSoft, fg: 'onPositiveSoft' },
    negative: { bg: c.negativeSoft, fg: 'onNegativeSoft' },
    warning: { bg: c.warningSoft, fg: 'onWarningSoft' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start',
      paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.sm, backgroundColor: t.bg,
    }}>
      {icon ? <Icon name={icon} size={14} color={t.fg} /> : null}
      <Text variant="caption" family="medium" color={t.fg}>{label}</Text>
    </View>
  );
}

// options: [{ value, label }]
export function SegmentedControl({ options, value, onChange }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: c.sunken, borderRadius: radius.md, padding: space.xs }}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => { tapFeedback(); onChange?.(option.value); }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: space.xs, borderRadius: radius.sm,
              backgroundColor: selected ? c.surface : 'transparent',
            }}
          >
            <Text variant="label" color={selected ? 'ink' : 'inkMuted'} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value = 0, tone = 'accent', height = 6, label }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const width = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    if (reduced) { width.setValue(clamped); return; }
    Animated.timing(width, { toValue: clamped, duration: motion.slow, useNativeDriver: false }).start();
  }, [clamped, reduced, width]);
  const fill = { accent: c.accent, positive: c.positive, negative: c.negative, warning: c.warning }[tone] || c.accent;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: radius.pill, backgroundColor: c.line, overflow: 'hidden' }}
    >
      <Animated.View style={{
        height: '100%', borderRadius: radius.pill, backgroundColor: fill,
        width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }} />
    </View>
  );
}

export function Input({
  label, value, onChangeText, placeholder, error, hint, prefix, secureTextEntry, ...rest
}) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.negative : focused ? c.accent : c.lineStrong;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: TOUCH_TARGET,
        paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: focused || error ? 2 : 1,
        borderColor, backgroundColor: c.surface,
      }}>
        {prefix ? <Text color="inkMuted" tabular>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.inkSubtle}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, minWidth: 0, color: c.ink, paddingVertical: space.sm,
            fontFamily: fontFamily.regular, fontSize: type.body.fontSize,
          }}
          {...rest}
        />
      </View>
      {error
        ? <Text variant="caption" color="negative" accessibilityLiveRegion="polite">{error}</Text>
        : hint ? <Text variant="caption" color="inkSubtle">{hint}</Text> : null}
    </View>
  );
}

export function Skeleton({ width = '100%', height = 16, rounded = radius.sm }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: rounded, backgroundColor: c.sunken, opacity }}
    />
  );
}
