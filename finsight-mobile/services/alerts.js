// Spotting repeats, so one bank alert or statement line isn't counted twice.
// Pure functions, so they can be unit tested.

const REPEAT_WINDOW_MS = 2 * 60 * 1000;

const sameText = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// Banks and phones sometimes deliver the same alert twice within moments. Two
// genuine purchases of the same amount from different places are not repeats.
export function isRepeatAlert(existing, tx, now = Date.now()) {
  return existing.some(e => e.source === 'push'
    && e.amount === tx.amount
    && e.type === tx.type
    && sameText(e.desc, tx.desc)
    && typeof e.capturedAt === 'number'
    && Math.abs(now - e.capturedAt) < REPEAT_WINDOW_MS);
}

const importKey = t => `${t.amount}_${t.date}_${(t.desc || '').slice(0, 10)}`;

// For imports: skips anything already recorded, but keeps repeats inside the same
// import, because a statement can really list two identical purchases in a day.
export function newImports(existing, incoming) {
  const known = new Set(existing.map(importKey));
  return incoming.filter(t => !known.has(importKey(t)));
}
