import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubBreadcrumb, scrubEvent, scrubText } from '../services/crashScrub.js';

test('amounts, account numbers, emails and phone numbers are removed from text', () => {
  assert.equal(scrubText('Left ₦700,384 after NGN 1,200,000 salary'), 'Left [amount] after [amount] salary');
  assert.equal(scrubText('Grey $1,250.00 and £40'), 'Grey [amount] and [amount]');
  assert.equal(scrubText('Acct 0123456789 debited'), 'Acct [number] debited');
  assert.equal(scrubText('mail kene@example.com now'), 'mail [email] now');
  assert.equal(scrubText('call 08031234567'), 'call [phone]');
  assert.equal(scrubText("Cannot read property 'amount' of undefined"), "Cannot read property 'amount' of undefined");
});

test('a crash report keeps the error and phone details, and nothing personal', () => {
  const event = scrubEvent({
    message: 'Failed for ₦50,000',
    user: { id: 'u1', email: 'kene@example.com' },
    request: { url: 'x' },
    extra: { transaction: { desc: 'Rent', amount: 150000 } },
    contexts: { device: { model: 'Redmi 14C' }, os: { name: 'Android' }, state: { user: { income: 1200000 } } },
    exception: { values: [{ type: 'TypeError', value: 'bad value 1200000 for Rent', stacktrace: { frames: [{ filename: 'HomeScreen.js', vars: { left: 700384 } }] } }] },
    breadcrumbs: [
      { category: 'navigation', data: { from: 'Home', to: 'Add', params: { tx: { amount: 5000 } } } },
      { category: 'console', message: 'balance 700384' },
      { category: 'ui.click', message: 'Pressed Save ₦5,000' },
    ],
  });
  assert.equal(event.user, undefined);
  assert.equal(event.request, undefined);
  assert.equal(event.extra, undefined);
  assert.equal(event.message, 'Failed for [amount]');
  assert.deepEqual(Object.keys(event.contexts), ['device', 'os']);
  assert.equal(event.exception.values[0].value, 'bad value [number] for Rent');
  assert.equal(event.exception.values[0].stacktrace.frames[0].vars, undefined);
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename, 'HomeScreen.js');
  assert.deepEqual(event.breadcrumbs.map(b => b.category), ['navigation']);
  assert.deepEqual(event.breadcrumbs[0].data, { from: 'Home', to: 'Add' });
});

test('console and network breadcrumbs are dropped before they are kept', () => {
  assert.equal(scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x' } }), null);
  assert.equal(scrubBreadcrumb({ category: 'console', message: 'x' }), null);
});
