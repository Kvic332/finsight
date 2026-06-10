// ── FinSight Design System — Electric Indigo Edition ─────────────────────────
//
//  Accent:  Indigo  #6366F1  /  #818CF8 (tint)
//  Danger:  Rose    #F87171
//  Warn:    Amber   #FBBF24
//  Positive:Emerald #34D399  (used only for credit/income amounts)
//  Base:    Near-black with blue-purple tint

export const DARK = {
  // Backgrounds
  bg:       '#0A0A12',
  bg1:      '#0D0D18',
  bg2:      '#101020',
  // Surfaces
  surface:  '#13131F',
  surface2: '#1C1C2E',
  // Borders
  line:     '#1E1E32',
  line2:    '#28283C',
  // Text
  ink:      '#F0F0FF',
  ink2:     '#C4C4E8',
  mute:     '#8080A8',
  mute2:    '#565678',
  // Brand accent — indigo
  lime:     '#818CF8',   // light indigo (tint / icon bg / borders)
  limeDeep: '#6366F1',   // main indigo (CTAs, active, highlights)
  // Semantic
  green:    '#34D399',   // credits / money-in
  amber:    '#FBBF24',
  rose:     '#F87171',
  indigo:   '#6366F1',
  // Aliases for legacy screens
  text:     '#F0F0FF',
  textMuted:'#8080A8',
};

export const LIGHT = {
  // Backgrounds
  bg:       '#F5F5FF',
  bg1:      '#EDEDFC',
  bg2:      '#E8E8F8',
  // Surfaces
  surface:  '#FFFFFF',
  surface2: '#F0F0FB',
  // Borders
  line:     '#E0E0F4',
  line2:    '#CCCCE8',
  // Text
  ink:      '#0A0A1E',
  ink2:     '#25254A',
  mute:     '#7070A0',
  mute2:    '#A0A0C0',
  // Brand accent — indigo
  lime:     '#818CF8',
  limeDeep: '#4F52D3',
  // Semantic
  green:    '#059669',
  amber:    '#D97706',
  rose:     '#DC2626',
  indigo:   '#4F52D3',
  // Aliases
  text:     '#0A0A1E',
  textMuted:'#7070A0',
};

export const CAT_COLORS = {
  Food:          '#F59E0B',
  Transport:     '#6366F1',
  Entertainment: '#EC4899',
  Utilities:     '#F87171',
  Health:        '#34D399',
  Savings:       '#818CF8',
  Income:        '#34D399',
  Transfer:      '#8080A8',
  Shopping:      '#FB923C',
  Other:         '#8080A8',
};

export const CAT_ICONS = {
  Food:'🍔', Transport:'🚗', Entertainment:'🎬', Utilities:'💡',
  Health:'💊', Savings:'🏦', Income:'💰', Shopping:'🛍️', Other:'📦',
};

export const INVESTMENTS = [
  { name:'Cowrywise Mutual Fund', ret:'14%',    risk:'Low',    riskColor:'#34D399', min:'₦1,000',  lock:'7 days'    },
  { name:'Piggyvest Fixed',       ret:'10–13%', risk:'Low',    riskColor:'#34D399', min:'₦1,000',  lock:'Lock-in'   },
  { name:'FGN Savings Bond',      ret:'12.5%',  risk:'Zero',   riskColor:'#FBBF24', min:'₦5,000',  lock:'90 days'   },
  { name:'Risevest Real Estate',  ret:'15–18%', risk:'Medium', riskColor:'#6366F1', min:'₦3,000',  lock:'12 months' },
];
