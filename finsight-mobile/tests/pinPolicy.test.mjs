import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWait, lockSeconds, nextAttemptState, secondsLeft } from '../services/pinPolicy.js';

test('the first few wrong tries carry no wait, so typos are forgiven', () => {
  for (const n of [0, 1, 2, 3, 4]) assert.equal(lockSeconds(n), 0);
});

test('waits grow with repeated failures and stay at the maximum', () => {
  assert.equal(lockSeconds(5), 30);
  assert.equal(lockSeconds(6), 60);
  assert.equal(lockSeconds(7), 300);
  assert.equal(lockSeconds(8), 900);
  assert.equal(lockSeconds(500), 900);
});

test('a failure records the attempt and when the pad unlocks', () => {
  assert.deepEqual(nextAttemptState(0, 1000), { attempts: 1, lockedUntil: 0 });
  assert.deepEqual(nextAttemptState(4, 1000), { attempts: 5, lockedUntil: 31000 });
});

test('time left counts down to zero and never goes negative', () => {
  assert.equal(secondsLeft(31000, 1000), 30);
  assert.equal(secondsLeft(31000, 30500), 1);
  assert.equal(secondsLeft(31000, 31000), 0);
  assert.equal(secondsLeft(0, 5000), 0);
});

test('waits read naturally', () => {
  assert.equal(formatWait(1), '1 second');
  assert.equal(formatWait(30), '30 seconds');
  assert.equal(formatWait(60), '1 minute');
  assert.equal(formatWait(61), '2 minutes');
  assert.equal(formatWait(900), '15 minutes');
});
