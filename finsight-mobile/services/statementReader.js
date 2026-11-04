import * as FileSystem from 'expo-file-system/legacy';
import { getIdToken } from './ariaClient';

const STATEMENT_URL = process.env.EXPO_PUBLIC_STATEMENT_URL || '';
const MAX_BYTES = 8 * 1024 * 1024;
// Long statements take a while, and the server gives up at around 150 seconds.
const TIMEOUT_MS = 170000;

const ERROR_MESSAGES = {
  password_protected: 'This PDF has a password, which we can\'t read yet. Ask your bank for one without a password, or use Excel or CSV.',
  not_a_pdf: 'This doesn\'t look like a real PDF. Try downloading it from your bank again.',
  not_a_statement: 'This doesn\'t look like a bank statement. Check that you chose the right file.',
  too_long: 'This statement is too long to read in one go. Try a shorter date range.',
  too_large: 'This PDF is too large. Try a shorter date range, up to 8 MB.',
  user_limit: 'You\'ve reached today\'s limit for PDF statements. It resets at midnight, or you can use Excel or CSV now.',
  global_limit: 'PDF statements are very busy today. Try again tomorrow, or use Excel or CSV now.',
};
const GENERIC_ERROR = "We couldn't read this statement. Please try again, or use Excel or CSV.";
const OFFLINE_ERROR = "Couldn't reach our server. Check your connection and try again.";

// Sends the PDF to be read. Only call this after the person has agreed to it.
export async function readStatementPdf(asset) {
  if (asset.size > MAX_BYTES) throw new Error(ERROR_MESSAGES.too_large);
  if (!STATEMENT_URL) throw new Error(GENERIC_ERROR);
  const pdf = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' })
    .catch(() => { throw new Error(GENERIC_ERROR); });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(STATEMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getIdToken()}`,
      },
      body: JSON.stringify({ pdf }),
      signal: controller.signal,
    });
  } catch {
    throw new Error(OFFLINE_ERROR);
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.rows)) throw new Error(ERROR_MESSAGES[data.error] || GENERIC_ERROR);
  return data;
}
