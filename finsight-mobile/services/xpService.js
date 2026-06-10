import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Level definitions ─────────────────────────────────────────────────────────
export const LEVELS = [
  { level: 1, title: 'Rookie',      emoji: '🌱', minXP: 0,    maxXP: 149  },
  { level: 2, title: 'Hustler',     emoji: '💼', minXP: 150,  maxXP: 399  },
  { level: 3, title: 'Sharp Guy',   emoji: '🧠', minXP: 400,  maxXP: 799  },
  { level: 4, title: 'Oga',         emoji: '👑', minXP: 800,  maxXP: 1499 },
  { level: 5, title: 'Money Boss',  emoji: '💎', minXP: 1500, maxXP: Infinity },
];

// ── XP event definitions ──────────────────────────────────────────────────────
export const XP_EVENTS = {
  tx_log:        { xp: 10, label: 'Transaction logged',    maxPerDay: 3  },
  daily_open:    { xp: 5,  label: 'Daily app open',        maxPerDay: 1  },
  streak_7:      { xp: 25, label: '7-day streak bonus',    maxPerDay: 1  },
  streak_30:     { xp: 75, label: '30-day streak bonus',   maxPerDay: 1  },
  budget_safe:   { xp: 20, label: 'Under budget this month', maxPerMonth: true },
  finscore_70:   { xp: 15, label: 'FinScore 70+',          maxPerWeek: true  },
  finscore_80:   { xp: 25, label: 'FinScore 80+',          maxPerWeek: true  },
  goal_complete: { xp: 50, label: 'Savings goal reached',  maxPerDay: 1  },
  sms_import:    { xp: 15, label: 'SMS import completed',  maxPerDay: 2  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayKey()  { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function weekKey()   { const d = new Date(); const dow = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate()-dow); return `${mon.getFullYear()}-${mon.getMonth()}-${mon.getDate()}`; }
function monthKey()  { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}`; }

export function getLevelInfo(totalXP) {
  const current = [...LEVELS].reverse().find(l => totalXP >= l.minXP) || LEVELS[0];
  const next     = LEVELS.find(l => l.level === current.level + 1);
  const xpInLevel   = totalXP - current.minXP;
  const xpForLevel  = next ? (next.minXP - current.minXP) : 1;
  const pct         = Math.min(100, Math.round((xpInLevel / xpForLevel) * 100));
  return { current, next, xpInLevel, xpForLevel, pct, totalXP };
}

// ── Core award function ───────────────────────────────────────────────────────
// Returns { awarded: boolean, xpGained: number, newTotal: number, leveledUp: boolean, newLevel: object|null }
export async function awardXP(eventKey) {
  try {
    const def = XP_EVENTS[eventKey];
    if (!def) return { awarded: false, xpGained: 0 };

    // Load state
    const [rawXP, rawLog] = await Promise.all([
      AsyncStorage.getItem('finsight_xp'),
      AsyncStorage.getItem('finsight_xp_log'),
    ]);
    const totalXP = rawXP ? parseInt(rawXP) : 0;
    const log     = rawLog ? JSON.parse(rawLog) : {};

    // Dedup check
    const today = todayKey();
    const week  = weekKey();
    const month = monthKey();

    const logKey = def.maxPerMonth ? `${eventKey}_${month}`
                 : def.maxPerWeek  ? `${eventKey}_${week}`
                 : `${eventKey}_${today}`;

    const count = log[logKey] || 0;
    const max   = def.maxPerMonth ? 1
                : def.maxPerWeek  ? 1
                : (def.maxPerDay  || 999);

    if (count >= max) return { awarded: false, xpGained: 0, newTotal: totalXP };

    // Award XP
    const oldLevel = getLevelInfo(totalXP);
    const newTotal = totalXP + def.xp;
    const newLevel = getLevelInfo(newTotal);
    const leveledUp = newLevel.current.level > oldLevel.current.level;

    // Save
    log[logKey] = count + 1;
    await Promise.all([
      AsyncStorage.setItem('finsight_xp', String(newTotal)),
      AsyncStorage.setItem('finsight_xp_log', JSON.stringify(log)),
    ]);

    return {
      awarded: true,
      xpGained: def.xp,
      label: def.label,
      newTotal,
      leveledUp,
      newLevel: leveledUp ? newLevel.current : null,
    };
  } catch {
    return { awarded: false, xpGained: 0 };
  }
}

export async function getXPState() {
  try {
    const raw = await AsyncStorage.getItem('finsight_xp');
    const totalXP = raw ? parseInt(raw) : 0;
    return getLevelInfo(totalXP);
  } catch {
    return getLevelInfo(0);
  }
}
