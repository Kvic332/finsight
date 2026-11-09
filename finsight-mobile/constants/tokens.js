// ── FinSight design tokens ────────────────────────────────────────────────────
// Every colour, size and duration in the new UI comes from here. Components use
// these names rather than raw values, so light and dark always stay in step.
// tests/tokens.test.mjs checks the text contrast of the pairs listed in
// CONTRAST_PAIRS, so add new pairings there.

export const gradients = {
  warm: ['#D2440B', '#D8145A', '#A80F5C'],
  plum: ['#3B0B3E', '#7A0F55'],
};

export const colors = {
  light: {
    canvas: '#FBF7F9',
    surface: '#FFFFFF',
    sunken: '#F6F1F4',
    ink: '#241A22',
    inkMuted: '#6A606B',
    inkSubtle: '#6F6570',
    line: '#F1ECEF',
    lineStrong: '#DCD3D9',
    fieldBorder: '#948590',
    accent: '#C4124F',
    accentPressed: '#A30E42',
    onAccent: '#FFFFFF',
    accentSoft: '#FFE3EE',
    onAccentSoft: '#A30E42',
    positive: '#0A7A4B',
    positiveSoft: '#DDF6E8',
    onPositiveSoft: '#08603B',
    negative: '#B3261E',
    negativeSoft: '#FDE9E7',
    onNegativeSoft: '#8E1D17',
    warning: '#8A5A00',
    warningSoft: '#FFF3CF',
    onWarningSoft: '#6E4800',
    gold: '#FFB020',
    onGold: '#3B0B3E',
    inverse: '#2E0A30',
    onInverse: '#FFFFFF',
    scrim: 'rgba(36,10,30,0.5)',
    shadow: '#5A0C33',
  },
  dark: {
    canvas: '#150D14',
    surface: '#2A1C29',
    sunken: '#342433',
    ink: '#F7EFF4',
    inkMuted: '#BDB0BA',
    inkSubtle: '#A99DA6',
    line: '#35262F',
    lineStrong: '#4C3945',
    fieldBorder: '#86717F',
    accent: '#FF7AA6',
    accentPressed: '#F0608F',
    onAccent: '#2A0614',
    accentSoft: '#4A1730',
    onAccentSoft: '#FFC2D6',
    positive: '#5CCFA6',
    positiveSoft: '#123A2C',
    onPositiveSoft: '#8FE3C4',
    negative: '#F58B80',
    negativeSoft: '#451B18',
    onNegativeSoft: '#F9BBB4',
    warning: '#EDBC63',
    warningSoft: '#3A2C0E',
    onWarningSoft: '#F3D08F',
    gold: '#FFB020',
    onGold: '#3B0B3E',
    inverse: '#F7EFF4',
    onInverse: '#2E0A30',
    scrim: 'rgba(0,0,0,0.65)',
    shadow: '#000000',
  },
};

// The top card on Home is the one coloured card: a deep two-tone gradient per kind,
// the same in light and dark mode, always with light text (see heroInk).
export const heroes = {
  personal: ['#7A1757', '#3B0B3E'],
  business: ['#0F6656', '#0A2F2B'],
  spending: ['#6A1736', '#2A0918'],
  foreign: ['#1D4580', '#0D1C38'],
};

// Colours used inside a hero card. Everything inside reads its colours from the theme,
// so swapping the palette turns amounts, bars and links light without touching them.
export const heroInk = {
  ...colors.dark,
  surface: 'rgba(255,255,255,0.08)',
  sunken: 'rgba(255,255,255,0.14)',
  ink: '#FFFFFF',
  inkMuted: 'rgba(255,240,246,0.80)',
  inkSubtle: 'rgba(255,240,246,0.72)',
  line: 'rgba(255,255,255,0.14)',
  lineStrong: 'rgba(255,255,255,0.24)',
  accent: '#FFD3E2',
  accentPressed: '#FFB8D0',
  onAccent: '#3B0B3E',
  accentSoft: 'rgba(255,255,255,0.14)',
  onAccentSoft: '#FFFFFF',
  positive: '#8FF0C8',
  negative: '#FFC9C2',
  warning: '#FFD98A',
};

// Soft tile colours for categories, used behind icons in lists.
export const categoryTones = {
  light: {
    Food: ['#FFEEDD', '#A84607'], Transport: ['#FFE3EE', '#A30E42'], Entertainment: ['#F3E6FF', '#6A1FB0'],
    Utilities: ['#FFF3CF', '#7A5600'], Health: ['#DDF6E8', '#08603B'], Shopping: ['#E3F1FB', '#0F5FA3'],
    Savings: ['#E7E6FB', '#3F3AA8'], Income: ['#DDF6E8', '#08603B'], Transfer: ['#F1ECEF', '#6A606B'], Other: ['#F1ECEF', '#6A606B'],
  },
  dark: {
    Food: ['#43260F', '#FFC69A'], Transport: ['#4A1730', '#FFC2D6'], Entertainment: ['#34204D', '#DABBFF'],
    Utilities: ['#3A2C0E', '#F3D08F'], Health: ['#123A2C', '#8FE3C4'], Shopping: ['#14304A', '#A9D6F8'],
    Savings: ['#25244F', '#C0BEFA'], Income: ['#123A2C', '#8FE3C4'], Transfer: ['#35262F', '#BDB0BA'], Other: ['#35262F', '#BDB0BA'],
  },
};

// [text, background, minimum ratio]. 4.5 is WCAG AA for normal text.
export const CONTRAST_PAIRS = [
  ['ink', 'canvas', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'sunken', 4.5],
  ['inkMuted', 'canvas', 4.5],
  ['inkMuted', 'surface', 4.5],
  ['inkMuted', 'sunken', 4.5],
  ['inkSubtle', 'canvas', 4.5],
  ['inkSubtle', 'surface', 4.5],
  ['accent', 'canvas', 4.5],
  ['accent', 'surface', 4.5],
  ['onAccent', 'accent', 4.5],
  ['onAccent', 'accentPressed', 4.5],
  ['onAccentSoft', 'accentSoft', 4.5],
  ['positive', 'canvas', 4.5],
  ['positive', 'surface', 4.5],
  ['onPositiveSoft', 'positiveSoft', 4.5],
  ['negative', 'canvas', 4.5],
  ['negative', 'surface', 4.5],
  ['onNegativeSoft', 'negativeSoft', 4.5],
  ['warning', 'canvas', 4.5],
  ['warning', 'surface', 4.5],
  ['onWarningSoft', 'warningSoft', 4.5],
  ['onInverse', 'inverse', 4.5],
  ['onGold', 'gold', 4.5],
  // Borders of text fields: 3:1 so people can see where to type.
  ['fieldBorder', 'surface', 3],
  ['fieldBorder', 'canvas', 3],
  ['fieldBorder', 'sunken', 3],
];

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 };

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

// Comfortable touch target. Anything tappable is at least this tall.
export const TOUCH_TARGET = 48;

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

// The only text styles in the app. Nothing is smaller than 12.
export const type = {
  display: { fontSize: 36, lineHeight: 44, letterSpacing: -0.8, family: 'semibold' },
  title: { fontSize: 24, lineHeight: 32, letterSpacing: -0.4, family: 'semibold' },
  heading: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2, family: 'semibold' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0.15, family: 'regular' },
  bodyStrong: { fontSize: 15, lineHeight: 22, letterSpacing: 0.15, family: 'medium' },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: 0.2, family: 'medium' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.25, family: 'regular' },
};

export const motion = { fast: 120, base: 200, slow: 280 };
