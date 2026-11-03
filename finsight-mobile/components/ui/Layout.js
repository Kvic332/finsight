import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, TOUCH_TARGET } from '../../constants/tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { tapFeedback, useTheme } from './theme';

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
  const { c } = useTheme();
  const base = {
    backgroundColor: c[tone],
    borderRadius: radius.lg,
    padding: padded ? space.lg : 0,
    ...(tone === 'surface' ? {
      shadowColor: c.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 3,
    } : null),
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
  leading, title, subtitle, value, valueSubtitle, chevron, onPress, divider = true, accessibilityLabel,
}) {
  const { c } = useTheme();
  const content = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.md,
      minHeight: TOUCH_TARGET + 16, paddingHorizontal: space.lg, paddingVertical: space.md,
    }}>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="label" family="regular" color="inkMuted" numberOfLines={1}>{subtitle}</Text> : null}
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
