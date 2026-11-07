// ── Why the FinScore is what it is ────────────────────────────────────────────
// Turns computeStats' score and its inputs into plain reasons and one next step
// for each part. Pure functions only, so they can be tested against the score.
import { formatMoney } from './format.js';

const TARGET_SAVE_RATE = 20;

// stats is computeStats(...) or computePeriodStats(...); when is periodLabel(cycle).
export function explainFinScore(stats, when = 'this month') {
  const { income, totalSpend, totalSaved, scoreBreakdown: score, scoreInputs: s } = stats;
  const spentPct = Math.round(s.spendRatio * 100);
  const toTarget = Math.max(0, Math.round(income * TARGET_SAVE_RATE / 100) - totalSaved);
  // Before the salary is recorded, the income from Settings stands in for it.
  const expected = !stats.salarySeen && !stats.incomeVaries && income > 0 && stats.scoreInputs.declaredIncome > 0;
  const ofIncome = expected ? 'of your expected pay, as no salary has been recorded yet' : 'of your income';

  // Without an income, spending is compared with the period before, and saving
  // with everything that went out.
  const byIncome = s.scoreMode !== 'spending';
  const change = s.spendChange === null || s.spendChange === undefined ? null : Math.round((s.spendChange - 1) * 100);
  const paceWords = change === null ? null
    : change === 0 ? 'the same pace as' : change > 0 ? `${change}% faster than` : `${-change}% slower than`;
  // Saving share of everything going out: to reach 20%, saved / (spent + saved) = 0.2.
  const toShareTarget = Math.max(0, Math.round(totalSpend * TARGET_SAVE_RATE / (100 - TARGET_SAVE_RATE)) - totalSaved);

  const spending = byIncome ? {
    label: 'Spending',
    score: score.spendScore,
    weight: 35,
    reason: `You've spent ${formatMoney(totalSpend)}, ${spentPct}% ${ofIncome}, ${when}.`,
    next: score.spendScore >= 90
      ? 'Keep spending well below your income.'
      : 'Spending less of your income raises this. Spending all of it scores about 17.',
  } : {
    label: 'Spending',
    score: score.spendScore,
    weight: 35,
    reason: paceWords
      ? `You've spent ${formatMoney(totalSpend)} ${when}, ${paceWords} the period before (${formatMoney(s.previousSpend)}).`
      : `You've spent ${formatMoney(totalSpend)} ${when}. There's no earlier period to compare with yet, so this part starts at 70.`,
    next: score.spendScore >= 90
      ? 'Keep spending at or below last period\'s pace.'
      : 'Spending at least 10% less than the period before scores full marks.',
  };

  const savings = byIncome ? {
    label: 'Savings',
    score: score.saveScore,
    weight: 35,
    reason: `You've moved ${formatMoney(totalSaved)} to savings ${when}, ${s.savingsRate}% ${ofIncome}.`,
    next: score.saveScore >= 100
      ? `You're saving at least ${TARGET_SAVE_RATE}%, which scores full marks.`
      : `Saving ${TARGET_SAVE_RATE}% scores full marks. Moving ${formatMoney(toTarget)} more to savings would get you there.`,
  } : {
    label: 'Savings',
    score: score.saveScore,
    weight: 35,
    reason: `You've moved ${formatMoney(totalSaved)} to savings ${when}, ${s.saveShare}% of all the money that went out.`,
    next: score.saveScore >= 100
      ? `At least ${TARGET_SAVE_RATE}% of your money goes to savings, which scores full marks.`
      : `Putting ${TARGET_SAVE_RATE}% of your money into savings scores full marks. Moving ${formatMoney(toShareTarget)} more would get you there.`,
  };

  const tracking = {
    label: 'Tracking',
    score: score.txScore,
    weight: 15,
    reason: `${s.trackedCount} transactions recorded (${s.trackingPoints} of 30 points), spread over ${s.categoryCount} ${s.categoryCount === 1 ? 'category' : 'categories'} (${s.diversityPoints} of 40), and your biggest category is ${Math.round(s.topCategoryShare * 100)}% of spending (${s.balancePoints} of 30).`,
    next: s.balancePoints < 30 && s.topCategoryShare >= 0.5
      ? 'Your spending is concentrated in one category. Check its transactions are in the right categories.'
      : s.trackingPoints < 30 ? 'Record every transaction, or turn on bank alert capture.' : 'Keep recording every transaction.',
  };

  const goalPoints = s.hasGoals ? 35 : 0;
  const savingPoints = s.hasSavingsTx ? 45 : 0;
  const rate = byIncome ? s.savingsRate : s.saveShare;
  const ratePoints = rate >= 10 ? 20 : rate >= 5 ? 10 : 0;
  const building = {
    label: 'Building',
    score: score.investScore,
    weight: 15,
    reason: `Savings goal set: ${s.hasGoals ? 'yes' : 'no'} (${goalPoints} of 35). Money put into savings: ${s.hasSavingsTx ? 'yes' : 'no'} (${savingPoints} of 45). Saving at least 10% ${when}: ${ratePoints === 20 ? 'yes' : 'no'} (${ratePoints} of 20).`,
    next: !s.hasGoals ? 'Set a savings goal.'
      : !s.hasSavingsTx ? 'Make your first contribution to a goal.'
      : ratePoints < 20 ? `Save 10% of ${byIncome ? "your income" : "what goes out"} ${when} to complete this part.` : 'All parts of Building are done.',
  };

  const parts = [spending, savings, tracking, building];
  // The two parts that would raise the score most, weighted as the score is.
  const focus = [...parts].sort((a, b) => (100 - b.score) * b.weight - (100 - a.score) * a.weight).slice(0, 2);
  return { parts, focus };
}
