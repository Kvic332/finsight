// ── FinSight Design System — Electric Indigo Edition ─────────────────────────
//
//  Accent:  Indigo  #6366F1  /  #818CF8 (tint)
//  Danger:  Rose    #F87171
//  Warn:    Amber   #FBBF24
//  Positive:Emerald #34D399  (used only for credit/income amounts)
//  Base:    Near-black with blue-purple tint

export const DARK = {
  bg: '#150D14', bg1: '#1B1219', bg2: '#21161F',
  surface: '#221721', surface2: '#2D1F2B',
  line: '#35262F', line2: '#4C3945',
  ink: '#F7EFF4', ink2: '#D9CDD5', mute: '#BDB0BA', mute2: '#8F828C',
  lime: '#FF7AA6', limeDeep: '#FF7AA6',
  green: '#5CCFA6', amber: '#EDBC63', rose: '#F58B80', indigo: '#FF7AA6',
  text: '#F7EFF4', textMuted: '#BDB0BA',
};

export const LIGHT = {
  bg: '#FBF7F9', bg1: '#F6F1F4', bg2: '#F1ECEF',
  surface: '#FFFFFF', surface2: '#F6F1F4',
  line: '#F1ECEF', line2: '#DCD3D9',
  ink: '#241A22', ink2: '#463A44', mute: '#6A606B', mute2: '#8F828C',
  lime: '#C4124F', limeDeep: '#C4124F',
  green: '#0A7A4B', amber: '#8A5A00', rose: '#B3261E', indigo: '#C4124F',
  text: '#241A22', textMuted: '#6A606B',
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
