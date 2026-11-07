// ── Foreign currency ──────────────────────────────────────────────────────────
// Naira stays the home currency: every figure in FinSight adds up in naira. A
// foreign amount keeps its own value and the rate used, and counts at the naira
// value worked out on the day, so history doesn't change when the rate moves.
// Pure functions only, so they can be unit tested.

export const NAIRA = 'NGN';
export const CURRENCIES = {
  NGN: { symbol: '₦', name: 'Naira', plural: 'naira' },
  USD: { symbol: '$', name: 'US dollar', plural: 'US dollars' },
  GBP: { symbol: '£', name: 'British pound', plural: 'British pounds' },
  EUR: { symbol: '€', name: 'Euro', plural: 'euros' },
  CAD: { symbol: 'CA$', name: 'Canadian dollar', plural: 'Canadian dollars' },
};
export const FOREIGN_CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD'];

export const isForeign = currency => FOREIGN_CURRENCIES.includes(currency);

// Same checks as the server: a rate outside this range is a bad reading.
const NGN_MIN = 100;
const NGN_MAX = 20000;

// Naira per unit from rates quoted per 1 US dollar, as open.er-api.com gives them.
// Used when the app has to fetch rates itself.
export function nairaRatesFromUsd(perUsd) {
  const ngn = Number(perUsd?.NGN);
  const rates = {};
  for (const currency of FOREIGN_CURRENCIES) {
    const units = currency === 'USD' ? 1 : Number(perUsd?.[currency]);
    if (!(ngn > 0) || !(units > 0)) continue;
    const rate = Math.round((ngn / units) * 100) / 100;
    if (rate >= NGN_MIN && rate <= NGN_MAX) rates[currency] = rate;
  }
  return rates;
}

// The rate to use: your own if you've set one, otherwise the market rate.
// market: { USD: 1348.02, ... }. own: the same shape, from Settings.
export function rateFor(currency, market, own) {
  if (!currency || currency === NAIRA) return { rate: 1, source: 'naira' };
  const mine = Number(own?.[currency]);
  if (mine > 0) return { rate: mine, source: 'own' };
  const theirs = Number(market?.[currency]);
  if (theirs > 0) return { rate: theirs, source: 'market' };
  return null;
}

export function toNaira(amount, currency, market, own) {
  const found = rateFor(currency, market, own);
  if (!found || !(amount >= 0)) return null;
  return { naira: Math.round(amount * found.rate), ...found };
}

const group = digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// "$1,250" or "$12.50": cents are shown only when there are some.
export function formatForeign(amount, currency) {
  if (!Number.isFinite(amount)) return '—';
  const symbol = CURRENCIES[currency]?.symbol || `${currency} `;
  const abs = Math.abs(amount);
  const fixed = Number.isInteger(Math.round(abs * 100) / 100) ? String(Math.round(abs)) : abs.toFixed(2);
  const [whole, cents] = fixed.split('.');
  return `${amount < 0 ? '−' : ''}${symbol}${group(whole)}${cents ? `.${cents}` : ''}`;
}

export const formatRate = rate => `₦${group(String(Math.round(rate)))}`;

// What a foreign transaction shows under its naira value: "$1,000 at ₦1,348".
export function foreignNote(tx) {
  if (!tx || !isForeign(tx.currency) || !(tx.originalAmount >= 0)) return null;
  return `${formatForeign(tx.originalAmount, tx.currency)} at ${formatRate(tx.fxRate)}`;
}

// The fields a foreign transaction carries. amount stays the naira value, so
// every total keeps working unchanged.
export function foreignFields(originalAmount, currency, market, own) {
  if (!isForeign(currency)) return null;
  const converted = toNaira(originalAmount, currency, market, own);
  if (!converted) return null;
  return { amount: converted.naira, currency, originalAmount, fxRate: converted.rate, fxSource: converted.source };
}

// The monthly income in naira. Someone paid in dollars sets the dollar amount;
// its naira value follows the current rate.
export function nairaIncome(user, market) {
  const currency = user?.incomeCurrency;
  const foreign = Number(user?.incomeForeign);
  if (isForeign(currency) && foreign > 0) {
    const converted = toNaira(foreign, currency, market, user?.fxOwnRates);
    if (converted) return converted.naira;
  }
  return Number(user?.income) || 0;
}

// ── Wallets ───────────────────────────────────────────────────────────────────
// Money held in another currency, such as dollars in Grey or a domiciliary account.
// wallet: { id, name, currency, opening, conversions: [{ id, amount, rate, naira, date }] }
// Transactions linked by walletId move the balance: money in adds, money out takes away.
// Converting to naira only moves money between your own accounts, so it isn't
// income or spending; it just lowers the wallet.

const sum = list => list.reduce((s, n) => s + n, 0);

export function walletBalance(wallet, transactions = []) {
  const linked = transactions.filter(t => t.walletId === wallet.id && t.originalAmount >= 0);
  const moved = sum(linked.map(t => (t.type === 'credit' ? t.originalAmount : -t.originalAmount)));
  const converted = sum((wallet.conversions || []).map(c => c.amount));
  return Math.round(((Number(wallet.opening) || 0) + moved - converted) * 100) / 100;
}

// "My Grey balance is really $812": the opening amount is moved so the balance matches.
export function setWalletBalance(wallet, target, transactions = []) {
  const now = walletBalance(wallet, transactions);
  return { ...wallet, opening: Math.round(((Number(wallet.opening) || 0) + (target - now)) * 100) / 100 };
}

export function convertFromWallet(wallet, amount, rate, transactions = [], date = new Date()) {
  const balance = walletBalance(wallet, transactions);
  if (!(amount > 0)) return { error: 'Enter an amount, like 100' };
  if (amount > balance) return { error: `You have ${formatForeign(balance, wallet.currency)} in ${wallet.name}` };
  if (!(rate > 0)) return { error: 'Enter the rate you got, like 1,550' };
  const conversion = { id: `cv_${date.getTime()}`, amount, rate, naira: Math.round(amount * rate), date: date.toISOString() };
  return { wallet: { ...wallet, conversions: [...(wallet.conversions || []), conversion] }, conversion };
}

export function walletsInNaira(wallets, transactions, market, own) {
  return sum(wallets.map(w => toNaira(walletBalance(w, transactions), w.currency, market, own)?.naira || 0));
}

// The wallet an alert from this bank and currency belongs to, if there's one.
export function walletFor(wallets, bank, currency) {
  const same = wallets.filter(w => w.currency === currency);
  if (!same.length) return null;
  const named = bank ? same.find(w => w.name.toLowerCase().includes(bank.toLowerCase()) || bank.toLowerCase().includes(w.name.toLowerCase())) : null;
  // A different bank's alert must never move this wallet, so a guess is made only
  // when the bank isn't known and there's just one wallet in that currency.
  return named || (!bank && same.length === 1 ? same[0] : null);
}
