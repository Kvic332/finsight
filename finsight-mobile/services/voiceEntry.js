// ── Spoken transactions ───────────────────────────────────────────────────────
// Turns what someone says, such as "5,000 for laptop under shopping", into a
// category, amount and description. Pure functions only, so they can be tested.

// Words people say for each category. The category's own name always counts.
const CATEGORY_WORDS = {
  Food: ['groceries', 'grocery', 'lunch', 'dinner', 'breakfast', 'restaurant', 'market', 'eating'],
  Transport: ['taxi', 'bus', 'uber', 'bolt', 'fuel', 'petrol', 'okada', 'keke', 'fare', 'transportation'],
  Utilities: ['utility', 'electricity', 'light bill', 'nepa', 'water bill', 'data', 'airtime', 'internet', 'bills'],
  Shopping: ['shop', 'clothes', 'shoes', 'laptop', 'gadget', 'jumia', 'konga'],
  Entertainment: ['movie', 'movies', 'cinema', 'netflix', 'showmax', 'dstv', 'fun', 'outing'],
  Health: ['hospital', 'drugs', 'medicine', 'pharmacy', 'doctor', 'clinic'],
  Savings: ['save', 'saving', 'piggyvest', 'cowrywise'],
  Income: ['salary', 'pay', 'wages', 'payment received'],
  Other: ['others', 'miscellaneous', 'misc'],
};

// Words that introduce a category, such as "under transport" or "category food".
const CATEGORY_LEAD = '(?:under|in|into|as|category|categorise(?: it)?(?: as)?|put (?:it )?(?:in|under))';
const FILLER = /\b(?:i|we|just|spent|spend|paid|pay for|bought|buy|naira|for|on|the|a|an|it|was|is|of|to)\b/g;

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordPattern = word => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');

// "5000", "5,000", "₦5000", "5k", "2.5 million", "5 thousand"
const AMOUNT = /(?:₦|n(?=\d))?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m|million)?\b/i;

export function spokenAmount(text) {
  const match = String(text || '').match(AMOUNT);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  const scale = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 }[(match[2] || '').toLowerCase()] || 1;
  const amount = Math.round(value * scale);
  return amount > 0 ? { amount, text: match[0] } : null;
}

// The category someone named. A category said after "under", "in" or "category"
// wins over one that only appears in the description, so "laptop under other"
// is Other, not Shopping.
export function spokenCategory(text, allowed) {
  const said = String(text || '');
  const options = allowed.map(cat => ({ cat, words: [cat.toLowerCase(), ...(CATEGORY_WORDS[cat] || [])] }));
  for (const { cat, words } of options) {
    for (const word of words) {
      const led = new RegExp(`\\b${CATEGORY_LEAD}\\s+${escapeRegExp(word)}\\b`, 'i').exec(said);
      if (led) return { cat, text: led[0] };
    }
  }
  for (const { cat } of options) {
    const named = wordPattern(cat.toLowerCase()).exec(said);
    if (named) return { cat, text: named[0] };
  }
  for (const { cat, words } of options) {
    for (const word of words.slice(1)) {
      // Matched from the description, so the words stay in it.
      if (wordPattern(word).test(said)) return { cat, text: '' };
    }
  }
  return null;
}

export function parseSpokenTransaction(text, allowed) {
  const said = String(text || '').trim();
  const amount = spokenAmount(said);
  const category = spokenCategory(said, allowed);
  let rest = said;
  if (amount) rest = rest.replace(amount.text, ' ');
  if (category?.text) rest = rest.replace(category.text, ' ');
  rest = rest.toLowerCase().replace(FILLER, ' ').replace(/[^a-z0-9'&-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    cat: category?.cat || null,
    amount: amount?.amount || null,
    desc: rest ? rest[0].toUpperCase() + rest.slice(1) : '',
  };
}
