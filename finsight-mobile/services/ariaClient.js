import { signInAnonymously } from 'firebase/auth';
import { auth } from './firebase';

const ARIA_URL = process.env.EXPO_PUBLIC_ARIA_URL || '';
const MAX_CONTEXT_CHARS = 16000;

const ERROR_MESSAGES = {
  user_limit: "You've reached today's ARIA limit. It resets at midnight.",
  global_limit: 'ARIA is very busy today. Please try again tomorrow.',
};
const GENERIC_ERROR = "ARIA couldn't answer just now. Please try again in a moment.";
const OFFLINE_ERROR = "Couldn't reach ARIA. Check your connection and try again.";

// ARIA works without a FinSight account, so people who haven't signed in get a
// silent anonymous identity. It only exists to apply per-person usage limits.
// Wait for the saved session first, or this would replace a signed-in user.
export async function getIdToken() {
  await auth.authStateReady();
  const user = auth.currentUser || (await signInAnonymously(auth)).user;
  return user.getIdToken();
}

export async function askAria(messages, context, language = 'en') {
  if (!ARIA_URL) throw new Error(GENERIC_ERROR);
  let response;
  try {
    const token = await getIdToken();
    response = await fetch(ARIA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        context: context.slice(0, MAX_CONTEXT_CHARS),
        language,
      }),
    });
  } catch {
    throw new Error(OFFLINE_ERROR);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.reply) throw new Error(ERROR_MESSAGES[data.error] || GENERIC_ERROR);
  return data.reply;
}
