import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../services/finance.js';
import { explainFinScore } from '../services/finScoreExplain.js';

const tx = over => ({ id: Math.random().toString(36), type: 'debit', cat: 'Food', amount: 1000, date: '05/06/2026', desc: 'x', ...over });
const NOW = new Date(2026, 5, 20);

test('each part explains the score with the real figures behind it', () => {
  const stats = computeStats({ income: 100000 }, [tx({ amount: 10000 }), tx({ amount: 5000, cat: 'Transport' })], NOW);
  const { parts } = explainFinScore(stats, 'this month');
  const byLabel = Object.fromEntries(parts.map(p => [p.label, p]));
  assert.equal(byLabel.Spending.score, stats.scoreBreakdown.spendScore);
  assert.match(byLabel.Spending.reason, /₦15,000, 15% of your income, this month/);
  assert.match(byLabel.Savings.reason, /₦0 to savings this month, 0% of your income/);
  assert.match(byLabel.Savings.next, /Moving ₦20,000 more/);
  assert.match(byLabel.Tracking.reason, /2 transactions recorded \(6 of 30 points\), spread over 2 categories \(20 of 40\)/);
  assert.match(byLabel.Building.reason, /Savings goal set: no \(0 of 35\)/);
});

test('the points shown add up to the Tracking and Building scores', () => {
  const stats = computeStats({ income: 100000, goals: ['Car'] }, [
    tx({ amount: 10000 }), tx({ amount: 20000, cat: 'Savings' }),
  ], NOW);
  const s = stats.scoreInputs;
  assert.equal(Math.min(100, s.diversityPoints + s.balancePoints + s.trackingPoints), stats.scoreBreakdown.txScore);
  const { parts } = explainFinScore(stats);
  const building = parts.find(p => p.label === 'Building');
  const points = [...building.reason.matchAll(/\((\d+) of \d+\)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  assert.equal(Math.min(100, points), stats.scoreBreakdown.investScore);
});

test('the focus is the parts that would raise the score most', () => {
  // No savings at all, on a big weight, beats a small gap in tracking.
  const stats = computeStats({ income: 100000 }, [tx({ amount: 1000 })], NOW);
  const { focus } = explainFinScore(stats);
  assert.equal(focus[0].label, 'Savings');
});
