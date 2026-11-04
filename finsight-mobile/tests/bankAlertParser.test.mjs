import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { BANK_APPS, BANK_SENDERS, parseBankAlert } from '../services/bankAlertParser.js';

const POSTED = new Date(2026, 10, 4, 9, 30).getTime();
const alert = (text, over = {}) => ({
  id: 'x1', pkg: 'com.gtbank.gtworldv1', channel: 'app', title: 'GTWorld', text, postedAt: POSTED, ...over,
});
const sms = (title, text) => alert(text, { pkg: 'com.android.mms', channel: 'sms', title });
const parse = (...args) => parseBankAlert(alert(...args));

// ── Amounts ───────────────────────────────────────────────────────────────────
test('the balance is never taken as the amount', () => {
  assert.equal(parse('Avail Bal N100,000.00. You were debited N500.00').amount, 500);
  assert.equal(parse('Bal: ₦250,000 Debit alert ₦1,200').amount, 1200);
  assert.equal(parse('Ledger Balance: NGN 90,000. Sent NGN 2,000').amount, 2000);
  assert.equal(parse('You were debited N500. Available balance N100,000').amount, 500);
});

test('fees are not taken as the amount', () => {
  assert.equal(parse('Fee: N10.75. You sent N5,000 to Ade').amount, 5000);
  assert.equal(parse('You sent N5,000 to Ade. Fee N10.75').amount, 5000);
});

test('labelled amounts are read, with their direction', () => {
  const debit = parseBankAlert(sms('Fidelity', 'Acct:123**45 DR:N5,000.00 Desc:POS Shoprite DT:15/MAY/26 Bal:N20,000'));
  assert.equal(debit.amount, 5000);
  assert.equal(debit.type, 'debit');
  const credit = parseBankAlert(sms('GTBank', 'Acct: 01**89 Amt: NGN12,500.50 CR Desc: Salary Bal: NGN 99,000'));
  assert.equal(credit.amount, 12501);
  assert.equal(credit.type, 'credit');
  assert.equal(parseBankAlert(sms('UBA', 'CR 7,000 Acct 12**3')).amount, 7000);
});

test('other money formats are read', () => {
  assert.equal(parse('You received ₦1,500').amount, 1500);
  assert.equal(parse('You received NGN1,500.00').amount, 1500);
  assert.equal(parse('You received 1,500 naira').amount, 1500);
});

test('very small or missing amounts give nothing', () => {
  assert.equal(parse('You were debited N5'), null);
  assert.equal(parse('Your account was debited'), null);
  assert.equal(parse('Debit on card ending 4532'), null);
});

// ── Direction ─────────────────────────────────────────────────────────────────
test('money in and money out are told apart', () => {
  for (const text of ['Credit Alert: N500', 'You received N500', 'Acct credited with N500', 'Transfer from Ade N500', 'Salary N500', 'Refund of N500', 'Reversal of N500']) {
    assert.equal(parse(text).type, 'credit', text);
  }
  for (const text of ['Debit Alert: N500', 'You sent N500', 'Acct debited with N500', 'Transfer to Ade N500', 'POS purchase N500', 'You paid N500', 'ATM withdrawal N500']) {
    assert.equal(parse(text).type, 'debit', text);
  }
});

test('an unclear direction is skipped, not assumed to be spending', () => {
  assert.equal(parse('Transaction of N500 on your account'), null);
  assert.equal(parse('Your payment of N500 has been received'), null);
});

// ── Not transactions ──────────────────────────────────────────────────────────
test('messages that are not completed transactions are ignored', () => {
  for (const text of [
    'Your OTP for the N5,000 transfer to Ade is 123456',
    'Your transfer of N5,000 failed',
    'Payment of N5,000 was declined',
    'Your loan repayment of N5,000 is due tomorrow',
    'You qualify for a loan of N500,000 paid today',
    'Get up to N50,000 credited to your account',
    'Win N1,000,000 when you send money',
    'N2,000 will be debited on Friday',
    'Open the app to see what is new',
  ]) {
    assert.equal(parse(text), null, text);
  }
});

// ── The transaction ───────────────────────────────────────────────────────────
test('the transaction has what the app needs', () => {
  const tx = parse('You sent N5,000 to Ade Bello');
  assert.deepEqual(tx, {
    id: 'alert_x1',
    desc: 'Ade Bello',
    amount: 5000,
    type: 'debit',
    cat: 'Transfer',
    bank: 'GTBank',
    source: 'push',
    channel: 'app',
    capturedAt: POSTED,
    date: '04/11/2026',
  });
});

test('the date is when the alert arrived, not when the app was opened', () => {
  const posted = new Date(2026, 0, 2, 8, 0).getTime();
  assert.equal(parseBankAlert(alert('You sent N500', { postedAt: posted })).date, '02/01/2026');
});

test('descriptions leave out account numbers', () => {
  const tx = parseBankAlert(sms('GTBank', 'DR:N500 Desc: TRF 0123456789 Bolt ride Bal:N10'));
  assert.doesNotMatch(tx.desc, /0123456789/);
  assert.match(tx.desc, /Bolt ride/);
  assert.doesNotMatch(parse('You were debited N500').desc, /\d{6}/);
});

test('categories come from the alert, with sensible defaults', () => {
  assert.equal(parse('POS purchase N500 at Shoprite').cat, 'Food');
  assert.equal(parse('You received N500').cat, 'Income');
  assert.equal(parse('You paid N500').cat, 'Other');
});

test('the bank comes from the app or the SMS sender', () => {
  assert.equal(parse('You sent N500').bank, 'GTBank');
  assert.equal(parse('You sent N500', { pkg: 'team.opay.pay' }).bank, 'OPay');
  assert.equal(parseBankAlert(sms('GTBANKPLC', 'DR:N500')).bank, 'GTBank');
  assert.equal(parseBankAlert(sms('UBA', 'DR:N500')).bank, 'UBA');
  assert.equal(parseBankAlert(sms('Ubaldo', 'DR:N500')).bank, null);
});

test('words inside other words do not count', () => {
  assert.equal(parse('Trip to Dubai for N500'), null);
  assert.equal(parse('Depositor Naira N500'), null);
});

test('nothing breaks on empty alerts', () => {
  assert.equal(parseBankAlert(null), null);
  assert.equal(parseBankAlert({}), null);
  assert.equal(parseBankAlert(alert('')), null);
});

// ── Sources ───────────────────────────────────────────────────────────────────
test('sources are well formed for the Android side', () => {
  for (const pkg of Object.keys(BANK_APPS)) assert.match(pkg, /^[A-Za-z][\w]*(\.[A-Za-z0-9_]+)+$/);
  for (const sender of BANK_SENDERS) assert.match(sender, /^[a-z0-9]+$/);
});

// ── Registering the Android bridge ────────────────────────────────────────────
const require = createRequire(import.meta.url);
const { registerPackage } = require('../plugins/withNativeBankCapture.js');

const MAIN_APPLICATION = `override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here
            }`;

test('the bridge is registered in MainApplication.kt, once', () => {
  const once = registerPackage(MAIN_APPLICATION);
  assert.match(once, /packages\.apply \{\s+add\(NotificationPermissionPackage\(\)\)/);
  assert.equal(registerPackage(once), once);
});

test('the build fails if the bridge cannot be registered', () => {
  assert.throws(() => registerPackage('class MainApplication'), /could not register/);
});
