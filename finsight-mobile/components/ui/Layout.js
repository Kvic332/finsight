import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { heroes, heroInk, radius, space, TOUCH_TARGET } from '../../constants/tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { PaletteProvider, tapFeedback, useTheme } from './theme';

export function Screen({ children, scroll = true, refreshControl, edges = ['top'], contentStyle }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={edges}>
      {scroll ? (
        <ScrollView
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ padding: space.lg, paddingBottom: space.huge, gap: space.xxl }, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : children}
    </SafeAreaView>
  );
}

// Raised white card with a soft plum-tinted shadow, in the warm style.
export function Card({ children, onPress, padded = true, tone = 'surface', style, accessibilityLabel }) {
  const { c, scheme } = useTheme();
  const base = {
    backgroundColor: c[tone],
    borderRadius: radius.lg,
    padding: padded ? space.lg : 0,
    ...(tone === 'surface' ? {
      shadowColor: c.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 3,
    } : null),
    // In dark mode a faint edge lifts the card off the page.
    ...(tone === 'surface' && scheme === 'dark' ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' } : null),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { backgroundColor: c.sunken }, style]}
    >
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
      <Text variant="heading" accessibilityRole="header">{title}</Text>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text variant="label" color="accent">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Flat rows with hairlines for lists. Use inside <Card padded={false}>.
export function ListRow({
  leading, title, subtitle, subtitleLines = 1, value, valueSubtitle, chevron, onPress, divider = true, accessibilityLabel,
}) {
  const { c } = useTheme();
  const content = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.md,
      minHeight: TOUCH_TARGET + 16, paddingHorizontal: space.lg, paddingVertical: space.md,
    }}>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" family="semibold" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="label" family="regular" color="inkMuted" numberOfLines={subtitleLines}>{subtitle}</Text> : null}
      </View>
      {value || valueSubtitle ? (
        <View style={{ alignItems: 'flex-end', flexShrink: 0, maxWidth: '50%' }}>
          {typeof value === 'string'
            ? <Text variant="bodyStrong" numberOfLines={1}>{value}</Text>
            : value}
          {valueSubtitle ? <Text variant="caption" color="inkSubtle" numberOfLines={1}>{valueSubtitle}</Text> : null}
        </View>
      ) : null}
      {chevron ? <Icon name="chevron-forward" size={18} color="inkSubtle" /> : null}
    </View>
  );
  const border = divider ? { borderBottomWidth: 1, borderBottomColor: c.line } : null;
  if (!onPress) return <View style={border}>{content}</View>;
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [border, pressed && { backgroundColor: c.sunken }]}
    >
      {content}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

export function EmptyState({ icon, title, body, action }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm }}>
      {icon ? <Icon name={icon} size={28} color="inkSubtle" /> : null}
      <Text variant="heading" align="center">{title}</Text>
      {body ? <Text color="inkMuted" align="center">{body}</Text> : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

// A soft warm light from the top-right corner of a hero card. A gradient, not circles,
// so it fades smoothly without rings.
const HERO_GLOW = ['rgba(255,176,128,0.20)', 'rgba(255,176,128,0.06)', 'rgba(255,176,128,0)'];

// The one coloured card on a screen (Home's top cards). Content inside gets light colours.
export function HeroCard({ tint = 'personal', children, onPress, style, accessibilityLabel }) {
  const [from, to] = heroes[tint] || heroes.personal;
  const content = pressed => (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{
        borderRadius: radius.lg, padding: space.lg, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', opacity: pressed ? 0.92 : 1,
      }, style]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={HERO_GLOW}
        locations={[0, 0.35, 0.7]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.8 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <PaletteProvider c={heroInk}>{children}</PaletteProvider>
    </LinearGradient>
  );
  const shadow = { flex: style?.flex, shadowColor: to, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 22, elevation: 6, borderRadius: radius.lg };
  if (!onPress) return <View style={shadow}>{content(false)}</View>;
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={shadow}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}
