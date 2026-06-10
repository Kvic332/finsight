// Use the legacy API — Expo SDK 54 moved FileSystem to a new class-based API
// but writeAsStringAsync / moveAsync / documentDirectory live in the legacy module.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

// ── CSV Export ────────────────────────────────────────────────────────────────
export async function exportCSV(transactions) {
  if (!transactions?.length) throw new Error('No transactions to export.');

  const header = 'Date,Description,Type,Category,Amount (₦),Source,Bank\n';
  const rows = transactions.map(tx => {
    const desc   = `"${(tx.desc || '').replace(/"/g, '""')}"`;
    const type   = tx.type === 'credit' ? 'Credit' : 'Debit';
    const cat    = tx.cat || 'Other';
    const amount = tx.amount?.toLocaleString() || '0';
    const source = tx.source === 'sms' ? 'SMS' : tx.source === 'push' ? 'Push' : 'Manual';
    const bank   = tx.bank || '';
    return `${tx.date},${desc},${type},${cat},${amount},${source},${bank}`;
  }).join('\n');

  const csv      = header + rows;
  const fileName = `FinSight_Transactions_${_dateStamp()}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csv, { encoding: 'utf8' });
  await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export Transactions CSV' });
}

// ── PDF Export ────────────────────────────────────────────────────────────────
export async function exportPDF(transactions, user) {
  if (!transactions?.length) throw new Error('No transactions to export.');

  const name     = user?.name || 'User';
  const today    = new Date().toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' });
  const totalDebit  = transactions.filter(t => t.type === 'debit').reduce((s,t) => s + (t.amount||0), 0);
  const totalCredit = transactions.filter(t => t.type === 'credit').reduce((s,t) => s + (t.amount||0), 0);
  const net         = totalCredit - totalDebit;

  const rows = transactions.map(tx => {
    const isCredit = tx.type === 'credit';
    const amtColor = isCredit ? '#84A816' : '#E54545';
    const sign     = isCredit ? '+' : '−';
    const source   = tx.source === 'sms' ? '📱 SMS' : tx.source === 'push' ? '🔔 Push' : '✍️ Manual';
    return `
      <tr>
        <td>${tx.date || ''}</td>
        <td>${_esc(tx.desc || '')}</td>
        <td style="color:${amtColor};font-weight:700">${sign}₦${(tx.amount||0).toLocaleString()}</td>
        <td>${tx.cat || 'Other'}</td>
        <td>${source}</td>
        <td>${tx.bank || '—'}</td>
      </tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #F5F3EE; color: #0E120F; padding: 32px; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .logo { font-size: 36px; font-weight: 900; font-style: italic; color: #B4DC2A; }
  .logo span { color: #0E120F; }
  .meta { text-align: right; font-size: 12px; color: #6B7069; line-height: 1.6; }
  .meta strong { color: #0E120F; font-size: 14px; }

  .summary { display: flex; gap: 16px; margin-bottom: 28px; }
  .sum-card { flex: 1; background: #FFFFFF; border-radius: 14px; padding: 18px; border: 1px solid #E2DED4; }
  .sum-label { font-size: 10px; letter-spacing: 2px; font-weight: 700; color: #6B7069; margin-bottom: 8px; }
  .sum-val { font-size: 22px; font-weight: 800; }
  .green { color: #84A816; } .red { color: #E54545; }
  .blue { color: #4F4FE0; }

  table { width: 100%; border-collapse: collapse; background: #FFFFFF; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  thead tr { background: #0E120F; }
  thead th { color: #B4DC2A; font-size: 10px; letter-spacing: 1.5px; font-weight: 700; padding: 13px 14px; text-align: left; }
  tbody tr { border-bottom: 1px solid #E2DED4; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: #F8F6F1; }
  td { font-size: 12px; padding: 11px 14px; color: #2B3127; vertical-align: middle; }

  .footer { margin-top: 28px; text-align: center; font-size: 11px; color: #989A91; }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">f<span>inSight</span></div>
    <div style="font-size:12px;color:#6B7069;margin-top:4px">Personal Finance OS</div>
  </div>
  <div class="meta">
    <strong>${_esc(name)}</strong><br/>
    Transaction Statement<br/>
    Generated: ${today}<br/>
    ${transactions.length} transactions
  </div>
</div>

<div class="summary">
  <div class="sum-card">
    <div class="sum-label">TOTAL CREDITS</div>
    <div class="sum-val green">+₦${totalCredit.toLocaleString()}</div>
  </div>
  <div class="sum-card">
    <div class="sum-label">TOTAL DEBITS</div>
    <div class="sum-val red">−₦${totalDebit.toLocaleString()}</div>
  </div>
  <div class="sum-card">
    <div class="sum-label">NET BALANCE</div>
    <div class="sum-val ${net >= 0 ? 'green' : 'red'}">${net >= 0 ? '+' : '−'}₦${Math.abs(net).toLocaleString()}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>DATE</th><th>DESCRIPTION</th><th>AMOUNT</th>
      <th>CATEGORY</th><th>SOURCE</th><th>BANK</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="footer">
  Generated by FinSight · All data stored locally on your device · ${today}
</div>

</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // Rename to a friendly filename
  const fileName = `FinSight_Statement_${_dateStamp()}.pdf`;
  const dest     = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: dest });

  await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Export Transactions PDF' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function _esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
