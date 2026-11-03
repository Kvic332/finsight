import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAge, formatDayLabel, formatMoney, formatMoneyCompact, formatPercent, parseAmount,
} from '../services/format.js';

test('formatMoney groups thousands and rounds to whole naira', () => {
  assert.equal(formatMoney(0), '₦0');
  assert.equal(formatMoney(999), '₦999');
  assert.equal(formatMoney(1000), '₦1,000');
  assert.equal(formatMoney(1234567), '₦1,234,567');
  assert.equal(formatMoney(184500.6), '₦184,501');
});

test('formatMoney shows kobo only when asked', () => {
  assert.equal(formatMoney(1234.5, { kobo: true }), '₦1,234.50');
  assert.equal(formatMoney(1000000, { kobo: true }), '₦1,000,000.00');
});

test('formatMoney uses a true minus sign and optional plus', () => {
  assert.equal(formatMoney(-12400), '−₦12,400');
  assert.equal(formatMoney(450000, { showSign: true }), '+₦450,000');
  assert.equal(formatMoney(-5, { showSign: true }), '−₦5');
});

test('zero never carries a sign, even after rounding', () => {
  assert.equal(formatMoney(0, { showSign: true }), '₦0');
  assert.equal(formatMoney(-0.2), '₦0');
  assert.equal(formatMoney(0.2, { showSign: true }), '₦0');
  assert.equal(formatMoneyCompact(-0.2), '₦0');
});

test('missing or broken values show a dash, never NaN', () => {
  for (const v of [null, undefined, NaN, Infinity, '500']) {
    assert.equal(formatMoney(v), '—');
    assert.equal(formatMoneyCompact(v), '—');
    assert.equal(formatPercent(v), '—');
  }
});

test('formatMoneyCompact shortens without odd results at the boundaries', () => {
  assert.equal(formatMoneyCompact(950), '₦950');
  assert.equal(formatMoneyCompact(1000), '₦1K');
  assert.equal(formatMoneyCompact(1500), '₦1.5K');
  assert.equal(formatMoneyCompact(120000), '₦120K');
  assert.equal(formatMoneyCompact(999949), '₦999.9K');
  assert.equal(formatMoneyCompact(999950), '₦1M');
  assert.equal(formatMoneyCompact(1250000), '₦1.3M');
  assert.equal(formatMoneyCompact(-2000), '−₦2K');
});

test('formatPercent', () => {
  assert.equal(formatPercent(12), '12%');
  assert.equal(formatPercent(12.345, { decimals: 1 }), '12.3%');
});

const now = new Date(2026, 10, 3, 15, 0);

test('formatDayLabel uses words for recent days, and adds the year only if different', () => {
  assert.equal(formatDayLabel(new Date(2026, 10, 3, 1, 0), now), 'Today');
  assert.equal(formatDayLabel(new Date(2026, 10, 2, 23, 59), now), 'Yesterday');
  assert.equal(formatDayLabel(new Date(2026, 9, 20), now), '20 Oct');
  assert.equal(formatDayLabel(new Date(2025, 11, 25), now), '25 Dec 2025');
  assert.equal(formatDayLabel(new Date('nonsense'), now), '—');
});

test('formatAge', () => {
  assert.equal(formatAge(new Date(2026, 10, 3), now), 'today');
  assert.equal(formatAge(new Date(2026, 10, 2), now), 'yesterday');
  assert.equal(formatAge(new Date(2026, 9, 29), now), '5 days ago');
  assert.equal(formatAge(new Date(2026, 8, 1), now), '1 Sep');
});

test('parseAmount accepts what people type and rejects the rest', () => {
  assert.equal(parseAmount('12400'), 12400);
  assert.equal(parseAmount('12,400'), 12400);
  assert.equal(parseAmount(' ₦1,250.60 '), 1251);
  for (const bad of ['', '0', '-5', 'abc', '12a', '1.2.3', null, undefined, '0.2']) assert.equal(parseAmount(bad), null, String(bad));
});
