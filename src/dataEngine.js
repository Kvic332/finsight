// FinSight Data Engine
// Manages all user data, persists to localStorage, replaces all hardcoded values

const STORAGE_KEY = "finsight_user";
const TX_KEY = "finsight_transactions";

// ── Load / Save ──────────────────────────────────────────────────────────────

export function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveUser(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadTransactions() {
  try {
    const raw = localStorage.getItem(TX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveTransactions(txs) {
  localStorage.setItem(TX_KEY, JSON.stringify(txs));
}

export function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TX_KEY);
}

// ── Transaction Management ────────────────────────────────────────────────────

export function addTransaction(tx) {
  const txs = loadTransactions();
  const newTx = {
    id: Date.now() + Math.random(),
    ...tx,
    date: tx.date || new Date().toISOString().split("T")[0],
    source: tx.source || "manual",
    createdAt: new Date().toISOString(),
  };
  const updated = [newTx, ...txs];
  saveTransactions(updated);
  return updated;
}

export function deleteTransaction(id) {
  const txs = loadTransactions().filter(t => t.id !== id);
  saveTransactions(txs);
  return txs;
}

// ── Computed Stats ────────────────────────────────────────────────────────────

export function computeStats(user, transactions) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSpend = thisMonthTxs
    .filter(t => t.type === "debit" && t.cat !== "Savings")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSaved = thisMonthTxs
    .filter(t => t.cat === "Savings")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = thisMonthTxs
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  // Use declared income if no credit transactions yet
  const income = totalIncome > 0 ? totalIncome : parseInt(user.monthlyIncome || 0);

  // Balance = income - all debits this month (rough estimate without real bank sync)
  const balance = Math.max(0, income - totalSpend - totalSaved);

  // Days left calculation
  const dailyBurn = totalSpend / (now.getDate() || 1);
  const daysLeft = dailyBurn > 0 ? Math.floor(balance / dailyBurn) : 999;

  // Spending by category
  const categoryTotals = thisMonthTxs
    .filter(t => t.type === "debit")
    .reduce((acc, t) => {
      acc[t.cat] = (acc[t.cat] || 0) + t.amount;
      return acc;
    }, {});

  // Savings goals progress
  const savingsGoals = (user.savingsGoals || []).map(g => {
    const goalTxs = transactions.filter(t =>
      t.cat === "Savings" && t.goalName === g.name
    );
    const saved = goalTxs.reduce((sum, t) => sum + t.amount, 0);
    return { ...g, saved, target: parseInt(g.target || 0) };
  });

  // FinScore calculation
  const savingsRate = income > 0 ? (totalSaved / income) * 100 : 0;
  const spendRatio = income > 0 ? (totalSpend / income) * 100 : 100;
  const goalsProgress = savingsGoals.length > 0
    ? savingsGoals.reduce((sum, g) => sum + Math.min(100, g.target > 0 ? (g.saved / g.target) * 100 : 0), 0) / savingsGoals.length
    : 0;

  const finScore = Math.min(100, Math.round(
    (savingsRate >= 20 ? 30 : (savingsRate / 20) * 30) +
    (spendRatio <= 60 ? 30 : Math.max(0, (1 - (spendRatio - 60) / 40) * 30)) +
    (goalsProgress * 0.2) +
    (transactions.length > 10 ? 20 : (transactions.length / 10) * 20)
  ));

  // Spend trend (last 7 days)
  const spendTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    const spend = transactions
      .filter(t => t.date === dayStr && t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);
    return { day: dayLabel, spend };
  });

  // Balance projection (next 8 weeks)
  const balanceProjection = Array.from({ length: 8 }, (_, i) => {
    const weeks = i;
    const projected = Math.max(0, balance - (dailyBurn * 7 * weeks));
    const label = i === 0 ? "Now" : `Week ${i + 1}`;
    return { day: label, balance: Math.round(projected) };
  });

  return {
    balance,
    income,
    totalSpend,
    totalSaved,
    daysLeft: Math.min(daysLeft, 365),
    finScore,
    savingsRate: parseFloat(savingsRate.toFixed(1)),
    categoryTotals,
    savingsGoals,
    spendTrend,
    balanceProjection,
    thisMonthTxs,
  };
}

// ── SMS Parser ────────────────────────────────────────────────────────────────

export function parseSMS(smsText, userBanks = []) {
  const results = [];
  const lines = smsText.split("\n").filter(l => l.trim());

  for (const line of lines) {
    const tx = parseSingleSMS(line);
    if (tx) results.push(tx);
  }

  return results;
}

function parseSingleSMS(text) {
  const t = text.toLowerCase();

  // Amount patterns
  const amountPatterns = [
    /(?:ngn|₦|n)\s?([0-9,]+(?:\.[0-9]{2})?)/i,
    /([0-9,]+(?:\.[0-9]{2})?)\s?(?:ngn|naira)/i,
    /(?:amount|sum|of)\s+(?:ngn|₦|n)?\s?([0-9,]+(?:\.[0-9]{2})?)/i,
  ];

  let amount = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ""));
      break;
    }
  }

  if (!amount) return null;

  // Transaction type
  const isDebit = /debit|debited|charged|spent|purchase|payment|withdraw|sent|transfer out/i.test(text);
  const isCredit = /credit|credited|received|deposit|transfer in|salary|income/i.test(text);

  if (!isDebit && !isCredit) return null;
  const type = isDebit ? "debit" : "credit";

  // Merchant / description extraction
  const merchantPatterns = [
    /(?:at|@|from|to|with)\s+([A-Z][a-zA-Z\s&'-]{2,30}?)(?:\s+on|\s+for|\s+ref|\.|,|$)/i,
    /(?:purchase at|payment to|transfer to)\s+([A-Z][a-zA-Z\s&'-]{2,30}?)(?:\s+on|\s+for|\.|,|$)/i,
  ];

  let merchant = "Transaction";
  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match) { merchant = match[1].trim(); break; }
  }

  // Date extraction
  const datePatterns = [
    /(\d{2}[-/]\d{2}[-/]\d{4})/,
    /(\d{4}[-/]\d{2}[-/]\d{2})/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i,
  ];

  let date = new Date().toISOString().split("T")[0];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed)) date = parsed.toISOString().split("T")[0];
      } catch {}
      break;
    }
  }

  // Auto-categorize
  const cat = autoCategory(merchant + " " + text);

  // Bank detection
  const bank = detectBank(text);

  return {
    desc: merchant,
    amount,
    type,
    cat,
    date,
    source: "sms",
    bank,
    raw: text,
  };
}

export function autoCategory(text) {
  const t = text.toLowerCase();
  if (/food|eat|restaurant|pizza|chicken|suya|buka|cafe|coffee|burger|shawarma|grocery|shoprite|spar|market/i.test(t)) return "Food";
  if (/bolt|uber|taxify|ride|bus|transport|fuel|petrol|park|parking/i.test(t)) return "Transport";
  if (/netflix|dstv|gotv|startimes|spotify|gaming|cinema|movie|show|airtime|data/i.test(t)) return "Entertainment";
  if (/mtn|airtel|glo|9mobile|electricity|nepa|phcn|water|internet|dstv|gotv/i.test(t)) return "Utilities";
  if (/pharmacy|hospital|clinic|doctor|drug|health|medical|chemist/i.test(t)) return "Health";
  if (/rent|landlord|housing|property|agent/i.test(t)) return "Housing";
  if (/school|tuition|course|education|university|lesson/i.test(t)) return "Education";
  if (/salary|income|credit alert|payment received/i.test(t)) return "Income";
  if (/savings|save|piggyvest|cowrywise|investment/i.test(t)) return "Savings";
  if (/transfer|send|sent/i.test(t)) return "Transfer";
  return "Other";
}

export function detectBank(text) {
  const t = text.toLowerCase();
  if (/gtbank|guaranty|gtb/i.test(t)) return "GTBank";
  if (/access bank|accessbank/i.test(t)) return "Access Bank";
  if (/zenith/i.test(t)) return "Zenith Bank";
  if (/first bank|firstbank/i.test(t)) return "First Bank";
  if (/kuda/i.test(t)) return "Kuda";
  if (/opay/i.test(t)) return "OPay";
  if (/moniepoint/i.test(t)) return "Moniepoint";
  if (/palmpay/i.test(t)) return "PalmPay";
  if (/sterling/i.test(t)) return "Sterling Bank";
  if (/uba/i.test(t)) return "UBA";
  if (/fidelity/i.test(t)) return "Fidelity Bank";
  if (/fcmb/i.test(t)) return "FCMB";
  return "Unknown Bank";
}
