// How long the PIN pad locks after repeated wrong tries. A 6-digit PIN has only a
// million combinations, so guessing has to be slow for the PIN to mean anything.
const FREE_TRIES = 4;
const DELAYS_SECONDS = [30, 60, 300, 900];

export function lockSeconds(failedAttempts) {
  if (failedAttempts <= FREE_TRIES) return 0;
  const step = failedAttempts - FREE_TRIES - 1;
  return DELAYS_SECONDS[Math.min(step, DELAYS_SECONDS.length - 1)];
}

export function nextAttemptState(failedAttempts, now = Date.now()) {
  const attempts = failedAttempts + 1;
  const seconds = lockSeconds(attempts);
  return { attempts, lockedUntil: seconds ? now + seconds * 1000 : 0 };
}

export function secondsLeft(lockedUntil, now = Date.now()) {
  return lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;
}

export function formatWait(seconds) {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
