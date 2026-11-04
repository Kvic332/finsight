import { auth } from './firebase';

const ADMIN_URL = process.env.EXPO_PUBLIC_CATALOG_ADMIN_URL || '';

const ERROR_MESSAGES = {
  unauthenticated: 'Sign in to your FinSight account first.',
  forbidden: "This account doesn't have admin access.",
  invalid_request: 'Check the details. Links must start with https:// and dates can’t be in the future.',
  duplicate: 'That name is already in use.',
  rejected: "The database didn't accept that. Check the details and try again.",
  not_found: 'That record no longer exists. Refresh and try again.',
};
const GENERIC_ERROR = "That didn't save. Please try again in a moment.";
const OFFLINE_ERROR = "Couldn't reach the server. Check your connection and try again.";

function failure(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// The server checks admin access on every request. Hiding the screen from other
// people is only a convenience.
export async function catalogAction(action, payload = {}) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw failure(ERROR_MESSAGES.unauthenticated, 'unauthenticated');
  if (!ADMIN_URL) throw failure(GENERIC_ERROR);

  let response;
  try {
    response = await fetch(ADMIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ ...payload, action }),
    });
  } catch {
    throw failure(OFFLINE_ERROR);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw failure(ERROR_MESSAGES[data.error] || GENERIC_ERROR, data.error);
  return data;
}
