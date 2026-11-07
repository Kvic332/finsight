import * as Sentry from '@sentry/react-native';
import { scrubBreadcrumb, scrubEvent } from './crashScrub';

// Crash reports go to FinSight's Sentry project, stored in the EU. Without a DSN,
// as in tests or a local build without it, nothing is set up and nothing is sent.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

let started = false;

export function startCrashReporting() {
  if (!DSN || started) return;
  started = true;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'preview',
    // Nothing that identifies the person: no IP address, no user, no screenshots,
    // no screen recordings and no view of what's on the screen.
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Errors only, no performance tracing.
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

// Catches crashes in the screens below it and reports them.
export const withCrashReporting = Component => (DSN ? Sentry.wrap(Component) : Component);

// A harmless report, to check reporting works end to end.
export async function sendTestReport() {
  if (!DSN || !started) return false;
  Sentry.captureMessage('FinSight test report: crash reporting works');
  return Sentry.flush();
}

export const crashReportingOn = () => !!DSN;
