// Reads bank statement files (CSV or Excel) into transactions.
import * as XLSX from 'xlsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanAmount(str) {
  if (str === null || str === undefined || str === '') return 0;
  const num = parseFloat(String(str).replace(/[₦,\s]/g, ''));
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseDate(str) {
  if (!str) return new Date().toLocaleDateString('en-NG');
  const s = String(str).trim();

  // Excel serial date number (e.g. 45678)
  if (/^\d{5}$/.test(s)) {
    try {
      const d = XLSX.SSF.parse_date_code(parseInt(s));
      if (d) {
        const day = String(d.d).padStart(2, '0');
        const mon = String(d.m).padStart(2, '0');
        return `${day}/${mon}/${d.y}`;
      }
    } catch(e) {}
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const mon = m1[2].padStart(2, '0');
    const yr  = m1[3].length === 2 ? `20${m1[3]}` : m1[3];
    return `${day}/${mon}/${yr}`;
  }

  // YYYY-MM-DD (ISO)
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;

  // DD Mon YYYY  e.g. "16 Apr 2026"
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const m3 = s.toLowerCase().match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/);
  if (m3) {
    const day = m3[1].padStart(2, '0');
    const mon = String(months[m3[2]] || 1).padStart(2, '0');
    return `${day}/${mon}/${m3[3]}`;
  }

  return new Date().toLocaleDateString('en-NG');
}

function detectCategory(desc) {
  const d = String(desc).toLowerCase();
  if (/food|eat|restaurant|shoprite|grocery|market|chicken|pizza|cafe/i.test(d))           return 'Food';
  if (/uber|bolt|transport|fuel|petrol|bus|ride|taxi/i.test(d))                            return 'Transport';
  if (/netflix|spotify|dstv|showmax|cinema|gaming|apple|google play/i.test(d))             return 'Entertainment';
  if (/electricity|nepa|ikedc|ekedc|water|airtime|data|mtn|glo|airtel|9mobile/i.test(d))  return 'Utilities';
  if (/hospital|pharmacy|health|doctor|clinic|medic/i.test(d))                            return 'Health';
  if (/savings|cowrywise|piggyvest|piggy|save/i.test(d))                                  return 'Savings';
  if (/salary|payroll|wages/i.test(d))                                                     return 'Income';
  if (/transfer|trf|sent|payment/i.test(d))                                                return 'Transfer';
  return 'Other';
}

// ── Find the real header row (skip bank metadata at top) ─────────────────────
function findHeaderRowIndex(rows) {
  const keywords = ['date','credit','debit','amount','narration','description','balance','particulars'];
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    const cells = rows[i].map(c => String(c ?? '').toLowerCase().replace(/[^a-z]/g, ''));
    const hits  = keywords.filter(kw => cells.some(c => c.includes(kw)));
    if (hits.length >= 2) return i; // found a row with at least 2 known column names
  }
  return 0; // fallback
}

// ── Core parser — works on array-of-arrays (rows) ─────────────────────────────
export function parseRows(rows) {
  if (!rows || rows.length < 2) return [];

  // Find the real header row (skips metadata lines at the top of bank exports)
  const headerIdx = findHeaderRowIndex(rows);

  // Normalise header row: lowercase, strip non-alpha chars
  const rawHeader = rows[headerIdx].map(h => String(h ?? '').toLowerCase().replace(/[^a-z]/g, ''));

  const col = (...names) => {
    for (const n of names) {
      const idx = rawHeader.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx   = col('date','valuedate','txdate','transdate','bookingdate','postingdate');
  const descIdx   = col('description','narration','details','particulars','remarks','ref','beneficiary','memo');
  const debitIdx  = col('debit','withdrawal','dr','withdraw');
  const creditIdx = col('credit','deposit','cr','lodgement');
  const amtIdx    = col('amount','transactionamount','value','transamt');
  const typeIdx   = col('type','txtype','transtype','drorcr','drcr','drcrflag','crdr');

  const transactions = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols = rows[i].map(c => String(c ?? '').trim());
    if (cols.every(c => !c)) continue; // skip blank rows

    const dateStr = dateIdx  >= 0 ? cols[dateIdx]  : '';
    const desc    = descIdx  >= 0 ? cols[descIdx]  : (cols.find(c => c.length > 5) || 'Bank Transaction');
    let debit     = debitIdx >= 0 ? cleanAmount(cols[debitIdx])  : 0;
    let credit    = creditIdx >= 0 ? cleanAmount(cols[creditIdx]) : 0;
    const typeStr = typeIdx  >= 0 ? (cols[typeIdx] || '').toLowerCase() : '';

    // Single amount column — use type col to decide direction
    if (debit === 0 && credit === 0 && amtIdx >= 0) {
      const amt = cleanAmount(cols[amtIdx]);
      if      (typeStr.includes('dr') || typeStr.includes('debit'))   debit  = amt;
      else if (typeStr.includes('cr') || typeStr.includes('credit'))  credit = amt;
      else                                                             debit  = amt;
    }

    const amount = debit > 0 ? debit : credit;
    if (amount < 10) continue;

    const type = credit > 0 && debit === 0 ? 'credit' : 'debit';
    const cat  = detectCategory(desc);

    transactions.push({
      id:        `import_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
      desc:      desc.slice(0, 60).trim() || 'Bank Transaction',
      amount:    Math.round(amount),
      type,
      cat:       type === 'credit' && cat === 'Other' ? 'Income' : cat,
      bank:      '',
      source:    'import',
      date:      parseDate(dateStr),
      timestamp: Date.now(),
    });
  }

  return transactions;
}

// ── CSV → rows ────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"')                   { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else                                   { current += line[i]; }
  }
  result.push(current.trim());
  return result;
}

export function csvToRows(content) {
  return content.split(/\r?\n/).filter(l => l.trim()).map(l => parseCSVLine(l));
}

// ── XLSX/XLS → rows via SheetJS ───────────────────────────────────────────────
export function xlsxToRows(base64Content) {
  const workbook = XLSX.read(base64Content, { type: 'base64', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}
