import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  base64ToBytes, bytesToBase64, bytesToText, decryptText, encryptText, isEncrypted, KEY_BYTES,
  NONCE_BYTES, textToBytes,
} from '../services/dataCipher.js';

const key = () => new Uint8Array(randomBytes(KEY_BYTES));
const nonce = () => new Uint8Array(randomBytes(NONCE_BYTES));
const SAMPLES = ['', 'plain', '₦312,400', 'Shoprite – Ikeja 🛒', 'àéîõü 中文 𝄞', JSON.stringify([{ desc: 'Salary ₦', amount: 450000 }])];

test('text conversion matches the standard encoder in both directions', () => {
  for (const s of SAMPLES) {
    assert.deepEqual([...textToBytes(s)], [...new TextEncoder().encode(s)], s);
    assert.equal(bytesToText(new TextEncoder().encode(s)), s);
  }
});

test('base64 matches the standard encoder at every padding length', () => {
  for (let n = 0; n < 40; n++) {
    const bytes = new Uint8Array(randomBytes(n));
    assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString('base64'));
    assert.deepEqual([...base64ToBytes(bytesToBase64(bytes))], [...bytes]);
  }
  assert.throws(() => base64ToBytes('not*valid'));
});

test('anything encrypted can be decrypted back exactly', () => {
  const k = key();
  for (const s of SAMPLES) {
    const sealed = encryptText(k, nonce(), s);
    assert.equal(isEncrypted(sealed), true);
    assert.equal(decryptText(k, sealed), s);
  }
});

test('stored text does not reveal what is inside', () => {
  const sealed = encryptText(key(), nonce(), 'Salary 450000 GTBank');
  for (const word of ['Salary', '450000', 'GTBank']) assert.equal(sealed.includes(word), false);
});

test('the same text encrypts differently each time', () => {
  const k = key();
  assert.notEqual(encryptText(k, nonce(), 'same'), encryptText(k, nonce(), 'same'));
});

test('the wrong key is rejected rather than returning rubbish', () => {
  const sealed = encryptText(key(), nonce(), 'secret');
  assert.throws(() => decryptText(key(), sealed));
});

test('tampered data is rejected', () => {
  const k = key();
  const sealed = encryptText(k, nonce(), 'amount: 5000');
  const i = sealed.length - 6;
  const flipped = sealed.slice(0, i) + (sealed[i] === 'A' ? 'B' : 'A') + sealed.slice(i + 1);
  assert.throws(() => decryptText(k, flipped));
});

test('plain older data is recognised as not encrypted', () => {
  assert.equal(isEncrypted('[{"amount":1}]'), false);
  assert.equal(isEncrypted(null), false);
});

test('a large history round-trips quickly', () => {
  const k = key();
  const big = JSON.stringify(Array.from({ length: 2000 }, (_, i) => ({ id: i, desc: `Shoprite ₦${i}`, amount: i, raw: 'x'.repeat(100) })));
  const start = Date.now();
  assert.equal(decryptText(k, encryptText(k, nonce(), big)), big);
  assert.equal(Date.now() - start < 2000, true);
});
