import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_BACKUP_EVERY_MS, autoBackupNote, hashText, shouldAutoBackup } from '../services/autoBackupRules.js';

const NOW = Date.UTC(2026, 10, 6, 12);
const DAY = 24 * 3600 * 1000;
const ready = over => ({ enabled: true, uid: 'u1', state: { uid: 'u1', at: NOW - DAY, hash: 'old' }, hash: 'new', now: NOW, ...over });

test('backs up once a day when something changed', () => {
  assert.equal(shouldAutoBackup(ready()), true);
});

test('skips when nothing changed since the last backup', () => {
  assert.equal(shouldAutoBackup(ready({ hash: 'old' })), false);
});

test('waits until about a day has passed', () => {
  assert.equal(shouldAutoBackup(ready({ state: { uid: 'u1', at: NOW - 3600 * 1000, hash: 'old' } })), false);
  assert.equal(shouldAutoBackup(ready({ state: { uid: 'u1', at: NOW - AUTO_BACKUP_EVERY_MS, hash: 'old' } })), true);
});

test('never runs on a phone that has not backed up or restored for this account', () => {
  // A new or reset phone mustn't overwrite a good backup with nearly empty data.
  assert.equal(shouldAutoBackup(ready({ state: null })), false);
  assert.equal(shouldAutoBackup(ready({ state: { uid: 'someone-else', at: NOW - DAY, hash: 'old' } })), false);
});

test('never runs when switched off or signed out', () => {
  assert.equal(shouldAutoBackup(ready({ enabled: false })), false);
  assert.equal(shouldAutoBackup(ready({ uid: null })), false);
});

test('the fingerprint changes when the data changes', () => {
  assert.equal(hashText('{"a":1}'), hashText('{"a":1}'));
  assert.notEqual(hashText('{"a":1}'), hashText('{"a":2}'));
});

test('the note says why automatic backup is or isn\'t running', () => {
  assert.match(autoBackupNote({ enabled: false, uid: 'u1', state: null }), /^Off/);
  assert.match(autoBackupNote({ enabled: true, uid: 'u1', state: null }), /^Starts after/);
  assert.match(autoBackupNote({ enabled: true, uid: 'u1', state: { uid: 'u1' } }), /^On/);
});
