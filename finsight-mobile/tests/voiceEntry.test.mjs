import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenTransaction, spokenAmount, spokenCategory } from '../services/voiceEntry.js';

const OUT = ['Food', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Savings', 'Other'];
const IN = ['Income', 'Savings', 'Other'];

test('a whole spoken transaction fills every field', () => {
  assert.deepEqual(parseSpokenTransaction('5000 naira for laptop under shopping', OUT), { cat: 'Shopping', amount: 5000, desc: 'Laptop' });
  assert.deepEqual(parseSpokenTransaction('I spent 2,500 on lunch', OUT), { cat: 'Food', amount: 2500, desc: 'Lunch' });
});

test('saying just a category picks it', () => {
  assert.equal(parseSpokenTransaction('transport', OUT).cat, 'Transport');
  assert.equal(parseSpokenTransaction('Health', OUT).cat, 'Health');
  assert.equal(parseSpokenTransaction('put it under entertainment', OUT).cat, 'Entertainment');
});

test('a category said after "under" wins over a word in the description', () => {
  assert.deepEqual(parseSpokenTransaction('laptop under other', OUT), { cat: 'Other', amount: null, desc: 'Laptop' });
  assert.equal(parseSpokenTransaction('bolt ride category food', OUT).cat, 'Food');
});

test('everyday words map to their category', () => {
  assert.equal(spokenCategory('bought airtime', OUT).cat, 'Utilities');
  assert.equal(spokenCategory('keke to work', OUT).cat, 'Transport');
  assert.equal(spokenCategory('drugs from the pharmacy', OUT).cat, 'Health');
  assert.equal(spokenCategory('my salary', IN).cat, 'Income');
});

test('only categories allowed for this kind of transaction are chosen', () => {
  assert.equal(spokenCategory('food', IN), null);
  assert.equal(spokenCategory('salary', OUT), null);
});

test('nothing recognised means no category, so the current one stays', () => {
  assert.equal(parseSpokenTransaction('hello there', OUT).cat, null);
  assert.equal(parseSpokenTransaction('', OUT).cat, null);
});

test('amounts are read in the ways people say them', () => {
  assert.equal(spokenAmount('5000').amount, 5000);
  assert.equal(spokenAmount('₦12,500 for data').amount, 12500);
  assert.equal(spokenAmount('5k').amount, 5000);
  assert.equal(spokenAmount('2.5 million').amount, 2500000);
  assert.equal(spokenAmount('20 thousand naira').amount, 20000);
  assert.equal(spokenAmount('no number here'), null);
  assert.equal(spokenAmount('0'), null);
});
