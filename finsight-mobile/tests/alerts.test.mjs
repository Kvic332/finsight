import test from 'node:test';
import assert from 'node:assert/strict';
import { isRepeatAlert, mergeBankAlerts, newImports } from '../services/alerts.js';

const NOW = 1_000_000_000;
const alert = over => ({
  id: 'alert_new', source: 'push', amount: 5000, type: 'debit', bank: 'GTBank', channel: 'sms', capturedAt: NOW, ...over,
});
const fromApp = over => alert({ id: 'alert_old', channel: 'app', capturedAt: NOW - 30000, ...over });

test('one payment announced by the app and by SMS counts once', () => {
  assert.equal(isRepeatAlert([fromApp()], alert()), true);
});

test('the same alert id is never added twice', () => {
  assert.equal(isRepeatAlert([alert()], alert()), true);
});

test('real transactions are not mistaken for repeats', () => {
  const cases = [
    fromApp({ channel: 'sms' }),
    fromApp({ capturedAt: NOW - 3 * 60 * 1000 }),
    fromApp({ amount: 5001 }),
    fromApp({ type: 'credit' }),
    fromApp({ bank: 'UBA' }),
    fromApp({ source: 'manual' }),
    fromApp({ channel: undefined }),
    fromApp({ capturedAt: undefined }),
  ];
  for (const old of cases) assert.equal(isRepeatAlert([old], alert()), false, JSON.stringify(old));
  assert.equal(isRepeatAlert([], alert()), false);
});

const rawAlert = (id, text, over = {}) => ({
  id, pkg: 'com.gtbank.gtworldv1', channel: 'app', title: 'GTWorld', text, postedAt: NOW, ...over,
});

test('alerts become transactions in front of the existing ones', () => {
  const existing = [{ id: 'manual', amount: 1 }];
  const { added, merged } = mergeBankAlerts(existing, [rawAlert('a', 'You were debited N5,000')]);
  assert.equal(added.length, 1);
  assert.equal(merged[0].amount, 5000);
  assert.equal(merged[1].id, 'manual');
});

test('alerts that are not transactions are dropped', () => {
  const { added, merged } = mergeBankAlerts([], [rawAlert('a', 'Your OTP is 123456'), rawAlert('b', 'Welcome back')]);
  assert.equal(added.length, 0);
  assert.equal(merged.length, 0);
});

test('two real payments of the same amount are both kept', () => {
  const { added } = mergeBankAlerts([], [
    rawAlert('a', 'You were debited N500 at POS. Bal N9,500'),
    rawAlert('b', 'You were debited N500 at POS. Bal N9,000', { postedAt: NOW + 30000 }),
  ]);
  assert.equal(added.length, 2);
});

test('a payment seen in a queue twice, across channels or saves, is added once', () => {
  const app = rawAlert('a', 'You were debited N500');
  const sms = rawAlert('b', 'DR:N500.00', { channel: 'sms', pkg: 'sms.app', title: 'GTBank', postedAt: NOW + 5000 });
  assert.equal(mergeBankAlerts([], [app, sms]).added.length, 1);
  const { merged } = mergeBankAlerts([], [app]);
  assert.equal(mergeBankAlerts(merged, [app]).added.length, 0);
});

test('imports skip what is already recorded', () => {
  const existing = [{ amount: 100, date: '01/11/2026', desc: 'Shoprite Ikeja' }];
  const incoming = [
    { amount: 100, date: '01/11/2026', desc: 'Shoprite Ikeja' },
    { amount: 100, date: '02/11/2026', desc: 'Shoprite Ikeja' },
  ];
  assert.deepEqual(newImports(existing, incoming), [incoming[1]]);
});

test('identical purchases within one import are all kept', () => {
  const twice = [{ amount: 100, date: '01/11/2026', desc: 'Bus' }, { amount: 100, date: '01/11/2026', desc: 'Bus' }];
  assert.equal(newImports([], twice).length, 2);
});
