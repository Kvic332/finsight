// Spotting repeats, so one bank alert or statement line isn't counted twice.
// Pure functions, so they can be unit tested.
import { parseBankAlert } from './bankAlertParser.js';

const REPEAT_WINDOW_MS = 2 * 60 * 1000;

// The Android service already drops the same text posted again. What's left is one
// payment announced by both the bank's app and an SMS. Two alerts from the same
// channel are two real payments, even for the same amount.
export function isRepeatAlert(existing, tx) {
  return existing.some(e => e.id === tx.id
    || (e.source === 'push'
      && e.amount === tx.amount
      && e.type === tx.type
      && e.bank === tx.bank
      && e.channel && tx.channel && e.channel !== tx.channel
      && typeof e.capturedAt === 'number'
      && Math.abs(tx.capturedAt - e.capturedAt) < REPEAT_WINDOW_MS));
}

// Turns queued alerts into transactions added to the front of the list. Alerts that
// aren't transactions are simply dropped.
export function mergeBankAlerts(existing, alerts, fx = null) {
  const added = [];
  for (const alert of alerts) {
    const tx = parseBankAlert(alert, fx);
    if (tx && !isRepeatAlert([...added, ...existing], tx)) added.push(tx);
  }
  // The queue runs oldest first, and the list runs newest first.
  return { added, merged: [...[...added].reverse(), ...existing] };
}

const importKey = t => `${t.amount}_${t.date}_${(t.desc || '').slice(0, 10)}`;

// For imports: skips anything already recorded, but keeps repeats inside the same
// import, because a statement can really list two identical purchases in a day.
export function newImports(existing, incoming) {
  const known = new Set(existing.map(importKey));
  return incoming.filter(t => !known.has(importKey(t)));
}
