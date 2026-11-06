// Reads bank alert SMS text into transactions.
import { noiseReason } from './transactionReview.js';

const BANKS = {
  'access': 'Access Bank', 'zenith': 'Zenith Bank', 'gtb': 'GTBank', 'gtbank': 'GTBank',
  'first bank': 'First Bank', 'firstbank': 'First Bank', 'uba': 'UBA',
  'fidelity': 'Fidelity Bank', 'sterling': 'Sterling Bank', 'kuda': 'Kuda Bank',
  'opay': 'OPay', 'palmpay': 'PalmPay', 'moniepoint': 'Moniepoint',
  'carbon': 'Carbon', 'wema': 'Wema Bank', 'stanbic': 'Stanbic IBTC',
  'polaris': 'Polaris Bank', 'union bank': 'Union Bank',
};

function detectBank(text) {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(BANKS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

// ── Only process genuine bank transaction SMS ─────────────────────────────────
function isBankTransaction(text) {
  // Must mention a known bank OR have bank-specific structural patterns
  const hasBankName = detectBank(text) !== null;
  const hasBankPattern = /\b(acct|a\/c|account\s*no|avail(?:able)?\s*bal|new\s*bal|bal[:\s]|trf|ref\s*no|trans(?:action)?\s*id|DR[:\s]|CR[:\s])\b/i.test(text);
  return hasBankName || hasBankPattern;
}

export function detectCategory(text) {
  const lower = text.toLowerCase();
  if (lower.includes('shoprite') || lower.includes('grocery') || lower.includes('market') || lower.includes('food') || lower.includes('eat')) return 'Food';
  if (lower.includes('uber') || lower.includes('bolt') || lower.includes('transport') || lower.includes('fuel') || lower.includes('petrol')) return 'Transport';
  if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('dstv') || lower.includes('showmax')) return 'Entertainment';
  if (lower.includes('electricity') || lower.includes('water') || lower.includes('nepa') || lower.includes('ikedc') || lower.includes('ekedc')) return 'Utilities';
  if (lower.includes('hospital') || lower.includes('pharmacy') || lower.includes('health') || lower.includes('doctor')) return 'Health';
  if (/\b(shopping|jumia|konga|laptop|clothes|shoes?)\b/.test(lower)) return 'Shopping';
  if (lower.includes('savings') || lower.includes('cowrywise') || lower.includes('piggyvest') || lower.includes('piggy')) return 'Savings';
  if (lower.includes('salary') || lower.includes('credit alert') || lower.includes('payment received')) return 'Income';
  return 'Other';
}

export function parseSMS(text) {
  const results = [];
  // Split by blank line OR by common SMS separators
  const blocks = text
    .split(/\n\s*\n/)
    .flatMap(b => b.includes('Acct:') && b.split('Acct:').length > 2
      ? b.split('Acct:').filter(s => s.trim()).map(s => 'Acct:' + s)
      : [b])
    .filter(b => b.trim().length > 10);

  for (const block of blocks) {
    // ── Skip non-bank noise (Jumia, subscriptions, OTPs, promotions) ──────────
    if (!isBankTransaction(block)) continue;
    // Adverts, failed payments and balance warnings mention amounts but move no money.
    if (noiseReason(block)) continue;

    let amount = 0;
    let type = 'debit';
    let desc = '';

    // ── Structured format: CR:N100.00 / DR:N50,000 (Fidelity, GTBank SMS) ─────
    const crMatch = block.match(/\bCR[:\s]+N?\s*([\d,]+(?:\.\d{2})?)/i);
    const drMatch = block.match(/\bDR[:\s]+N?\s*([\d,]+(?:\.\d{2})?)/i);

    if (crMatch) {
      amount = parseInt(crMatch[1].replace(/,/g, ''));
      type = 'credit';
    } else if (drMatch) {
      amount = parseInt(drMatch[1].replace(/,/g, ''));
      type = 'debit';
    }

    // ── Description from Desc: field (Fidelity) ───────────────────────────────
    const descStructured = block.match(/\bDesc[:\s]+([^\n]+)/i);
    if (descStructured) desc = descStructured[1].trim().slice(0, 60);

    // ── Natural language patterns if structured didn't find amount ─────────────
    if (amount < 10) {
      const nlPatterns = [
        { re: /(?:debited?|withdrawn?|charged?|deducted)[^\dN₦]*[N₦]?\s*([\d,]+(?:\.\d{2})?)/i, type: 'debit' },
        { re: /(?:credited?|received?|funded)[^\dN₦]*[N₦]?\s*([\d,]+(?:\.\d{2})?)/i, type: 'credit' },
        { re: /[N₦]\s*([\d,]+(?:\.\d{2})?)/i, type: null },
        { re: /(?:amount|sum)[:\s]+([\d,]+(?:\.\d{2})?)/i, type: null },
        { re: /NGN\s*([\d,]+(?:\.\d{2})?)/i, type: null },
      ];

      for (const { re, type: t } of nlPatterns) {
        const m = block.match(re);
        if (m) {
          amount = parseInt(m[1].replace(/,/g, ''));
          if (t) type = t;
          break;
        }
      }

      // Override type from context keywords
      // Credit = money coming IN to your account
      if (/credit(?:ed)?|received|incoming|funded|salary|refund|topup|cashback|lodgement|inflow|deposit|interest (?:earned|paid)|earned interest/i.test(block)) type = 'credit';
      // Debit = money going OUT of your account (including transfers you initiate)
      if (/debit(?:ed)?|withdrawn?|charged?|deducted|payment of|via pos|atm|\bsent\b|transfer(?:red)? to|trf to|send|transfer out/i.test(block)) type = 'debit';
    }

    if (amount < 10) continue;

    // ── Description fallback ───────────────────────────────────────────────────
    if (!desc) {
      const descMatch = block.match(/(?:at|from|to|for|narr?(?:ation)?)[:\s]+([^.\n,]+)/i)
        || block.match(/(?:ref|description)[:\s]+([^.\n,]+)/i);
      desc = descMatch
        ? descMatch[1].trim().slice(0, 60)
        : block.split('\n')[0].trim().slice(0, 60);
    }

    // ── Date from DT: field (Fidelity: DT:15/MAY/26) ─────────────────────────
    let date = new Date().toLocaleDateString('en-NG');
    const dtMatch = block.match(/\bDT[:\s]+(\d+)\/(\w+)\/(\d+)/i);
    if (dtMatch) {
      const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
      try {
        const yr = parseInt(dtMatch[3]) + (parseInt(dtMatch[3]) < 100 ? 2000 : 0);
        const mo = months[dtMatch[2].toUpperCase()];
        if (mo !== undefined) {
          date = new Date(yr, mo, parseInt(dtMatch[1])).toLocaleDateString('en-NG');
        }
      } catch (_) {}
    }

    results.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      desc: desc || 'SMS Transaction',
      amount,
      type,
      cat: detectCategory(block),
      bank: detectBank(block),
      source: 'sms',
      date,
      raw: block.trim(),
    });
  }

  return results;
}
