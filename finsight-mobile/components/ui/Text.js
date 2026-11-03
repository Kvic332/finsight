import React from 'react';
import { Text as RNText } from 'react-native';
import { fontFamily, type } from '../../constants/tokens';
import { formatMoney, formatMoneyCompact } from '../../services/format';
import { useTheme } from './theme';

// Weight comes from the font family, never fontWeight: on Android, combining
// fontWeight with a custom font can silently fall back to the system font.
export function Text({
  variant = 'body', color = 'ink', family, tabular, align, style, children, ...rest
}) {
  const { c } = useTheme();
  const t = type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        {
          fontFamily: fontFamily[family || t.family],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color: c[color] || color,
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

// tone 'auto' colours money coming in, and leaves spending in the normal ink
// colour: most rows are spending, and a screen full of red would mean nothing.
export function Money({
  value, variant = 'bodyStrong', tone = 'ink', compact, kobo, showSign, style, ...rest
}) {
  const text = compact ? formatMoneyCompact(value) : formatMoney(value, { kobo, showSign });
  const color = tone === 'auto' ? (value > 0 ? 'positive' : 'ink') : tone;
  return (
    <Text variant={variant} color={color} tabular numberOfLines={1} style={style} {...rest}>
      {text}
    </Text>
  );
}
