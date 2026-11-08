import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionName } from '../services/txName.js';

test('a generic alert becomes a plain payment or money-in label', () => {
  assert.equal(transactionName({ desc: 'PalmPay alert', type: 'debit', bank: 'PalmPay' }), 'PalmPay payment');
  assert.equal(transactionName({ desc: 'PalmPay alert', type: 'credit', bank: 'PalmPay' }), 'Money in via PalmPay');
  assert.equal(transactionName({ desc: 'Bank alert', type: 'debit' }), 'Payment');
  assert.equal(transactionName({ desc: '', type: 'credit' }), 'Money in');
});

test('bank transfer text becomes "Transfer to" a readable name', () => {
  assert.equal(
    transactionName({ desc: 'ONB TRF TO VICTOR KEN **9163 - PALMPAY LTD', type: 'debit' }),
    'Transfer to Victor Ken',
  );
  assert.equal(transactionName({ desc: 'NIP TRANSFER FROM ADA OKAFOR', type: 'credit' }), 'Transfer from Ada Okafor');
  assert.equal(transactionName({ desc: 'TRF FRM JOHN DOE 2290018273', type: 'credit' }), 'Transfer from John Doe');
});

test('shouting names are put in normal capitals, keeping known short forms', () => {
  assert.equal(transactionName({ desc: 'OBIJIOFOR KENECHUKWU VICTOR', type: 'credit' }), 'Obijiofor Kenechukwu Victor');
  assert.equal(transactionName({ desc: 'POS PURCHASE AT SHOPRITE LEKKI', type: 'debit' }), 'Shoprite Lekki');
  assert.equal(transactionName({ desc: 'MTN AIRTIME RECHARGE', type: 'debit' }), 'MTN Airtime Recharge');
});

test('descriptions people typed themselves are left alone', () => {
  assert.equal(transactionName({ desc: 'Suya with Tolu', type: 'debit' }), 'Suya with Tolu');
  assert.equal(transactionName({ desc: 'Rent', type: 'debit' }), 'Rent');
  assert.equal(transactionName({ desc: 'DSTV', type: 'debit' }), 'DSTV');
});
