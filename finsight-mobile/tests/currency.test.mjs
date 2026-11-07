import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertFromWallet, foreignFields, foreignNote, formatForeign, nairaIncome, nairaRatesFromUsd, rateFor,
  setWalletBalance, toNaira, walletBalance, walletFor, walletsInNaira,
} from '../services/currency.js';
import { computeStats } from '../services/finance.js';

const MARKET = { USD: 1348.02, GBP: 1814.5 };

test('naira rates are worked out from dollar rates, and bad readings are dropped', () => {
  const rates = nairaRatesFromUsd({ NGN: 1348.02, GBP: 0.7429, EUR: 0.8905, CAD: 0 });
  assert.equal(rates.USD, 1348.02);
  assert.equal(rates.GBP, Math.round((1348.02 / 0.7429) * 100) / 100);
  assert.equal(rates.CAD, undefined);
  assert.deepEqual(nairaRatesFromUsd({ NGN: 5 }), {});
});

test('your own rate wins over the market rate', () => {
  assert.deepEqual(rateFor('USD', MARKET, null), { rate: 1348.02, source: 'market' });
  assert.deepEqual(rateFor('USD', MARKET, { USD: 1550 }), { rate: 1550, source: 'own' });
  assert.deepEqual(rateFor('NGN', MARKET), { rate: 1, source: 'naira' });
  assert.equal(rateFor('EUR', MARKET), null);
  assert.equal(toNaira(1000, 'USD', MARKET, { USD: 1550 }).naira, 1550000);
});

test('foreign amounts are shown with their own symbol', () => {
  assert.equal(formatForeign(1250, 'USD'), '$1,250');
  assert.equal(formatForeign(12.5, 'USD'), '$12.50');
  assert.equal(formatForeign(-40, 'GBP'), '−£40');
});

test('a foreign transaction keeps the original amount and counts at its naira value', () => {
  const fields = foreignFields(1000, 'USD', MARKET, null);
  assert.deepEqual(fields, { amount: 1348020, currency: 'USD', originalAmount: 1000, fxRate: 1348.02, fxSource: 'market' });
  assert.equal(foreignNote(fields), '$1,000 at ₦1,348');
  assert.equal(foreignFields(1000, 'NGN', MARKET), null);
  // The totals use the naira amount, so nothing else needs to change.
  const tx = { id: 'a', type: 'credit', cat: 'Income', date: '01/11/2026', ...fields };
  assert.equal(computeStats({}, [tx], new Date(2026, 10, 6)).income, 1348020);
});

test('income set in dollars follows the rate', () => {
  assert.equal(nairaIncome({ incomeCurrency: 'USD', incomeForeign: 2000, income: 1 }, MARKET), 2696040);
  assert.equal(nairaIncome({ incomeCurrency: 'USD', incomeForeign: 2000, fxOwnRates: { USD: 1500 } }, MARKET), 3000000);
  // No rate yet: the last naira figure stands.
  assert.equal(nairaIncome({ incomeCurrency: 'EUR', incomeForeign: 2000, income: 900000 }, MARKET), 900000);
  assert.equal(nairaIncome({ income: 450000 }, MARKET), 450000);
});

test('a wallet balance follows linked transactions and conversions', () => {
  const grey = { id: 'w1', name: 'Grey', currency: 'USD', opening: 300, conversions: [] };
  const txs = [
    { walletId: 'w1', type: 'credit', originalAmount: 1000 },
    { walletId: 'w1', type: 'debit', originalAmount: 15.5 },
    { walletId: 'other', type: 'credit', originalAmount: 999 },
  ];
  assert.equal(walletBalance(grey, txs), 1284.5);
  const converted = convertFromWallet(grey, 500, 1550, txs, new Date(2026, 10, 6));
  assert.equal(converted.conversion.naira, 775000);
  assert.equal(walletBalance(converted.wallet, txs), 784.5);
  assert.match(convertFromWallet(grey, 5000, 1550, txs).error, /You have \$1,284\.50 in Grey/);
  assert.equal(walletBalance(setWalletBalance(grey, 812, txs), txs), 812);
  assert.equal(walletsInNaira([grey], txs, MARKET), Math.round(1284.5 * 1348.02));
});

test('an alert moves only the wallet for its own bank', () => {
  const wallets = [
    { id: 'g', name: 'Grey', currency: 'USD' },
    { id: 'p', name: 'Payoneer', currency: 'USD' },
    { id: 'u', name: 'UK account', currency: 'GBP' },
  ];
  assert.equal(walletFor(wallets, 'Grey', 'USD').id, 'g');
  assert.equal(walletFor(wallets, 'Wise', 'USD'), null);
  assert.equal(walletFor(wallets, null, 'GBP').id, 'u');
  assert.equal(walletFor([wallets[0]], 'Payoneer', 'USD'), null);
});
