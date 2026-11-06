// Reads the text of bank notifications into transactions. Pure functions, so they
// can be unit tested and corrected with an app update. A wrong amount is worse than
// a missed alert, so anything unclear returns null rather than a guess.
import { detectCategory } from './smsParser.js';
import { noiseReason } from './transactionReview.js';

// Android app IDs, each confirmed on Google Play. Notifications from any other app
// are ignored, apart from bank SMS below.
export const BANK_APPS = {
  'com.gtbank.gtworldv1': 'GTBank',
  'com.accessbank.nextgen': 'Access Bank',
  'com.zenithBank.eazymoney': 'Zenith Bank',
  'com.firstbank.firstmobile': 'First Bank',
  'com.firstbank.lit': 'First Bank',
  'com.uba.vericash': 'UBA',
  'com.fidelitybank.mobile': 'Fidelity Bank',
  'com.sterlingng.sterlingmobile': 'Sterling Bank',
  'com.wemabank.alat.prod': 'Wema Bank',
  'com.appzonegroup.fcmb': 'FCMB',
  'com.StanbicMobile': 'Stanbic IBTC',
  'com.app.ecobank': 'Ecobank',
  'com.ceva.ubmobile.stallion': 'Union Bank',
  'team.opay.pay': 'OPay',
  'com.transsnet.palmpay': 'PalmPay',
  'com.kudabank.app': 'Kuda Bank',
  'com.moniepoint.personal': 'Moniepoint',
  'com.renmoney.android': 'Renmoney',
  'ng.com.fairmoney.fairmoney': 'FairMoney',
  'com.lenddo.mobile.paylater': 'Carbon',
};

// SMS sender names, in lower case with only letters and digits. An SMS is kept only
// if it comes from one of these, so personal messages are never read.
const SMS_SENDERS = {
  gtbank: 'GTBank',
  gtb: 'GTBank',
  gtco: 'GTBank',
  accessbank: 'Access Bank',
  access: 'Access Bank',
  zenith: 'Zenith Bank',
  firstbank: 'First Bank',
  fbn: 'First Bank',
  uba: 'UBA',
  fidelity: 'Fidelity Bank',
  sterling: 'Sterling Bank',
  wema: 'Wema Bank',
  alat: 'Wema Bank',
  fcmb: 'FCMB',
  stanbic: 'Stanbic IBTC',
  ecobank: 'Ecobank',
  unionbank: 'Union Bank',
  polaris: 'Polaris Bank',
  keystone: 'Keystone Bank',
  providus: 'Providus Bank',
  jaiz: 'Jaiz Bank',
  kuda: 'Kuda Bank',
  opay: 'OPay',
  palmpay: 'PalmPay',
  moniepoint: 'Moniepoint',
};
export const BANK_SENDERS = Object.keys(SMS_SENDERS);

const MIN_AMOUNT = 10;
const NUMBER = '\\d[\\d,]*(?:\\.\\d{1,2})?';
const CURRENCY = '(?:₦|NGN|N)';

// Not a completed movement of money, even if it mentions an amount.
const NOT_A_TRANSACTION = /\b(otp|one[- ]time|verification code|token is|do not share|failed|unsuccessful|declined|insufficient|due|overdue|repay(ment)?|qualif\w*|eligible|pre-?approved|offers?|win|won|bonus|promo\w*|discount|up to|interest rate|reminder|scheduled|will be (debited|charged|credited))\b/i;

// Words just before an amount that show it isn't the transaction's own amount.
const OTHER_FIGURE = /(bal(ance)?|avail(able)?|ledger|limit|fees?|vat|stamp duty|commission|charges?\s*:)[^.;\n\d]{0,14}$/i;

const CREDIT_WORDS = /\b(credit|credited|received|inflow|deposit(ed)?|salary|refund(ed)?|revers(al|ed)|cash ?back|lodge?ment|(transfer(red)?|trf) from)\b/i;
const DEBIT_WORDS = /\b(debit|debited|sent|paid|purchase|withdraw(n|al)?|payment of|(transfer(red)?|trf) to|pos)\b/i;

const toNumber = raw => Number(raw.replace(/,/g, ''));

// DR:N5,000.00 or CR 5000, the format several banks use in SMS.
function labelledAmount(text) {
  const match = text.match(new RegExp(`\\b(DR|CR)\\b\\s*[:\\-]?\\s*${CURRENCY}?\\s*(${NUMBER})`, 'i'));
  if (match) return { amount: toNumber(match[2]), type: match[1].toUpperCase() === 'CR' ? 'credit' : 'debit' };
  // Amt:NGN5,000.00 CR
  const amt = text.match(new RegExp(`\\b(?:amt|amount)\\b\\s*[:\\-]?\\s*${CURRENCY}?\\s*(${NUMBER})(?:\\s*\\b(DR|CR)\\b)?`, 'i'));
  if (amt) return { amount: toNumber(amt[1]), type: amt[2] ? (amt[2].toUpperCase() === 'CR' ? 'credit' : 'debit') : null };
  return null;
}

// The first money figure that isn't a balance, a fee or similar.
function firstOwnAmount(text) {
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9])${CURRENCY}\\s?(${NUMBER})|(${NUMBER})\\s?(?:naira|NGN)\\b`, 'gi');
  for (const match of text.matchAll(pattern)) {
    if (!OTHER_FIGURE.test(text.slice(0, match.index + 1))) return toNumber(match[1] || match[2]);
  }
  return null;
}

function directionFromWords(text) {
  const credit = CREDIT_WORDS.test(text);
  const debit = DEBIT_WORDS.test(text);
  if (credit === debit) return null;
  return credit ? 'credit' : 'debit';
}

function describe(text, bank) {
  const match = text.match(/\b(?:desc(?:ription)?|narr(?:ation)?|remarks?)\s*[:\-]\s*([^\n]{3,60})/i)
    || text.match(/\b(?:to|from|at)\s+([A-Z][^.,;\n]{2,40})/);
  // Account numbers don't belong in a description.
  const cleaned = match ? match[1].replace(/\d{6,}/g, '').replace(/\s+/g, ' ').trim() : '';
  return cleaned.slice(0, 60) || (bank ? `${bank} alert` : 'Bank alert');
}

// The balance the bank reports after this payment, such as "Avail Bal: NGN12,345.67".
// It's the one real balance FinSight sees, so it's kept to check the estimate against.
export function reportedBalance(text) {
  const match = String(text || '').match(new RegExp(`\\b(?:avail(?:able)?\\.?\\s*)?bal(?:ance)?\\.?\\s*(?:is)?\\s*[:\\-]?\\s*${CURRENCY}?\\s?(-?${NUMBER})`, 'i'));
  if (!match) return null;
  const value = toNumber(match[1]);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function bankFrom({ pkg, title }) {
  if (BANK_APPS[pkg]) return BANK_APPS[pkg];
  const sender = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const known = BANK_SENDERS.find(s => sender === s || (s.length >= 5 && sender.startsWith(s)));
  return known ? SMS_SENDERS[known] : null;
}

function formatDate(time) {
  const d = new Date(time);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// alert: { id, pkg, channel, title, text, postedAt }, as queued by the Android service.
export function parseBankAlert(alert) {
  const text = String(alert?.text || '');
  const combined = `${alert?.title || ''}\n${text}`;
  // Bank apps also send adverts, and some of them mention amounts.
  if (!text || NOT_A_TRANSACTION.test(combined) || noiseReason(combined)) return null;

  const labelled = labelledAmount(combined);
  const amount = labelled ? labelled.amount : firstOwnAmount(combined);
  if (!amount || amount < MIN_AMOUNT) return null;

  const type = (labelled && labelled.type) || directionFromWords(combined);
  if (!type) return null;

  const bank = bankFrom(alert);
  const cat = detectCategory(text);
  const balance = reportedBalance(combined);
  return {
    ...(balance !== null ? { balance } : null),
    id: `alert_${alert.id}`,
    desc: describe(text, bank),
    amount: Math.round(amount),
    type,
    cat: cat !== 'Other' ? cat : type === 'credit' ? 'Income' : /transfer|trf|\bsent\b/i.test(text) ? 'Transfer' : 'Other',
    bank,
    source: 'push',
    channel: alert.channel,
    capturedAt: alert.postedAt,
    date: formatDate(alert.postedAt),
  };
}
