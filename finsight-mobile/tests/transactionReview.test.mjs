import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReview, suspectReason, suspectTransactions } from '../services/transactionReview.js';
import { parseSMS } from '../services/smsParser.js';

test('pasted interest earned is money in', () => {
  const [found] = parseSMS("OPay Acct 123***890 OWealth Interest Earned. Your balance 'OWealth' earned interest of ₦26.40 today.");
  assert.equal(found.type, 'credit');
});

test('pasted balance warnings, failed payments and adverts are skipped', () => {
  assert.deepEqual(parseSMS('Your balance is less than NGN101. Top up now. Acct 123***890'), []);
  assert.deepEqual(parseSMS('GTBank: Debit of NGN5,000 failed due to insufficient funds. Acct 123***890'), []);
  assert.deepEqual(parseSMS('Access: Enjoy 20% off with code SAVE20 on NGN10,000 transfers. Acct 123***890'), []);
  // A normal alert still comes through.
  assert.equal(parseSMS('Acct:123***890 DR:N5,000.00 Desc: POS Shoprite Bal: N20,000').length, 1);
});

const tx = over => ({ id: '1', desc: 'Transfer', amount: 1000, type: 'debit', cat: 'Other', source: 'sms', ...over });

// Shaped like what was found on a real phone, with made-up details.
test('adverts are spotted', () => {
  assert.match(suspectReason(tx({ desc: '40% OFF' })), /advert/);
  assert.match(suspectReason(tx({ desc: 'get your code' })), /advert/);
  assert.match(suspectReason(tx({ desc: "₦240 Off Your Next Deposit! You've unlocked a 4-in-1" })), /advert/);
});

test('failed payments are spotted', () => {
  assert.match(suspectReason(tx({ desc: 'insufficient balance in your debit account Your Sp' })), /failed/);
  assert.match(suspectReason(tx({ desc: 'Airtime', raw: 'Your transaction failed. NGN500' })), /failed/);
});

test('balance warnings are spotted', () => {
  assert.match(suspectReason(tx({ desc: 'less than ₦101' })), /balance warning/);
  assert.match(suspectReason(tx({ desc: 'Alert', raw: 'Your balance is low. Top up now.' })), /balance warning/);
});

test('shop and betting adverts read as spending are spotted', () => {
  // Shaped like the leftovers found on a real phone.
  for (const desc of [
    "miss out! It's the 14th Jumia Anniversary Season o", 'Your cart just got cheaper! Was ₦29,810, now ₦17,1',
    'Price Reduction Was ₦29,810, Now ₦5,096', '❗ DO NOT REFRESH Pay ₦3,397 instead of',
    'With R-SHOPJA16 code get Extra ₦3,000 Off Home & O', "It's evening & the deals are still hot!🔥Wrap up y",
    '💰Sign up reward! Bangbet rewards new users with u', "📣Victor don't miss Hisense Brand Day. Not with an",
    'you! Our way to express gratitude! Please claim it', 'Victor place your 1st order, pay instant ₦2,500 Le',
    'very cheap price? Dial *77728*4*1# to stream and d', 'Easemoni [EaseMoni] Your loan has been approved. Y',
    'Victor join today\'s sale groove on 20000 MAh Utra ', 'Get the Smartphone you love, Enjoy an Extra ₦3,000',
    '🔥Correct Steal on Computers & Accessories! Victor',
  ]) {
    assert.match(suspectReason(tx({ desc })) || '', /advert/, desc);
  }
});

test('a description that is only a number is flagged as misread', () => {
  assert.match(suspectReason(tx({ desc: '480', amount: 480000 })), /Couldn't read/);
  assert.match(suspectReason(tx({ desc: '₦269', amount: 269999 })), /Couldn't read/);
});

test('real transactions are left alone', () => {
  for (const desc of [
    'your FairSave account', 'Uber', 'ONB TRF TO VICTOR K', 'Spend & Save! Auto-deposited from your CashBox',
    'Transfer to Bolt Food', 'Shoprite Ikeja', 'N1600 Victor', 'MTN', 'PalmPay Card Payment Your payment of ₦500.00 via P',
    '14:37 on 06/06  from WEB on Google Play Card 9118', 'account recharge of N30000', '312 Your N1000_Oneoff Plan, valid: 02/07/2026 19:3',
    "OWealth Interest Earned Your Available Balance 'OW", 'POS JUMIA LAGOS', 'skincare',
  ]) {
    assert.equal(suspectReason(tx({ desc })), null, desc);
  }
});

test('anything typed by hand, or already checked, is never flagged', () => {
  assert.equal(suspectReason(tx({ desc: '40% OFF', source: 'manual' })), null);
  assert.equal(suspectReason(tx({ desc: '40% OFF', reviewedOk: true })), null);
});

test('money in saved as spending is offered a fix, not removal', () => {
  const item = suspectTransactions([tx({ id: 'i', desc: "OWealth Interest Earned Your Available Balance 'OW", amount: 26, cat: 'Savings' })])[0];
  assert.equal(item.action, 'fix');
  assert.deepEqual(item.changes, { type: 'credit', cat: 'Income' });
  assert.equal(suspectTransactions([tx({ desc: 'Refund for failed order', amount: 5000 })])[0].action, 'fix');
});

test('a credit tagged savings that never mentions savings is offered Income', () => {
  const item = suspectTransactions([tx({ id: 's', type: 'credit', cat: 'Savings', desc: 'IK SPORTS WEAR SHOP - IYK SPORTS WEAR SHOP', amount: 250000 })])[0];
  assert.equal(item.action, 'fix');
  assert.deepEqual(item.changes, { cat: 'Income' });
});

test('real savings and real spending are not offered fixes', () => {
  const real = [
    tx({ type: 'credit', cat: 'Savings', desc: 'your Spend & Save! Auto-deposited from your CashBox' }),
    tx({ type: 'debit', cat: 'Savings', desc: 'your FairSave account' }),
    tx({ type: 'debit', cat: 'Transport', desc: 'Uber' }),
    tx({ type: 'credit', cat: 'Income', desc: 'Salary credited to your account' }),
  ];
  assert.deepEqual(suspectTransactions(real), []);
});

test('applying a fix changes the transaction and marks it checked', () => {
  const list = [tx({ id: 'i', desc: 'Interest Earned', cat: 'Savings' }), tx({ id: 'u', desc: 'Uber' })];
  const after = applyReview(list, [], [], { i: { type: 'credit', cat: 'Income' } });
  assert.deepEqual([after[0].type, after[0].cat, after[0].reviewedOk], ['credit', 'Income', true]);
  assert.equal(suspectTransactions(after).length, 0);
});

test('reviewing removes the chosen and marks the rest as checked', () => {
  const list = [tx({ id: 'a', desc: '40% OFF' }), tx({ id: 'b', desc: 'get your code' }), tx({ id: 'c', desc: 'Uber' })];
  assert.equal(suspectTransactions(list).length, 2);
  const after = applyReview(list, ['a'], ['b']);
  assert.deepEqual(after.map(t => t.id), ['b', 'c']);
  assert.equal(after[0].reviewedOk, true);
  assert.equal(suspectTransactions(after).length, 0);
});
