import test from 'node:test';
import assert from 'node:assert/strict';
import { colors, CONTRAST_PAIRS, gradients, type } from '../constants/tokens.js';

function luminance(hex) {
  const channel = i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ['light', 'dark']) {
  test(`${scheme}: every listed text pairing meets its contrast minimum`, () => {
    const failures = CONTRAST_PAIRS
      .map(([text, bg, min]) => ({ text, bg, min, ratio: contrast(colors[scheme][text], colors[scheme][bg]) }))
      .filter(p => p.ratio < p.min)
      .map(p => `${p.text} on ${p.bg}: ${p.ratio.toFixed(2)} (needs ${p.min})`);
    assert.deepEqual(failures, []);
  });
}

test('light and dark define exactly the same colour names', () => {
  assert.deepEqual(Object.keys(colors.light).sort(), Object.keys(colors.dark).sort());
});

test('no text style is smaller than 12', () => {
  for (const [name, style] of Object.entries(type)) {
    assert.equal(style.fontSize >= 12, true, name);
    assert.equal(style.lineHeight > style.fontSize, true, name);
  }
});

test('white text is readable on every part of the gradients', () => {
  const failures = [...gradients.warm, ...gradients.plum]
    .map(c => [c, contrast('#FFFFFF', c)]).filter(([, r]) => r < 4.5).map(([c, r]) => c + ': ' + r.toFixed(2));
  assert.deepEqual(failures, []);
});
