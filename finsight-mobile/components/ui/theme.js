import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useFonts } from 'expo-font';
// Imported one by one: the package's main entry would bundle all 14 font files.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/tokens';

const ThemeContext = createContext({ scheme: 'light', c: colors.light });

export function ThemeProvider({ scheme = 'light', children }) {
  const value = useMemo(() => ({ scheme, c: colors[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// Gives the children a different colour palette, e.g. light text inside a coloured card.
export function PaletteProvider({ c, scheme = 'dark', children }) {
  const value = useMemo(() => ({ scheme, c }), [c, scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Returns true once fonts are ready or have failed. A failure falls back to the
// system font rather than leaving the app stuck on a blank screen.
export function useAppFonts() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  return loaded || !!error;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (active) setReduced(value); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

// Haptics are a nicety: never let an unsupported device turn a tap into an error.
export function tapFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
