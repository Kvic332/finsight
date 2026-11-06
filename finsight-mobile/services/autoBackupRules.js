// ── When to back up automatically ─────────────────────────────────────────────
// Pure functions only, so they can be unit tested.

// A little under a day, so opening the app at about the same time each day still
// backs up daily.
export const AUTO_BACKUP_EVERY_MS = 20 * 3600 * 1000;

// A short fingerprint of the backup, to tell whether anything changed since the
// last one. Not for security: it only avoids uploading the same data again.
export function hashText(text) {
  let hash = 5381;
  const value = String(text);
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(16);
}

// state is what this phone remembers about its last backup or restore:
// { uid, at, hash }. It's only set once this phone has backed up or restored for
// that account, so a new or reset phone can't overwrite a good backup by itself.
export function shouldAutoBackup({ enabled, uid, state, hash, now = Date.now() }) {
  if (!enabled || !uid || !state || state.uid !== uid) return false;
  if (state.hash === hash) return false;
  return !state.at || now - state.at >= AUTO_BACKUP_EVERY_MS;
}

// What to tell the user about automatic backup on this phone.
export function autoBackupNote({ enabled, uid, state }) {
  if (!enabled) return 'Off. Back up by hand with the button above.';
  if (!state || state.uid !== uid) return 'Starts after you back up or restore once on this phone, so a new phone never overwrites your backup.';
  return 'On. FinSight backs up once a day when you open it, if anything changed.';
}
