import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCards, startingCard } from '../services/homeCards.js';

test('a salary earner starts on Left until payday', () => {
  assert.deepEqual(homeCards({ usage: 'salary' }), ['personal', 'spending']);
  // Older profiles have no usage set and are treated as salary.
  assert.deepEqual(homeCards({}), ['personal', 'spending']);
});

test('someone with both starts on payday, then the business', () => {
  assert.deepEqual(homeCards({ usage: 'both' }, { walletCount: 1 }), ['personal', 'business', 'spending', 'foreign']);
});

test('a business owner starts on profit, and sees payday only once they pay themselves', () => {
  assert.deepEqual(homeCards({ usage: 'business' }), ['business', 'spending']);
  assert.deepEqual(homeCards({ usage: 'business' }, { hasIncome: true }), ['business', 'personal', 'spending']);
});

test('a tracker starts on spending and never sees payday', () => {
  assert.deepEqual(homeCards({ usage: 'tracking' }, { hasIncome: true }), ['spending']);
});

test('business money or foreign accounts add their card for anyone', () => {
  assert.deepEqual(homeCards({ usage: 'salary' }, { hasBusinessMoney: true, walletCount: 2 }), ['personal', 'spending', 'business', 'foreign']);
});

test('the last card looked at is reopened if it is still shown', () => {
  assert.equal(startingCard(['personal', 'spending'], 'spending'), 'spending');
  assert.equal(startingCard(['personal', 'spending'], 'business'), 'personal');
  assert.equal(startingCard(['personal'], null), 'personal');
});
