import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPayeeRules, learnPayeeRule, payeeKey } from '../services/payeeRules.js';

test('the same payee gets the same name, however the bank writes it', () => {
  assert.equal(payeeKey('ONB TRF TO SLOT SYSTEMS 12345678'), 'slot systems');
  assert.equal(payeeKey('Slot Systems POS'), 'slot systems');
  assert.equal(payeeKey('NIP/TRF/Uber Nigeria/REF 99'), 'uber nigeria');
  assert.equal(payeeKey('TRF TO 0123456789'), null);
  assert.equal(payeeKey(''), null);
});

test('a correction is remembered and used for later imports', () => {
  const rules = learnPayeeRule({}, 'ONB TRF TO SLOT SYSTEMS 1234', 'Shopping');
  const [tx] = applyPayeeRules([{ desc: 'TRF TO SLOT SYSTEMS 9876', cat: 'Transfer', source: 'push' }], rules);
  assert.equal(tx.cat, 'Shopping');
  assert.equal(tx.ruleApplied, true);
});

test('transactions typed by hand, or with nothing to match, are left alone', () => {
  const rules = { uber: 'Transport' };
  const list = [
    { desc: 'Uber', cat: 'Other', source: 'manual' },
    { desc: 'Shoprite Ikeja', cat: 'Food', source: 'sms' },
  ];
  assert.deepEqual(applyPayeeRules(list, rules), list);
});

test('a later correction replaces an earlier one', () => {
  let rules = learnPayeeRule({}, 'Victor K', 'Transfer');
  rules = learnPayeeRule(rules, 'TRF TO VICTOR K', 'Debt');
  // Single letters, like the initial in "VICTOR K", aren't part of the name.
  assert.deepEqual(rules, { victor: 'Debt' });
});
