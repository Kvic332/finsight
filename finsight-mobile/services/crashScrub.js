// ── What a crash report may contain ───────────────────────────────────────────
// Crash reports go to Sentry, outside the phone. A money app's reports must never
// carry amounts, balances, names, account numbers, bank alert text or anything a
// person typed. Only the error, the screen and the phone are kept. Pure functions,
// so the rules can be tested.

const AMOUNT = /(₦|NGN|USD|GBP|EUR|CAD|US\$|CA\$|\$|£|€)\s?-?[\d,]+(\.\d+)?/gi;
const LONG_NUMBER = /\d[\d,.\s]{3,}\d/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /\+?234[\d\s]{9,}|\b0[789][01]\d{8}\b/g;

export function scrubText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[phone]')
    .replace(AMOUNT, '[amount]')
    .replace(LONG_NUMBER, '[number]');
}

// Only these context blocks describe the phone and app, not the person.
const SAFE_CONTEXTS = ['app', 'device', 'os', 'runtime'];
// Breadcrumbs from the console, the network or taps can hold anything (tap labels
// include names and amounts), so only screen changes are kept.
const DROPPED_BREADCRUMBS = new Set(['console', 'xhr', 'fetch', 'http', 'ui.input', 'ui.click', 'touch']);

export function scrubBreadcrumb(crumb) {
  if (!crumb || DROPPED_BREADCRUMBS.has(crumb.category)) return null;
  // Navigation keeps the screen names only: route params can hold a transaction.
  const data = crumb.data && (crumb.data.from || crumb.data.to)
    ? { from: crumb.data.from, to: crumb.data.to }
    : undefined;
  return { ...crumb, message: scrubText(crumb.message), data };
}

export function scrubEvent(event) {
  if (!event) return event;
  const clean = { ...event };
  delete clean.user;
  delete clean.request;
  delete clean.extra;
  delete clean.server_name;
  clean.message = typeof clean.message === 'string' ? scrubText(clean.message) : clean.message;
  if (clean.logentry) clean.logentry = { ...clean.logentry, message: scrubText(clean.logentry.message), params: undefined };
  if (clean.exception?.values) {
    clean.exception = {
      ...clean.exception,
      values: clean.exception.values.map(v => ({
        ...v,
        value: scrubText(v.value),
        // Local variables in a stack trace could hold anything.
        stacktrace: v.stacktrace ? {
          ...v.stacktrace,
          frames: (v.stacktrace.frames || []).map(f => {
            const frame = { ...f };
            delete frame.vars;
            return frame;
          }),
        } : v.stacktrace,
      })),
    };
  }
  if (clean.contexts) {
    clean.contexts = Object.fromEntries(Object.entries(clean.contexts).filter(([key]) => SAFE_CONTEXTS.includes(key)));
  }
  if (clean.breadcrumbs) {
    const list = Array.isArray(clean.breadcrumbs) ? clean.breadcrumbs : clean.breadcrumbs.values || [];
    clean.breadcrumbs = list.map(scrubBreadcrumb).filter(Boolean);
  }
  return clean;
}
