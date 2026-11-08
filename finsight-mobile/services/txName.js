// A readable name for a transaction, made from the raw text banks send.
// Only used for showing; the saved description is never changed, so search,
// remembered categories and exports keep working with the original text.

const SMALL_WORDS = new Set(['to', 'from', 'at', 'of', 'and', 'for', 'via', 'in', 'on', 'the']);
const KEEP_UPPER = new Set(['POS', 'ATM', 'NIP', 'USSD', 'MTN', 'GLO', 'UBA', 'GTB', 'FCMB', 'DSTV', 'NEPA', 'IKEDC', 'EKEDC', 'AEDC', 'LCC', 'NHIS', 'VAT', 'NGN', 'USD']);

function isShouting(text) {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  return upper / letters.length > 0.7;
}

function titleCase(text) {
  return text.split(' ').map((word, i) => {
    if (!word) return word;
    const bare = word.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (KEEP_UPPER.has(bare)) return word.toUpperCase();
    const lower = word.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

export function transactionName(tx) {
  const raw = String(tx?.desc || '').trim();
  const bank = tx?.bank || '';
  const incoming = tx?.type === 'credit';

  // The parser's fallback when the alert gave no details.
  const generic = raw.match(/^(.*?)\s*alert$/i);
  if (!raw || generic) {
    const source = (generic && generic[1].trim()) || bank;
    if (!source || /^bank$/i.test(source)) return incoming ? 'Money in' : 'Payment';
    return incoming ? `Money in via ${source}` : `${source} payment`;
  }

  let text = raw
    .replace(/\*+\s?\d+/g, ' ')           // masked account numbers, **9163
    .replace(/\b\d{6,}\b/g, ' ')          // long reference numbers
    .replace(/\s+-\s+.*$/, '')            // " - PALMPAY..." and other trailing bank names
    .replace(/(\.{3}|…)$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // "ONB TRF TO VICTOR K", "NIP TRANSFER FROM ADA", "FT TO ..."
  const transfer = text.match(/^(?:[A-Z]{2,5}\s+)?(?:NIP\s+)?(?:TRF|TRSF|TRANSFER|FT)\s+(TO|FRM|FROM)\s+(.+)$/i);
  if (transfer) {
    const who = isShouting(transfer[2]) ? titleCase(transfer[2]) : transfer[2];
    return `Transfer ${/^to$/i.test(transfer[1]) ? 'to' : 'from'} ${who}`.trim();
  }

  // "POS PURCHASE AT SHOPRITE LEKKI", "WEB PAYMENT @ JUMIA"
  const card = text.match(/^(?:POS|WEB|CARD)\s*(?:PURCHASE|PAYMENT|PMT|TXN|TRANSACTION)?\s*(?:AT|@)?\s+(.+)$/i);
  if (card) text = card[1];

  if (!text) return raw;
  return isShouting(text) ? titleCase(text) : text;
}
