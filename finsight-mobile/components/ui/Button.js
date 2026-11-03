import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { radius, space } from '../../constants/tokens';
import { Gradient } from './Gradient';
import { Icon } from './Icon';
import { Text } from './Text';
import { tapFeedback, useTheme } from './theme';

function buttonColors(variant, c, pressed) {
  switch (variant) {
    case 'secondary':
      return { bg: pressed ? c.accentSoft : 'transparent', border: c.accent, fg: 'accent' };
    case 'ghost':
      return { bg: pressed ? c.sunken : 'transparent', border: 'transparent', fg: 'accent' };
    case 'danger':
      return { bg: pressed ? c.negativeSoft : 'transparent', border: c.negative, fg: 'negative' };
    default:
      return { bg: 'transparent', border: 'transparent', fg: 'onGradient' };
  }
}

// One primary button per screen. Everything else is secondary or ghost.
export function Button({
  title, onPress, variant = 'primary', icon, loading, disabled, full, accessibilityHint,
}) {
  const { c } = useTheme();
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  const fg = buttonColors(variant, c, false).fg;
  const fgColor = fg === 'onGradient' ? '#FFFFFF' : c[fg];
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress?.(); }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => {
        const b = buttonColors(variant, c, pressed);
        return {
          minHeight: 54,
          paddingHorizontal: space.xl,
          borderRadius: radius.md,
          borderWidth: isPrimary ? 0 : 1.5,
          backgroundColor: b.bg,
          borderColor: b.border,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: full ? 'stretch' : 'flex-start',
          overflow: 'hidden',
          opacity: disabled ? 0.5 : pressed && isPrimary ? 0.88 : 1,
        };
      }}
    >
      {isPrimary ? <Gradient fill /> : null}
      {loading ? (
        <ActivityIndicator size="small" color={fgColor} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {icon ? <Icon name={icon} size={18} color={fgColor} /> : null}
          <Text variant="bodyStrong" family="bold" color={fgColor}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color = 'ink', size = 22, background }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: background || (pressed ? c.sunken : 'transparent'),
        opacity: pressed && background ? 0.8 : 1,
      })}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}
