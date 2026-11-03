// Encrypts text with AES-256-GCM. Pure functions, so they can be unit tested.
// Text and base64 conversion are done by hand because React Native's JavaScript
// engine doesn't provide TextDecoder or btoa on every Android version.
import { gcm } from '@noble/ciphers/aes.js';

export const PREFIX = 'enc1:';
export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = Object.fromEntries([...B64].map((ch, i) => [ch, i]));

export function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

export function base64ToBytes(text) {
  const clean = text.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const ch of clean) {
    const value = B64_LOOKUP[ch];
    if (value === undefined) throw new Error('Invalid base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 255;
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

export function textToBytes(text) {
  const out = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(out);
}

export function bytesToText(bytes) {
  const parts = [];
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    let code;
    if (b < 0x80) { code = b; i += 1; }
    else if (b < 0xe0) { code = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2; }
    else if (b < 0xf0) { code = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
    else { code = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63); i += 4; }
    parts.push(String.fromCodePoint(code));
  }
  return parts.join('');
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptText(key, nonce, text) {
  const sealed = gcm(key, nonce).encrypt(textToBytes(text));
  const combined = new Uint8Array(nonce.length + sealed.length);
  combined.set(nonce);
  combined.set(sealed, nonce.length);
  return PREFIX + bytesToBase64(combined);
}

// Throws if the key is wrong or the data has been altered.
export function decryptText(key, value) {
  const combined = base64ToBytes(value.slice(PREFIX.length));
  const nonce = combined.subarray(0, NONCE_BYTES);
  return bytesToText(gcm(key, nonce).decrypt(combined.subarray(NONCE_BYTES)));
}
