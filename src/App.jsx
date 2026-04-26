import SMSPanel from './SMSPanel';
import { useState } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import ARIAViewAI from './ARIAView';
import Onboarding from './Onboarding';
import { loadUser, loadTransactions, computeStats, addTransaction as saveNewTransaction } from './dataEngine';

const COLORS = {
  bg: "#0A0E1A",
  surface: "#111827",
  card: "#151D2E",
  border: "#1E2D45",
  accent: "#00D4FF",
  green: "#00F5A0",
  orange: "#FF6B35",
  red: "#FF3B5C",
  yellow: "#FFD166",
  purple: "#9B5DE5",
  text: "#E8EDF5",
  muted: "#6B7FA3",
};

const INVESTMENTS = [
  { name: "Cowrywise Mutual Fund", return: "14% p.a", risk: "Low", min: "₦1,000", liquidity: "7 days", color: COLORS.green },
  { name: "Piggyvest Fixed", return: "10–13% p.a", risk: "Low", min: "₦1,000", liquidity: "Lock-in", color: COLORS.accent },
  { name: "FGN Savings Bond", return: "12.5% p.a", risk: "Zero", min: "₦5,000", liquidity: "90 days", color: COLORS.yellow },
  { name: "Risevest Real Estate", return: "15–18% p.a", risk: "Medium", min: "₦3,000", liquidity: "12 months", color: COLORS.purple },
];

const NAV_ITEMS = ["Dashboard", "Transactions", "Savings", "Investments", "SMS Import", "ARIA"];
const CAT_ICONS = { Food: "🍔", Transport: "🚗", Entertainment: "🎬", Utilities: "💡", Health: "💊", Savings: "🏦", Income: "💰", Other: "📦" };
const CAT_COLORS = { Food: COLORS.orange, Entertainment: COLORS.purple, Transport: COLORS.accent, Utilities: COLORS.yellow, Health: COLORS.green, Savings: "#4ADE80", Income: COLORS.green, Other: COLORS.muted };

export default function FinSight() {
  const [user, setUser] = useState(() => loadUser());
  const [transactions, setTransactions] = useState(() => loadTransactions());
  const [active, setActive] = useState("Dashboard");
  const [showAddTx, setShowAddTx] = useState(false);
  const [newTx, setNewTx] = useState({ desc: "", amount: "", type: "debit", cat: "Food" });

  // Show onboarding if user hasn't set up yet
  if (!user || !user.setupComplete) {
    return <Onboarding onComplete={(data) => setUser(data)} />;
  }

  // Compute all stats from real data
  const stats = computeStats(user, transactions);
  const { balance, totalSpend, totalSaved, daysLeft, finScore, spendTrend, balanceProjection, categoryTotals, savingsGoals } = stats;
  const scoreColor = finScore >= 70 ? COLORS.green : finScore >= 50 ? COLORS.yellow : COLORS.red;

  // Category chart data from real transactions
  const catChartData = Object.entries(categoryTotals).map(([name, value]) => ({
    name, value, color: CAT_COLORS[name] || COLORS.muted,
  }));

  function handleAddTransaction() {
    if (!newTx.desc || !newTx.amount) return;
    const updated = saveNewTransaction({
      desc: newTx.desc,
      amount: parseInt(newTx.amount),
      type: newTx.type,
      cat: newTx.cat,
      source: "manual",
    });
    setTransactions(updated);
    setNewTx({ desc: "", amount: "", type: "debit", cat: "Food" });
    setShowAddTx(false);
  }

  // First name from user profile
  const firstName = user.name ? user.name.split(" ")[0] : "there";
  const initial = firstName[0].toUpperCase();

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #1E2D45; border-radius: 2px; }
        .nav-item { cursor: pointer; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; transition: all 0.2s; color: ${COLORS.muted}; }
        .nav-item:hover { background: ${COLORS.border}; color: ${COLORS.text}; }
        .nav-item.active { background: linear-gradient(135deg, #00D4FF22, #9B5DE522); color: ${COLORS.accent}; border: 1px solid ${COLORS.accent}33; }
        .card { background: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 16px; padding: 20px; }
        .btn-primary { background: linear-gradient(135deg, ${COLORS.accent}, #0099BB); color: #000; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .btn-primary:hover { opacity: 0.85; transform: translateY(-1px); }
        .btn-ghost { background: ${COLORS.border}; color: ${COLORS.text}; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 500; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .btn-ghost:hover { background: #2A3A55; }
        .input { background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; border-radius: 10px; padding: 10px 14px; color: ${COLORS.text}; font-size: 13px; outline: none; width: 100%; }
        .input:focus { border-color: ${COLORS.accent}66; }
        .select { background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; border-radius: 10px; padding: 10px 14px; color: ${COLORS.text}; font-size: 13px; outline: none; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
        .glow { box-shadow: 0 0 20px ${COLORS.accent}22; }
        .score-bar { height: 6px; border-radius: 3px; background: ${COLORS.border}; overflow: hidden; }
        .score-fill { height: 100%; border-radius: 3px; transition: width 1s ease; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", padding: "24px 12px", flexShrink: 0 }}>
          <div style={{ padding: "0 8px 24px", borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FinSight</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Your Financial OS</div>
          </div>
          <nav style={{ flex: 1, marginTop: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            {NAV_ITEMS.map(item => (
              <div key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}>
                {item === "Dashboard" ? "⬛ " : item === "Transactions" ? "↕️ " : item === "Savings" ? "🏦 " : item === "Investments" ? "📈 " : item === "SMS Import" ? "📱 " : "🤖 "}{item}
              </div>
            ))}
          </nav>
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#000" }}>{initial}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{firstName}</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>FinScore: <span style={{ color: scoreColor }}>{finScore}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
          {active === "Dashboard" && (
            <DashboardView
              balance={balance} daysLeft={daysLeft} totalSpend={totalSpend}
              totalSaved={totalSaved} finScore={finScore} scoreColor={scoreColor}
              transactions={transactions} spendTrend={spendTrend}
              balanceProjection={balanceProjection} catChartData={catChartData}
              firstName={firstName} income={stats.income}
            />
          )}
          {active === "Transactions" && (
            <TransactionsView
              transactions={transactions} showAdd={showAddTx}
              setShowAdd={setShowAddTx} newTx={newTx} setNewTx={setNewTx}
              addTransaction={handleAddTransaction}
            />
          )}
          {active === "Savings" && (
            <SavingsView totalSaved={totalSaved} savingsGoals={savingsGoals} savingsRate={stats.savingsRate} />
          )}
          {active === "Investments" && <InvestmentsView totalSaved={totalSaved} />}
          {active === "SMS Import" && (
            <SMSPanel onImport={(txs, goHome) => {
              if (goHome) { setActive("Dashboard"); return; }
              txs.forEach(tx => saveNewTransaction(tx));
              setTransactions(loadTransactions());
            }} />
            )}
          {active === "ARIA" && (
            <ARIAViewAI financialContext={{
              balance, totalSpend, totalSaved, daysLeft, finScore,
              income: stats.income,
              transactions: transactions.slice(0, 20),
              savingsGoals,
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardView({ balance, daysLeft, totalSpend, totalSaved, finScore, scoreColor, transactions, spendTrend, balanceProjection, catChartData, firstName, income }) {
  const urgency = daysLeft < 20 ? COLORS.red : daysLeft < 30 ? COLORS.yellow : COLORS.green;
  const today = new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800 }}>{greeting}, {firstName} 👋</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Here's your financial pulse for today — {today}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Est. Balance", value: `₦${balance.toLocaleString()}`, sub: "Based on your activity", color: COLORS.accent },
          { label: "Spent This Month", value: `₦${totalSpend.toLocaleString()}`, sub: income > 0 ? `${((totalSpend/income)*100).toFixed(0)}% of income` : "Log income to compare", color: COLORS.orange },
          { label: "Total Saved", value: `₦${totalSaved.toLocaleString()}`, sub: income > 0 ? `${((totalSaved/income)*100).toFixed(1)}% of income` : "Keep it up!", color: COLORS.green },
          { label: "FinScore", value: finScore, sub: finScore >= 70 ? "Great shape!" : finScore >= 50 ? "Good — improving" : "Needs attention", color: scoreColor },
        ].map((stat, i) => (
          <div key={i} className="card glow" style={{ borderColor: stat.color + "33" }}>
            <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Broke Clock */}
        <div className="card" style={{ borderColor: urgency + "44", background: `linear-gradient(135deg, ${COLORS.card}, ${urgency}08)` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🕐 Broke Clock™</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 42, fontWeight: 800, color: urgency }}>
                {daysLeft >= 365 ? "365+" : daysLeft}<span style={{ fontSize: 16, marginLeft: 4 }}>days</span>
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>at current spending rate</div>
            </div>
            <div style={{ position: "relative", width: 80, height: 80 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="35" fill="none" stroke={COLORS.border} strokeWidth="6" />
                <circle cx="40" cy="40" r="35" fill="none" stroke={urgency} strokeWidth="6"
                  strokeDasharray={`${(Math.min(daysLeft, 45) / 45) * 220} 220`} strokeLinecap="round"
                  transform="rotate(-90 40 40)" style={{ transition: "all 1s ease" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                {daysLeft < 20 ? "🔴" : daysLeft < 30 ? "🟡" : "🟢"}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            {[
              { label: "Current path", days: daysLeft, color: COLORS.red },
              { label: "Cut 20%", days: Math.round(daysLeft * 1.25), color: COLORS.yellow },
              { label: "ARIA plan", days: Math.round(daysLeft * 1.5), color: COLORS.green },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, background: COLORS.surface, borderRadius: 8, padding: "8px 10px", border: `1px solid ${s.color}33` }}>
                <div style={{ fontSize: 10, color: COLORS.muted }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.days >= 365 ? "365+d" : `${s.days}d`}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Spend Trend */}
        <div className="card">
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Daily Spend Trend</div>
          {spendTrend.some(d => d.spend > 0) ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={spendTrend}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => `₦${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="spend" stroke={COLORS.accent} fill="url(#spendGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontSize: 13 }}>
              Add transactions to see your spend trend
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Balance Projection */}
        <div className="card">
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Balance Projection</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={balanceProjection}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: COLORS.muted }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => `₦${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="balance" stroke={COLORS.orange} strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Spending by Category</div>
          {catChartData.length > 0 ? (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <PieChart width={120} height={120}>
                <Pie data={catChartData} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                  {catChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1 }}>
                {catChartData.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                      <span style={{ color: COLORS.muted }}>{c.name}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>₦{c.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontSize: 13 }}>
              Add transactions to see breakdown
            </div>
          )}
        </div>
      </div>

      {/* FinScore */}
      <div className="card">
        <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>FinScore Breakdown — {finScore}/100</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "Spend Discipline", score: Math.min(100, income > 0 ? Math.round((1 - totalSpend / income) * 100) : 50), color: COLORS.yellow },
            { label: "Savings Rate", score: Math.min(100, income > 0 ? Math.round((totalSaved / income) * 500) : 0), color: COLORS.orange },
            { label: "Budget Adherence", score: transactions.length > 5 ? 72 : Math.round((transactions.length / 5) * 72), color: COLORS.green },
            { label: "Investment Activity", score: 30, color: COLORS.red },
          ].map((f, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: COLORS.muted }}>{f.label}</span>
                <span style={{ color: f.color, fontWeight: 600 }}>{Math.max(0, f.score)}</span>
              </div>
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${Math.max(0, Math.min(100, f.score))}%`, background: f.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionsView({ transactions, showAdd, setShowAdd, newTx, setNewTx, addTransaction }) {
  const [filter, setFilter] = useState("All");

  const filtered = transactions.filter(tx => {
    if (filter === "All") return true;
    return tx.source === filter.toLowerCase();
  });

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>Transactions</h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 2 }}>{transactions.length} transactions recorded</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add Transaction</button>
      </div>

      {showAdd && (
        <div className="card fade-in" style={{ marginBottom: 20, borderColor: COLORS.accent + "44" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Log New Transaction</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input className="input" placeholder="Description" value={newTx.desc} onChange={e => setNewTx({ ...newTx, desc: e.target.value })} />
            <input className="input" placeholder="Amount (₦)" type="number" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
            <select className="select input" value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value })}>
              <option value="debit">Debit (Spend)</option>
              <option value="credit">Credit (Income)</option>
            </select>
            <select className="select input" value={newTx.cat} onChange={e => setNewTx({ ...newTx, cat: e.target.value })}>
              {["Food", "Transport", "Entertainment", "Utilities", "Health", "Savings", "Income", "Other"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={addTransaction}>Add Transaction</button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {["All", "Manual", "SMS", "Push"].map(f => (
          <button key={f} className={filter === f ? "btn-primary" : "btn-ghost"} style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
            No transactions yet. Add one above or paste an SMS below.
          </div>
        ) : (
          filtered.map((tx, i) => (
            <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${COLORS.border}` : "none", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: tx.type === "credit" ? COLORS.green + "22" : COLORS.orange + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {CAT_ICONS[tx.cat] || "📦"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{tx.desc}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{tx.date}</span>
                  <span className="badge" style={{ background: COLORS.border, color: COLORS.muted }}>
                    {tx.source === "sms" ? "📱 SMS" : tx.source === "push" ? "🔔 Push" : "✍️ Manual"}
                  </span>
                  {tx.bank && <span className="badge" style={{ background: COLORS.border, color: COLORS.muted }}>{tx.bank}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: tx.type === "credit" ? COLORS.green : COLORS.text }}>
                  {tx.type === "credit" ? "+" : "-"}₦{tx.amount.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>{tx.cat}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SavingsView({ totalSaved, savingsGoals, savingsRate }) {
  const goalColors = [COLORS.accent, COLORS.purple, COLORS.yellow, COLORS.green, COLORS.orange];
  const goalIcons = ["🛡️", "💻", "✈️", "🏠", "🎯"];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>Savings</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 2 }}>Build your financial cushion, goal by goal</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total Saved", value: `₦${totalSaved.toLocaleString()}`, color: COLORS.green },
          { label: "Savings Rate", value: `${savingsRate}%`, sub: "Target: 20%", color: savingsRate >= 20 ? COLORS.green : COLORS.yellow },
          { label: "Active Goals", value: `${savingsGoals.filter(g => g.name).length}`, color: COLORS.accent },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: s.color }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700 }}>Savings Goals</div>
      </div>

      {savingsGoals.filter(g => g.name).length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
          No savings goals set yet. Add goals during onboarding or update your profile.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {savingsGoals.filter(g => g.name).map((g, i) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
            const color = goalColors[i % goalColors.length];
            return (
              <div key={i} className="card" style={{ borderColor: color + "33" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{goalIcons[i % goalIcons.length]}</span>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</span>
                  </div>
                  <span style={{ color, fontWeight: 700, fontSize: 14 }}>{pct}%</span>
                </div>
                <div className="score-bar" style={{ marginBottom: 8 }}>
                  <div className="score-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted }}>
                  <span>₦{(g.saved || 0).toLocaleString()} saved</span>
                  <span>Target: ₦{(g.target || 0).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: 16, borderColor: COLORS.green + "33", background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.green}08)` }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>💡 ARIA Insight</div>
        <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
          {savingsRate >= 20
            ? `Excellent! You're saving ${savingsRate}% of your income — above the recommended 20%. Keep it up!`
            : `You're saving ${savingsRate}% of income. To reach the recommended 20%, try setting up automatic transfers on payday before you spend.`}
        </p>
      </div>
    </div>
  );
}

function InvestmentsView({ totalSaved }) {
  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>Investments</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 2 }}>Put your savings to work — personalized for you</p>
      </div>

      <div className="card" style={{ marginBottom: 20, borderColor: COLORS.accent + "44", background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.accent}08)` }}>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>Available to Invest</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: COLORS.accent }}>₦{totalSaved.toLocaleString()}</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Based on your current savings</div>
      </div>

      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Recommended for You</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {INVESTMENTS.map((inv, i) => (
          <div key={i} className="card" style={{ borderColor: inv.color + "44" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{inv.name}</div>
              <span className="badge" style={{ background: inv.color + "22", color: inv.color }}>{inv.risk} Risk</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Expected Return", value: inv.return },
                { label: "Min. Investment", value: inv.min },
                { label: "Liquidity", value: inv.liquidity },
                { label: "Projection (6mo)", value: totalSaved > 0 ? `₦${Math.round(totalSaved * 0.06).toLocaleString()}` : "Add savings first" },
              ].map((d, j) => (
                <div key={j}>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: inv.color }}>{d.value}</div>
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ width: "100%", textAlign: "center", fontSize: 12 }}>Learn More →</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>⚠️ Disclaimer</div>
        <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
          Investment suggestions are for informational purposes only. FinSight does not execute transactions or provide regulated financial advice. Always research platforms independently before investing.
        </p>
      </div>
    </div>
  );
}