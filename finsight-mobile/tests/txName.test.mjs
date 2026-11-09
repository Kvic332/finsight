import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionName } from '../services/txName.js';

const alert = fields => ({ source: 'push', ...fields });

test('a generic alert becomes a plain payment or money-in label', () => {
  assert.equal(transactionName(alert({ desc: 'PalmPay alert', type: 'debit', bank: 'PalmPay' })), 'PalmPay payment');
  assert.equal(transactionName(alert({ desc: 'PalmPay alert', type: 'credit', bank: 'PalmPay' })), 'Money in via PalmPay');
  assert.equal(transactionName(alert({ desc: 'Bank alert', type: 'debit' })), 'Payment');
  assert.equal(transactionName(alert({ desc: '', type: 'credit' })), 'Money in');
});

test('bank transfer text becomes "Transfer to" a readable name', () => {
  assert.equal(
    transactionName(alert({ desc: 'ONB TRF TO VICTOR KEN **9163 - PALMPAY LTD', type: 'debit' })),
    'Transfer to Victor Ken',
  );
  assert.equal(transactionName({ source: 'sms', desc: 'NIP TRANSFER FROM ADA OKAFOR', type: 'credit' }), 'Transfer from Ada Okafor');
  assert.equal(transactionName({ source: 'import', desc: 'TRF FRM JOHN DOE 2290018273', type: 'credit' }), 'Transfer from John Doe');
});

test('shouting names are put in normal capitals, keeping known short forms', () => {
  assert.equal(transactionName(alert({ desc: 'OBIJIOFOR KENECHUKWU VICTOR', type: 'credit' })), 'Obijiofor Kenechukwu Victor');
  assert.equal(transactionName(alert({ desc: 'POS PURCHASE AT SHOPRITE LEKKI', type: 'debit' })), 'Shoprite Lekki');
  assert.equal(transactionName(alert({ desc: 'WEB PAYMENT @ JUMIA', type: 'debit' })), 'Jumia');
  assert.equal(transactionName(alert({ desc: 'MTN AIRTIME RECHARGE', type: 'debit' })), 'MTN Airtime Recharge');
});

test('bank text that only starts like a card payment keeps all its words', () => {
  assert.equal(transactionName(alert({ desc: 'POS charges', type: 'debit' })), 'POS charges');
  assert.equal(transactionName(alert({ desc: 'Web hosting renewal', type: 'debit' })), 'Web hosting renewal');
});

test('an alert word in real text is not mistaken for the empty-alert fallback', () => {
  assert.equal(transactionName(alert({ desc: 'Price alert', type: 'debit', bank: 'Kuda' })), 'Price alert');
});

test('descriptions people typed themselves are shown exactly as written', () => {
  for (const desc of ['Suya with Tolu', 'Rent', 'DSTV', 'Rent - January', 'Card games', 'Web hosting', 'Smoke alert', 'FT to savings', 'MAMA PUT']) {
    assert.equal(transactionName({ source: 'manual', desc, type: 'debit' }), desc);
    assert.equal(transactionName({ desc, type: 'debit' }), desc); // older entries have no source
  }
});
