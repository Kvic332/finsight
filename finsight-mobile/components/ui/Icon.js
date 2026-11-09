import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categoryTones } from '../../constants/tokens';
import { useTheme } from './theme';

export const CATEGORY_ICONS = {
  Food: 'restaurant-outline',
  Transport: 'car-outline',
  Entertainment: 'film-outline',
  Utilities: 'flash-outline',
  Health: 'medkit-outline',
  Savings: 'wallet-outline',
  Income: 'arrow-down-outline',
  Transfer: 'swap-horizontal-outline',
  Debt: 'card-outline',
  Shopping: 'bag-outline',
  Other: 'ellipsis-horizontal',
  'Between my accounts': 'repeat-outline',
  // Business
  Sales: 'cash-outline',
  'Other business income': 'trending-up-outline',
  Stock: 'cube-outline',
  'Shop rent': 'storefront-outline',
  Staff: 'people-outline',
  Delivery: 'bicycle-outline',
  'Business bills': 'receipt-outline',
  'POS charges': 'card-outline',
  'Levies & tax': 'document-text-outline',
  'Other business': 'briefcase-outline',
  'Owner pay': 'person-outline',
};

export function Icon({ name, size = 20, color = 'ink' }) {
  const { c } = useTheme();
  // Hidden from screen readers: every button with an icon already has a spoken name,
  // and a bare icon would only add a pause or a stray symbol.
  return <Ionicons name={name} size={size} color={c[color] || color} importantForAccessibility="no" accessibilityElementsHidden />;
}

export function IconTile({ name, size = 44, tone = 'neutral' }) {
  const { c } = useTheme();
  const tones = {
    neutral: { bg: c.sunken, fg: 'ink' },
    accent: { bg: c.accentSoft, fg: 'onAccentSoft' },
    positive: { bg: c.positiveSoft, fg: 'onPositiveSoft' },
    negative: { bg: c.negativeSoft, fg: 'onNegativeSoft' },
    warning: { bg: c.warningSoft, fg: 'onWarningSoft' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <View style={{
      width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={name} size={Math.round(size * 0.5)} color={t.fg} />
    </View>
  );
}

export function CategoryTile({ category, size = 44 }) {
  const { scheme } = useTheme();
  const [bg, fg] = categoryTones[scheme][category] || categoryTones[scheme].Other;
  return (
    <View style={{
      width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name={CATEGORY_ICONS[category] || CATEGORY_ICONS.Other} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}
