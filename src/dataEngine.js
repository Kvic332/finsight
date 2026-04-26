// FinSight Data Engine
// Manages all user data, persists to localStorage, replaces all hardcoded values

const STORAGE_KEY = "finsight_user";
const TX_KEY = "finsight_transactions";

// ── Load / Save ──────────────────────────────────────────────────────────────

export function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { /* ignore */ return null; }
}

export function saveUser(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadTransactions() {
  try {
    const raw = localStorage.getItem(TX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { /* ignore */ return []; }
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

  const income = totalIncome > 0 ? totalIncome : parseInt(user.monthlyIncome || 0);
  const balance = Math.max(0, income - totalSpend - totalSaved);
  const dailyBurn = totalSpend / (now.getDate() || 1);
  const daysLeft = dailyBurn > 0 ? Math.floor(balance / dailyBurn) : 999;

  const categoryTotals = thisMonthTxs
    .filter(t => t.type === "debit")
    .reduce((acc, t) => {
      acc[t.cat] = (acc[t.cat] || 0) + t.amount;
      return acc;
    }, {});

  const savingsGoals = (user.savingsGoals || []).map(g => {
    const goalTxs = transactions.filter(t =>
      t.cat === "Savings" && t.goalName === g.name
    );
    const saved = goalTxs.reduce((sum, t) => sum + t.amount, 0);
    return { ...g, saved, target: parseInt(g.target || 0) };
  });

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

  const balanceProjection = Array.from({ length: 8 }, (_, i) => {
    const projected = Math.max(0, balance - (dailyBurn * 7 * i));
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

export function parseSMS(smsText) {
  const results = [];

  // Try parsing the full text as one SMS first (handles multi-line SMS)
  const fullTx = parseSingleSMS(smsText);
  if (fullTx) {
    results.push(fullTx);
    return results;
  }

  // If full text fails, try line by line
  const lines = smsText.split("\n").filter(l => l.trim());
  for (const line of lines) {
    const tx = parseSingleSMS(line);
    if (tx) results.push(tx);
  }

  return results;
}

function parseSingleSMS(text) {
  // Amount patterns — covers all Nigerian bank formats
  const amountPatterns = [
    /DR[:\s]+N([0-9,]+(?:\.[0-9]{2})?)/i,           // Fidelity: DR:N5,000.00
    /CR[:\s]+N([0-9,]+(?:\.[0-9]{2})?)/i,           // Fidelity: CR:N5,000.00
    /debited[^0-9]*([0-9,]+(?:\.[0-9]{2})?)/i,      // GTBank: debited N12,400.00
    /credited[^0-9]*([0-9,]+(?:\.[0-9]{2})?)/i,     // Kuda: credited NGN450,000
    /amount[:\s]+(?:ngn|₦|n)?([0-9,]+(?:\.[0-9]{2})?)/i,
    /(?:ngn|₦)\s?([0-9,]+(?:\.[0-9]{2})?)/i,
    /\bn([0-9,]+(?:\.[0-9]{2})?)\b/i,               // N5,000.00
    /([0-9,]+(?:\.[0-9]{2})?)\s?naira/i,
  ];

  let amount = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (val > 0) { amount = val; break; }
    }
  }

  if (!amount) return null;

  // Transaction type detection
  const isDebit = /debit|debited|DR:|dr\s|withdrawal|charged|purchase|payment|withdraw|sent|transfer out|pos|web|atm/i.test(text);
  const isCredit = /credit|credited|CR:|received|deposit|transfer in|salary|income|lodgement|inflow/i.test(text);

  if (!isDebit && !isCredit) return null;

  // If both detected, debit takes priority (most bank SMS lead with debit)
  const type = isDebit ? "debit" : "credit";

  // Description extraction — try Desc: pattern first (Fidelity, GTBank)
  let merchant = "Transaction";
  const descMatch = text.match(/desc[:\s]+([^\n\r]+?)(?:\s+dt[:\s]|\s+bal[:\s]|\s+ref|$)/i);
  if (descMatch) {
    merchant = descMatch[1].trim().substring(0, 50);
  } else {
    const merchantPatterns = [
      /(?:at|@)\s+([A-Z][a-zA-Z\s&'.-]{2,30}?)(?:\s+on|\s+ref|\.|,|$)/i,
      /(?:narration|desc|description)[:\s]+([^\n\r,]+)/i,
      /(?:purchase at|payment to|transfer to|trf to)\s+([A-Za-z\s&'.-]{2,30}?)(?:\s+on|\.|,|$)/i,
    ];
    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match) { merchant = match[1].trim().substring(0, 50); break; }
    }
  }

  // Date extraction — handles DD/MMM/YY, DD-MM-YYYY, YYYY-MM-DD
  const datePatterns = [
    /(\d{2}\/[A-Z]{3}\/\d{2,4})/i,                 // 26/APR/26
    /(\d{2}[-/]\d{2}[-/]\d{4})/,                    // 26-04-2026
    /(\d{4}[-/]\d{2}[-/]\d{2})/,                    // 2026-04-26
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i,
  ];

  let date = new Date().toISOString().split("T")[0];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed)) date = parsed.toISOString().split("T")[0];
      } catch { /* ignore */ }
      break;
    }
  }

  const cat = autoCategory(merchant + " " + text);
  const bank = detectBank(text);

  return { desc: merchant, amount, type, cat, date, source: "sms", bank, raw: text };
}

export function autoCategory(text) {
  const t = text.toLowerCase();
  if (/food|eat|restaurant|pizza|chicken|suya|buka|cafe|coffee|burger|shawarma|grocery|shoprite|spar|market|eatright|dominos|kilimanjaro|mr biggs|tantalizers/i.test(t)) return "Food";
  if (/bolt|uber|taxify|ride|bus|transport|fuel|petrol|park|parking|okada|keke|danfo/i.test(t)) return "Transport";
  if (/netflix|dstv|gotv|startimes|spotify|gaming|cinema|movie|show|airtime|data|canal/i.test(t)) return "Entertainment";
  if (/mtn|airtel|glo|9mobile|electricity|nepa|phcn|water|internet|ikedc|ekedc|ibedc|phed|bedc/i.test(t)) return "Utilities";
  if (/pharmacy|hospital|clinic|doctor|drug|health|medical|chemist|laboratory|lab/i.test(t)) return "Health";
  if (/rent|landlord|housing|property|agent|estate/i.test(t)) return "Housing";
  if (/school|tuition|course|education|university|lesson|training|certification/i.test(t)) return "Education";
  if (/salary|income|credit alert|payment received|payroll/i.test(t)) return "Income";
  if (/savings|save|piggyvest|cowrywise|investment|fixed deposit/i.test(t)) return "Savings";
  if (/transfer|trf|send|sent|wire/i.test(t)) return "Transfer";
  if (/shopping|mall|store|supermarket|jumia|konga|slot/i.test(t)) return "Shopping";
  return "Other";
}

export function detectBank(text) {
  const t = text.toLowerCase();

  // Tier 1 Commercial Banks
  if (/gtbank|guaranty trust|gtb|gt bank/i.test(t)) return "GTBank";
  if (/access bank|accessbank|access diamond/i.test(t)) return "Access Bank";
  if (/zenith bank|zenith/i.test(t)) return "Zenith Bank";
  if (/first bank|firstbank|fbn/i.test(t)) return "First Bank";
  if (/uba|united bank for africa/i.test(t)) return "UBA";
  if (/fidelity bank|fidelity/i.test(t)) return "Fidelity Bank";
  if (/fcmb|first city monument/i.test(t)) return "FCMB";
  if (/sterling bank|sterling/i.test(t)) return "Sterling Bank";
  if (/union bank|unionbank/i.test(t)) return "Union Bank";
  if (/ecobank/i.test(t)) return "Ecobank";
  if (/stanbic ibtc|stanbic/i.test(t)) return "Stanbic IBTC";
  if (/standard chartered/i.test(t)) return "Standard Chartered";
  if (/citibank|citi bank/i.test(t)) return "Citibank";
  if (/heritage bank|heritage/i.test(t)) return "Heritage Bank";
  if (/keystone bank|keystone/i.test(t)) return "Keystone Bank";
  if (/polaris bank|polaris/i.test(t)) return "Polaris Bank";
  if (/wema bank|wema/i.test(t)) return "Wema Bank";
  if (/unity bank|unity/i.test(t)) return "Unity Bank";
  if (/jaiz bank|jaiz/i.test(t)) return "Jaiz Bank";
  if (/globus bank|globus/i.test(t)) return "Globus Bank";
  if (/titan trust|titan/i.test(t)) return "Titan Trust Bank";
  if (/parallex bank|parallex/i.test(t)) return "Parallex Bank";
  if (/optimus bank|optimus/i.test(t)) return "Optimus Bank";
  if (/signature bank/i.test(t)) return "Signature Bank";
  if (/coronation bank|coronation/i.test(t)) return "Coronation Bank";
  if (/providus bank|providus/i.test(t)) return "Providus Bank";
  if (/rand merchant|rmbr/i.test(t)) return "Rand Merchant Bank";
  if (/nova bank|nova/i.test(t)) return "Nova Bank";
  if (/suntrust bank|suntrust/i.test(t)) return "Suntrust Bank";

  // Fintechs & Digital Banks
  if (/kuda/i.test(t)) return "Kuda";
  if (/opay|o-pay/i.test(t)) return "OPay";
  if (/moniepoint|monie point/i.test(t)) return "Moniepoint";
  if (/palmpay|palm pay/i.test(t)) return "PalmPay";
  if (/carbon|one finance/i.test(t)) return "Carbon";
  if (/fairmoney|fair money/i.test(t)) return "FairMoney";
  if (/vfd bank|vfd/i.test(t)) return "VFD Bank";
  if (/mint finex|mint/i.test(t)) return "Mint Finex";
  if (/rubies bank|rubies/i.test(t)) return "Rubies Bank";
  if (/sparkle/i.test(t)) return "Sparkle";
  if (/piggyvest|piggy vest/i.test(t)) return "PiggyVest";
  if (/cowrywise/i.test(t)) return "Cowrywise";
  if (/risevest|rise vest/i.test(t)) return "Risevest";
  if (/bamboo/i.test(t)) return "Bamboo";
  if (/chaka/i.test(t)) return "Chaka";
  if (/trove/i.test(t)) return "Trove";
  if (/chipper cash|chipper/i.test(t)) return "Chipper Cash";
  if (/flutterwave/i.test(t)) return "Flutterwave";
  if (/paystack/i.test(t)) return "Paystack";
  if (/paga/i.test(t)) return "Paga";
  if (/eyowo/i.test(t)) return "Eyowo";
  if (/nomba|kudi/i.test(t)) return "Nomba";
  if (/cleva/i.test(t)) return "Cleva";
  if (/grey|grey finance/i.test(t)) return "Grey";
  if (/raenest|geegpay/i.test(t)) return "Raenest";
  if (/leatherback/i.test(t)) return "Leatherback";
  if (/sudo/i.test(t)) return "Sudo";
  if (/bloc/i.test(t)) return "Bloc";
  if (/payaza/i.test(t)) return "Payaza";
  if (/zazipay|zazi/i.test(t)) return "ZaziPay";
  if (/brass/i.test(t)) return "Brass";
  if (/bumpa/i.test(t)) return "Bumpa";

  // Microfinance Banks (MFBs)
  if (/lapo/i.test(t)) return "LAPO MFB";
  if (/accion/i.test(t)) return "Accion MFB";
  if (/ab microfinance|ab mfb/i.test(t)) return "AB Microfinance";
  if (/renmoney|ren money/i.test(t)) return "Renmoney MFB";
  if (/mkobo/i.test(t)) return "Mkobo MFB";
  if (/microvis/i.test(t)) return "Microvis MFB";
  if (/grooming/i.test(t)) return "Grooming MFB";
  if (/nirsal/i.test(t)) return "NIRSAL MFB";
  if (/seed capital/i.test(t)) return "Seed Capital MFB";
  if (/mutual trust/i.test(t)) return "Mutual Trust MFB";
  if (/bowen/i.test(t)) return "Bowen MFB";
  if (/infinity mfb|infinity/i.test(t)) return "Infinity MFB";
  if (/trustfund/i.test(t)) return "Trustfund MFB";
  if ("/advans/i.test(t)") return "Advans MFB";
  if (/letshego/i.test(t)) return "Letshego MFB";
  if (/ibile/i.test(t)) return "Ibile MFB";
  if (/hackman/i.test(t)) return "Hackman MFB";
  if (/cemcs/i.test(t)) return "CEMCS MFB";
  if (/richway/i.test(t)) return "Richway MFB";
  if (/mautech/i.test(t)) return "Mautech MFB";
  if (/fsdh/i.test(t)) return "FSDH Merchant Bank";

  // Mobile Money & Telco Wallets
  if (/mtn momo|momo/i.test(t)) return "MTN MoMo";
  if (/airtel money/i.test(t)) return "Airtel Money";
  if (/9mobile/i.test(t)) return "9Mobile";

  return "Unknown Bank";
}
