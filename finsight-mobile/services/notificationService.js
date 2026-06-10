import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Permission ────────────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatAmount(amount) {
  if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}K`;
  return `₦${amount.toLocaleString()}`;
}

function computeStats(transactions, income = 0) {
  const debits = transactions.filter(t => t.type === 'debit');
  const credits = transactions.filter(t => t.type === 'credit');
  const totalSpend = debits.reduce((s, t) => s + t.amount, 0);
  const totalSaved = credits.filter(t => t.cat === 'Savings').reduce((s, t) => s + t.amount, 0);
  const totalIncome = credits.filter(t => t.cat === 'Income').reduce((s, t) => s + t.amount, 0);
  const effectiveIncome = totalIncome > 0 ? totalIncome : income;
  const balance = effectiveIncome - totalSpend + totalSaved;
  const dailySpend = totalSpend / 30;
  const daysLeft = dailySpend > 0 ? Math.min(365, Math.round(balance / dailySpend)) : 365;
  const categoryTotals = {};
  debits.forEach(t => { categoryTotals[t.cat] = (categoryTotals[t.cat] || 0) + t.amount; });
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const spendScore = Math.min(100, effectiveIncome > 0 ? Math.round((1 - totalSpend / effectiveIncome) * 100) : 50);
  const saveScore = Math.min(100, effectiveIncome > 0 ? Math.round((totalSaved / effectiveIncome) * 500) : 0);
  const txScore = transactions.length > 10 ? 72 : Math.round((transactions.length / 10) * 72);
  const finScore = Math.max(0, Math.round((spendScore + saveScore + txScore + 30) / 4));
  return { totalSpend, totalSaved, effectiveIncome, daysLeft, finScore, topCategory, categoryTotals };
}

// ── Daily Reminder (user-set time) ───────────────────────────────────────────
export async function scheduleDailyReminder(hour = 21, minute = 0, userName = 'there') {
  try {
    await cancelDigest('reminder');
    const granted = await requestNotificationPermission();
    if (!granted) return false;
    const messages = [
      `Hey ${userName} 👋 Did you log today's expenses? Your Broke Clock is waiting.`,
      `${userName}, ARIA here. What did you spend today? Keep your streak alive 🔥`,
      `Quick check-in, ${userName}. Log today's transactions to keep your FinScore climbing 📈`,
      `Don't break your streak, ${userName}! Log one transaction and you're done ✅`,
      `${userName}, your money diary needs updating. 30 seconds is all it takes 💰`,
    ];
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💡 FinSight Daily Check-in',
        body: messages[Math.floor(Math.random() * messages.length)],
        sound: true,
        data: { type: 'daily_reminder' },
      },
      trigger: {
        hour, minute, repeats: true,
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
      },
    });
    await AsyncStorage.setItem('finsight_reminder_id', id);
    await AsyncStorage.setItem('finsight_reminder_time', JSON.stringify({ hour, minute }));
    return true;
  } catch (e) { return false; }
}

export async function cancelDailyReminder() {
  await cancelDigest('reminder');
}

// ── Send daily digest NOW (called at 9pm via checkAndSendDigests) ─────────────
export async function sendDailyDigestNow(userName = 'there') {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    const [raw, userRaw, streakRaw] = await Promise.all([
      AsyncStorage.getItem('finsight_transactions'),
      AsyncStorage.getItem('finsight_user'),
      AsyncStorage.getItem('finsight_streak'),
    ]);

    const allTxs = raw ? JSON.parse(raw) : [];
    const user = userRaw ? JSON.parse(userRaw) : {};
    const streak = streakRaw ? JSON.parse(streakRaw) : { count: 0 };

    const today = new Date().toLocaleDateString('en-NG');
    const todayTxs = allTxs.filter(t => t.date === today);
    const todaySpend = todayTxs.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const todayCredit = todayTxs.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);

    const todayCatMap = {};
    todayTxs.filter(t => t.type === 'debit').forEach(t => {
      todayCatMap[t.cat] = (todayCatMap[t.cat] || 0) + t.amount;
    });
    const todayTopCats = Object.entries(todayCatMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const stats = computeStats(allTxs, user.income || 0);
    const weekday = new Date().toLocaleDateString('en-NG', { weekday: 'long' });
    const streakBadge = streak.count >= 7 ? '🔥' : streak.count >= 3 ? '⚡' : '🌱';

    let body = '';
    if (todaySpend === 0 && todayCredit === 0) {
      body = `Nothing logged today. Tracking is the first step to financial freedom 📊\nBroke Clock: ${stats.daysLeft >= 365 ? '365+' : stats.daysLeft}d · Streak: ${streak.count}d ${streakBadge}`;
    } else {
      const catLine = todayTopCats.map(([cat, amt]) => `${cat} ${formatAmount(amt)}`).join(' · ');
      body = `Spent: ${formatAmount(todaySpend)}${todayCredit > 0 ? ` · Received: ${formatAmount(todayCredit)}` : ''}\n↳ ${catLine}\n\nBroke Clock: ${stats.daysLeft >= 365 ? '365+' : stats.daysLeft}d · Streak: ${streak.count}d ${streakBadge}`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💡 ${weekday} Digest`,
        body,
        sound: true,
        data: { type: 'daily_digest' },
      },
      trigger: { seconds: 2 },
    });

    await AsyncStorage.setItem('finsight_last_daily_digest', new Date().toDateString());
    return true;
  } catch (e) { return false; }
}

// ── Send weekly digest NOW (called on Sundays) ────────────────────────────────
export async function sendWeeklyDigestNow(userName = 'there') {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    const [raw, userRaw, streakRaw, prevRaw] = await Promise.all([
      AsyncStorage.getItem('finsight_transactions'),
      AsyncStorage.getItem('finsight_user'),
      AsyncStorage.getItem('finsight_streak'),
      AsyncStorage.getItem('finsight_prev_week_stats'),
    ]);

    const allTxs = raw ? JSON.parse(raw) : [];
    const user = userRaw ? JSON.parse(userRaw) : {};
    const streak = streakRaw ? JSON.parse(streakRaw) : { count: 0 };
    const prevStats = prevRaw ? JSON.parse(prevRaw) : null;

    // Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekTxs = allTxs.filter(t => new Date(t.date) >= sevenDaysAgo);

    const weekSpend = weekTxs.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const weekSaved = weekTxs.filter(t => t.cat === 'Savings').reduce((s, t) => s + t.amount, 0);

    const weekCats = {};
    weekTxs.filter(t => t.type === 'debit').forEach(t => {
      weekCats[t.cat] = (weekCats[t.cat] || 0) + t.amount;
    });
    const topCat = Object.entries(weekCats).sort((a, b) => b[1] - a[1])[0];

    const stats = computeStats(allTxs, user.income || 0);
    const brokeChange = prevStats ? (stats.daysLeft - prevStats.daysLeft) : 0;
    const brokeArrow = brokeChange > 0 ? `↑ +${brokeChange}d` : brokeChange < 0 ? `↓ ${brokeChange}d` : '→ same';

    // Save for next week
    await AsyncStorage.setItem('finsight_prev_week_stats', JSON.stringify({ daysLeft: stats.daysLeft, finScore: stats.finScore }));

    // ARIA commentary
    let ariaLine = '';
    if (weekSpend === 0) {
      ariaLine = 'Start logging transactions to unlock weekly insights!';
    } else if (topCat && topCat[1] > (user.income || 0) * 0.3) {
      ariaLine = `Watch out — ${topCat[0]} took ${formatAmount(topCat[1])} this week (over 30% of income).`;
    } else if (weekSaved > 0) {
      ariaLine = `Saved ${formatAmount(weekSaved)} this week. Keep that momentum! 💪`;
    } else {
      ariaLine = `Try saving at least 20% of income next week.`;
    }

    const streakBadge = streak.count >= 7 ? '🔥' : streak.count >= 3 ? '⚡' : '🌱';
    const dateStr = new Date().toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });

    const body =
      `Spent:        ${formatAmount(weekSpend)}\n` +
      `Saved:        ${formatAmount(weekSaved)}\n` +
      `Top category: ${topCat ? `${topCat[0]} ${formatAmount(topCat[1])}` : 'None'}\n` +
      `Broke Clock:  ${stats.daysLeft >= 365 ? '365+' : stats.daysLeft}d (${brokeArrow})\n` +
      `Streak:       ${streak.count}d ${streakBadge}\n\n` +
      `ARIA: ${ariaLine}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📊 Week in Review — ${dateStr}`,
        body,
        sound: true,
        data: { type: 'weekly_digest' },
      },
      trigger: { seconds: 2 },
    });

    await AsyncStorage.setItem('finsight_last_weekly_digest', new Date().toDateString());
    return true;
  } catch (e) { return false; }
}

// ── Send monthly report NOW (called on 1st of month) ─────────────────────────
export async function sendMonthlyReportNow(userName = 'there') {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    const [raw, userRaw, streakRaw] = await Promise.all([
      AsyncStorage.getItem('finsight_transactions'),
      AsyncStorage.getItem('finsight_user'),
      AsyncStorage.getItem('finsight_streak'),
    ]);

    const allTxs = raw ? JSON.parse(raw) : [];
    const user = userRaw ? JSON.parse(userRaw) : {};
    const streak = streakRaw ? JSON.parse(streakRaw) : { count: 0, longest: 0 };

    const now = new Date();
    const monthTxs = allTxs.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const monthSpend = monthTxs.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const monthSaved = monthTxs.filter(t => t.cat === 'Savings').reduce((s, t) => s + t.amount, 0);
    const monthIncome = monthTxs.filter(t => t.cat === 'Income').reduce((s, t) => s + t.amount, 0);
    const effectiveIncome = monthIncome > 0 ? monthIncome : (user.income || 0);
    const savingsRate = effectiveIncome > 0 ? Math.round((monthSaved / effectiveIncome) * 100) : 0;

    const stats = computeStats(allTxs, user.income || 0);
    const grade = stats.finScore >= 90 ? 'A+' : stats.finScore >= 80 ? 'A' : stats.finScore >= 70 ? 'B+' : stats.finScore >= 60 ? 'B' : stats.finScore >= 50 ? 'C' : 'D';
    const gradeEmoji = stats.finScore >= 70 ? '🌟' : stats.finScore >= 50 ? '📈' : '⚠️';
    const monthName = now.toLocaleDateString('en-NG', { month: 'long' });

    const body =
      `${gradeEmoji} Grade: ${grade} · FinScore ${stats.finScore}/100\n\n` +
      `Income:  ${formatAmount(effectiveIncome)}\n` +
      `Spent:   ${formatAmount(monthSpend)} (${effectiveIncome > 0 ? Math.round((monthSpend/effectiveIncome)*100) : 0}%)\n` +
      `Saved:   ${formatAmount(monthSaved)} (${savingsRate}%)\n` +
      `Broke Clock: ${stats.daysLeft >= 365 ? '365+' : stats.daysLeft}d\n` +
      `Best streak: ${streak.longest}d\n\n` +
      `${savingsRate >= 20 ? `✅ Hit the 20% savings target!` : `⚠️ Aim for ${formatAmount(Math.round(effectiveIncome * 0.2))} savings next month.`}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📋 ${monthName} Report — Grade ${grade}`,
        body,
        sound: true,
        data: { type: 'monthly_report' },
      },
      trigger: { seconds: 2 },
    });

    await AsyncStorage.setItem('finsight_last_monthly_report', new Date().toDateString());
    return true;
  } catch (e) { return false; }
}

// ── Master check — call on every app open ────────────────────────────────────
export async function checkAndSendDigests(userName = 'there') {
  try {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const dayOfMonth = now.getDate();
    const today = now.toDateString();

    // Daily digest at 9pm
    if (hour >= 21) {
      const last = await AsyncStorage.getItem('finsight_last_daily_digest');
      if (last !== today) await sendDailyDigestNow(userName);
    }

    // Weekly digest on Sunday at 8am
    if (dayOfWeek === 0 && hour >= 8) {
      const last = await AsyncStorage.getItem('finsight_last_weekly_digest');
      if (last !== today) await sendWeeklyDigestNow(userName);
    }

    // Monthly report on 1st at 8am
    if (dayOfMonth === 1 && hour >= 8) {
      const last = await AsyncStorage.getItem('finsight_last_monthly_report');
      if (last !== today) await sendMonthlyReportNow(userName);
    }
  } catch (e) {}
}

// ── Cancel helpers ────────────────────────────────────────────────────────────
export async function cancelDigest(type) {
  try {
    const keyMap = {
      reminder: 'finsight_reminder_id',
      daily: 'finsight_daily_digest_id',
      weekly: 'finsight_weekly_digest_id',
      monthly: 'finsight_monthly_report_id',
    };
    const key = keyMap[type];
    if (!key) return;
    const id = await AsyncStorage.getItem(key);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(key);
  } catch (e) {}
}

// ── Streak ────────────────────────────────────────────────────────────────────
export async function updateStreak() {
  try {
    const today = new Date().toDateString();
    const raw = await AsyncStorage.getItem('finsight_streak');
    const streak = raw ? JSON.parse(raw) : { count: 0, lastDate: null, longest: 0 };
    if (streak.lastDate === today) return streak;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    streak.count = streak.lastDate === yesterday.toDateString() ? streak.count + 1 : 1;
    streak.lastDate = today;
    streak.longest = Math.max(streak.longest, streak.count);
    await AsyncStorage.setItem('finsight_streak', JSON.stringify(streak));
    return streak;
  } catch (e) { return { count: 0, lastDate: null, longest: 0 }; }
}

export async function getStreak() {
  try {
    const raw = await AsyncStorage.getItem('finsight_streak');
    if (!raw) return { count: 0, lastDate: null, longest: 0 };
    const streak = JSON.parse(raw);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isAlive = streak.lastDate === new Date().toDateString() || streak.lastDate === yesterday.toDateString();
    if (!isAlive && streak.count > 0) {
      streak.count = 0;
      await AsyncStorage.setItem('finsight_streak', JSON.stringify(streak));
    }
    return streak;
  } catch (e) { return { count: 0, lastDate: null, longest: 0 }; }
}

export function getStreakBadge(count) {
  if (count >= 365) return { emoji: '👑', label: 'Legendary', color: '#FFD700' };
  if (count >= 180) return { emoji: '💎', label: 'Diamond', color: '#7B7BFF' };
  if (count >= 90)  return { emoji: '🏆', label: 'Gold', color: '#E8970A' };
  if (count >= 30)  return { emoji: '🥈', label: 'Silver', color: '#C0C0C0' };
  if (count >= 14)  return { emoji: '🥉', label: 'Bronze', color: '#CD7F32' };
  if (count >= 7)   return { emoji: '🔥', label: 'On Fire', color: '#E54545' };
  if (count >= 3)   return { emoji: '⚡', label: 'Building', color: '#E8970A' };
  return { emoji: '🌱', label: 'Starting', color: '#84A816' };
}

export async function checkAchievements(streak, transactions, finScore) {
  try {
    const raw = await AsyncStorage.getItem('finsight_achievements');
    const earned = raw ? JSON.parse(raw) : [];
    const allAchievements = [
      { id: 'first_log', title: 'First Step', desc: 'Logged your first transaction', emoji: '👶', check: () => transactions.length >= 1 },
      { id: 'ten_logs', title: 'Getting Started', desc: 'Logged 10 transactions', emoji: '📝', check: () => transactions.length >= 10 },
      { id: 'fifty_logs', title: 'Tracking Pro', desc: 'Logged 50 transactions', emoji: '📊', check: () => transactions.length >= 50 },
      { id: 'streak_3', title: 'Habit Forming', desc: '3-day logging streak', emoji: '⚡', check: () => streak.count >= 3 },
      { id: 'streak_7', title: 'One Week Strong', desc: '7-day logging streak', emoji: '🔥', check: () => streak.count >= 7 },
      { id: 'streak_30', title: 'Monthly Master', desc: '30-day logging streak', emoji: '🥉', check: () => streak.count >= 30 },
      { id: 'streak_90', title: 'Quarterly Champion', desc: '90-day logging streak', emoji: '🏆', check: () => streak.count >= 90 },
      { id: 'finscore_50', title: 'Average Achieved', desc: 'FinScore reached 50', emoji: '📈', check: () => finScore >= 50 },
      { id: 'finscore_70', title: 'Good Shape', desc: 'FinScore reached 70', emoji: '💪', check: () => finScore >= 70 },
      { id: 'finscore_90', title: 'Financial Elite', desc: 'FinScore reached 90', emoji: '🌟', check: () => finScore >= 90 },
      { id: 'sms_import', title: 'SMS Pro', desc: 'Imported transactions via SMS', emoji: '📱', check: () => transactions.some(t => t.source === 'sms') },
    ];
    const newlyEarned = [];
    for (const ach of allAchievements) {
      if (!earned.includes(ach.id) && ach.check()) {
        earned.push(ach.id);
        newlyEarned.push(ach);
      }
    }
    if (newlyEarned.length > 0) {
      await AsyncStorage.setItem('finsight_achievements', JSON.stringify(earned));
      for (const ach of newlyEarned) {
        await Notifications.scheduleNotificationAsync({
          content: { title: `${ach.emoji} Achievement Unlocked!`, body: `${ach.title} — ${ach.desc}`, sound: true },
          trigger: { seconds: 2 },
        });
      }
    }
    return { earned, newlyEarned, allAchievements };
  } catch (e) { return { earned: [], newlyEarned: [], allAchievements: [] }; }
}
