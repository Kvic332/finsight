import test from 'node:test';
import assert from 'node:assert/strict';
import { latestBalances } from '../services/balances.js';
import { parseBankAlert, reportedBalance } from '../services/bankAlertParser.js';

const NOW = Date.UTC(2026, 10, 6, 12);
const HOUR = 3600000;

test('the balance an alert reports is read', () => {
  assert.equal(reportedBalance('Acct:12****89 DR:NGN5,000.00 Avail Bal:NGN 120,450.75'), 120450.75);
  assert.equal(reportedBalance('Your balance is ₦3,200'), 3200);
  assert.equal(reportedBalance('Bal: -1,500.00'), -1500);
  assert.equal(reportedBalance('You sent ₦5,000 to Uber'), null);
});

test('a captured alert keeps the balance, but not as its amount', () => {
  const tx = parseBankAlert({ id: '1', pkg: 'com.gtbank.gtworldv1', channel: 'app', title: 'GTBank', text: 'Debit of NGN5,000.00 to Uber. Avail Bal: NGN120,450.75', postedAt: NOW });
  assert.equal(tx.amount, 5000);
  assert.equal(tx.balance, 120450.75);
});

test('the latest balance per bank is shown, newest first, and old ones are left out', () => {
  const list = [
    { bank: 'GTBank', balance: 100, capturedAt: NOW - 5 * HOUR },
    { bank: 'GTBank', balance: 90, capturedAt: NOW - HOUR },
    { bank: 'OPay', balance: 500, capturedAt: NOW - 2 * HOUR },
    { bank: 'Kuda Bank', balance: 700, capturedAt: NOW - 20 * 24 * HOUR },
    { bank: 'Access Bank', capturedAt: NOW },
  ];
  assert.deepEqual(latestBalances(list, NOW).map(b => [b.bank, b.balance]), [['GTBank', 90], ['OPay', 500]]);
});
