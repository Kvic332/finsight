import { useState, useEffect, useRef } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

const SAMPLE_TRANSACTIONS = [
  { id: 1, desc: "Shoprite - Groceries", amount: 12400, type: "debit", cat: "Food", date: "2026-04-22", source: "sms" },
  { id: 2, desc: "Salary Credit - Renmoney", amount: 450000, type: "credit", cat: "Income", date: "2026-04-20", source: "sms" },
  { id: 3, desc: "Bolt Ride", amount: 2800, type: "debit", cat: "Transport", date: "2026-04-22", source: "manual" },
  { id: 4, desc: "MTN Airtime", amount: 1000, type: "debit", cat: "Utilities", date: "2026-04-21", source: "push" },
  { id: 5, desc: "Netflix Subscription", amount: 4200, type: "debit", cat: "Entertainment", date: "2026-04-19", source: "sms" },
  { id: 6, desc: "Eatright Restaurant", amount: 8500, type: "debit", cat: "Food", date: "2026-04-18", source: "manual" },
  { id: 7, desc: "DSTV Monthly", amount: 6800, type: "debit", cat: "Entertainment", date: "2026-04-17", source: "sms" },
  { id: 8, desc: "Kuda Transfer - Savings", amount: 30000, type: "debit", cat: "Savings", date: "2026-04-16", source: "sms" },
  { id: 9, desc: "Pharmacy - Drugs", amount: 3200, type: "debit", cat: "Health", date: "2026-04-15", source: "manual" },
  { id: 10, desc: "Uber Eats", amount: 5600, type: "debit", cat: "Food", date: "2026-04-14", source: "push" },
];

const SPEND_TREND = [
  { day: "Apr 14", spend: 5600 }, { day: "Apr 15", spend: 3200 },
  { day: "Apr 16", spend: 30000 }, { day: "Apr 17", spend: 6800 },
  { day: "Apr 18", spend: 8500 }, { day: "Apr 19", spend: 4200 },
  { day: "Apr 20", spend: 0 }, { day: "Apr 21", spend: 1000 },
  { day: "Apr 22", spend: 15200 },
];

const BALANCE_PROJECTION = [
  { day: "Now", balance: 387000 }, { day: "Week 2", balance: 341000 },
  { day: "Week 3", balance: 289000 }, { day: "Week 4", balance: 231000 },
  { day: "May W2", balance: 168000 }, { day: "May W3", balance: 98000 },
  { day: "May W4", balance: 21000 }, { day: "Jun W1", balance: 0 },
];

const CAT_DATA = [
  { name: "Food", value: 26500, color: COLORS.orange },
  { name: "Entertainment", value: 11000, color: COLORS.purple },
  { name: "Transport", value: 2800, color: COLORS.accent },
  { name: "Utilities", value: 1000, color: COLORS.yellow },
  { name: "Health", value: 3200, color: COLORS.green },
  { name: "Savings", value: 30000, color: "#4ADE80" },
];

const INVESTMENTS = [
  { name: "Cowrywise Mutual Fund", return: "14% p.a", risk: "Low", min: "₦1,000", liquidity: "7 days", color: COLORS.green },
  { name: "Piggyvest Fixed", return: "10–13% p.a", risk: "Low", min: "₦1,000", liquidity: "Lock-in", color: COLORS.accent },
  { name: "FGN Savings Bond", return: "12.5% p.a", risk: "Zero", min: "₦5,000", liquidity: "90 days", color: COLORS.yellow },
  { name: "Risevest Real Estate", return: "15–18% p.a", risk: "Medium", min: "₦3,000", liquidity: "12 months", color: COLORS.purple },
];

const ARIA_RESPONSES = {
  food: "Your food spending this month is ₦26,500 — that's 18% above your usual average. Most of it happened on weekends. Want me to set a ₦20,000 food cap for next month?",
  savings: "You've saved ₦30,000 this month, which is 6.7% of your income. Financial advisors recommend 20%. If you save ₦60,000 more, your Broke Clock extends by 11 days.",
  broke: "At your current burn rate of about ₦15,800 per day, your ₦387,000 balance hits zero in roughly 24 days — that's around May 16th. Want me to show you a plan to stretch it to June?",
  invest: "You have ₦30,000 in savings idle. I'd suggest splitting: ₦15,000 into Cowrywise for easy access, and ₦15,000 into FGN Bonds for guaranteed returns. Together that's about ₦3,900 in 6 months.",
  default: "I'm ARIA, your financial companion. You can ask me about your spending, savings, investment options, or how long your money will last. What would you like to know?",
};

function detectARIA(input) {
  const q = input.toLowerCase();
  if (q.includes("food") || q.includes("eat") || q.includes("restaurant")) return ARIA_RESPONSES.food;
  if (q.includes("sav")) return ARIA_RESPONSES.savings;
  if (q.includes("broke") || q.includes("last") || q.includes("afford") || q.includes("long")) return ARIA_RESPONSES.broke;
  if (q.includes("invest") || q.includes("put") || q.includes("grow")) return ARIA_RESPONSES.invest;
  return ARIA_RESPONSES.default;
}

const NAV_ITEMS = ["Dashboard", "Transactions", "Savings", "Investments", "ARIA"];
const CAT_ICONS = { Food: "🍔", Transport: "🚗", Entertainment: "🎬", Utilities: "💡", Health: "💊", Savings: "🏦", Income: "💰", Other: "📦" };

export default function FinSight() {
  const [active, setActive] = useState("Dashboard");
  const [transactions, setTransactions] = useState(SAMPLE_TRANSACTIONS);
  const [ariaChat, setAriaChat] = useState([{ role: "aria", text: "Hey! I'm ARIA, your financial companion. Ask me anything about your money." }]);
  const [ariaInput, setAriaInput] = useState("");
  const [ariaListening, setAriaListening] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [newTx, setNewTx] = useState({ desc: "", amount: "", type: "debit", cat: "Food" });
  const [finScore] = useState(67);
  const [pulse, setPulse] = useState(false);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ariaChat]);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1500);
    return () => clearInterval(t);
  }, []);

  const totalSpend = transactions.filter(t => t.type === "debit" && t.cat !== "Savings").reduce((a, b) => a + b.amount, 0);
  const totalSaved = transactions.filter(t => t.cat === "Savings").reduce((a, b) => a + b.amount, 0);
  const balance = 387000;
  const daysLeft = Math.floor(balance / (totalSpend / 9));

  function sendARIA() {
    if (!ariaInput.trim()) return;
    const userMsg = ariaInput.trim();
    setAriaChat(c => [...c, { role: "user", text: userMsg }]);
    setAriaInput("");
    setTimeout(() => {
      setAriaChat(c => [...c, { role: "aria", text: detectARIA(userMsg) }]);
    }, 700);
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice recognition not supported in this browser."); return; }
    const rec = new SR();
    rec.lang = "en-NG";
    rec.onstart = () => setAriaListening(true);
    rec.onend = () => setAriaListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setAriaInput(transcript);
    };
    rec.start();
    recognitionRef.current = rec;
  }

  function addTransaction() {
    if (!newTx.desc || !newTx.amount) return;
    setTransactions(t => [{
      id: Date.now(), desc: newTx.desc, amount: parseInt(newTx.amount),
      type: newTx.type, cat: newTx.cat, date: new Date().toISOString().split("T")[0], source: "manual"
    }, ...t]);
    setNewTx({ desc: "", amount: "", type: "debit", cat: "Food" });
    setShowAddTx(false);
  }

  const scoreColor = finScore >= 70 ? COLORS.green : finScore >= 50 ? COLORS.yellow : COLORS.red;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;600;700&family=Syne:wght@700;800&display=swap');
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
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
        .broke-ring { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .glow { box-shadow: 0 0 20px ${COLORS.accent}22; }
        .score-bar { height: 6px; border-radius: 3px; background: ${COLORS.border}; overflow: hidden; }
        .score-fill { height: 100%; border-radius: 3px; transition: width 1s ease; }
      `}</style>

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap" />

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
                {item === "Dashboard" ? "⬛ " : item === "Transactions" ? "↕️ " : item === "Savings" ? "🏦 " : item === "Investments" ? "📈 " : "🤖 "}{item}
              </div>
            ))}
          </nav>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#000" }}>K</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Kene</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>FinScore: <span style={{ color: scoreColor }}>{finScore}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
          {active === "Dashboard" && <DashboardView balance={balance} daysLeft={daysLeft} totalSpend={totalSpend} totalSaved={totalSaved} finScore={finScore} scoreColor={scoreColor} transactions={transactions} />}
          {active === "Transactions" && <TransactionsView transactions={transactions} showAdd={showAddTx} setShowAdd={setShowAddTx} newTx={newTx} setNewTx={setNewTx} addTransaction={addTransaction} />}
          {active === "Savings" && <SavingsView totalSaved={totalSaved} />}
          {active === "Investments" && <InvestmentsView totalSaved={totalSaved} />}
          {active === "ARIA" && <ARIAView chat={ariaChat} input={ariaInput} setInput={setAriaInput} send={sendARIA} listening={ariaListening} startVoice={startVoice} chatEndRef={chatEndRef} />}
        </div>
      </div>
    </div>
  );
}

function DashboardView({ balance, daysLeft, totalSpend, totalSaved, finScore, scoreColor, transactions }) {
  const urgency = daysLeft < 20 ? COLORS.red : daysLeft < 30 ? COLORS.yellow : COLORS.green;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800 }}>Good morning, Kene 👋</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Here's your financial pulse for today — April 22, 2026</p>
      </div>

      {/* Top Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Account Balance", value: `₦${balance.toLocaleString()}`, sub: "GTBank Main", color: COLORS.accent },
          { label: "Spent This Month", value: `₦${totalSpend.toLocaleString()}`, sub: "↑ 12% vs last month", color: COLORS.orange },
          { label: "Total Saved", value: `₦${totalSaved.toLocaleString()}`, sub: "6.7% of income", color: COLORS.green },
          { label: "FinScore", value: finScore, sub: "Good — improving", color: scoreColor },
        ].map((stat, i) => (
          <div key={i} className="card glow" style={{ borderColor: stat.color + "33" }}>
            <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: stat.color }}>{typeof stat.value === "number" ? stat.value : stat.value}</div>
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
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 42, fontWeight: 800, color: urgency }}>{daysLeft}<span style={{ fontSize: 16, marginLeft: 4 }}>days</span></div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>at current spending rate</div>
            </div>
            <div style={{ position: "relative", width: 80, height: 80 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="35" fill="none" stroke={COLORS.border} strokeWidth="6" />
                <circle cx="40" cy="40" r="35" fill="none" stroke={urgency} strokeWidth="6"
                  strokeDasharray={`${(daysLeft / 45) * 220} 220`} strokeLinecap="round"
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
              { label: "Cut 20%", days: daysLeft + 8, color: COLORS.yellow },
              { label: "ARIA plan", days: daysLeft + 18, color: COLORS.green },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, background: COLORS.surface, borderRadius: 8, padding: "8px 10px", border: `1px solid ${s.color}33` }}>
                <div style={{ fontSize: 10, color: COLORS.muted }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.days}d</div>
              </div>
            ))}
          </div>
        </div>

        {/* Spend Trend */}
        <div className="card">
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Daily Spend Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={SPEND_TREND}>
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
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Balance Projection */}
        <div className="card">
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Balance Projection</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={BALANCE_PROJECTION}>
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
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <PieChart width={120} height={120}>
              <Pie data={CAT_DATA} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                {CAT_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div style={{ flex: 1 }}>
              {CAT_DATA.map((c, i) => (
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
        </div>
      </div>

      {/* FinScore Details */}
      <div className="card">
        <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>FinScore Breakdown — {finScore}/100</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "Spend Discipline", score: 60, color: COLORS.yellow },
            { label: "Savings Rate", score: 45, color: COLORS.orange },
            { label: "Budget Adherence", score: 72, color: COLORS.green },
            { label: "Investment Activity", score: 30, color: COLORS.red },
          ].map((f, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: COLORS.muted }}>{f.label}</span>
                <span style={{ color: f.color, fontWeight: 600 }}>{f.score}</span>
              </div>
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${f.score}%`, background: f.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionsView({ transactions, showAdd, setShowAdd, newTx, setNewTx, addTransaction }) {
  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>Transactions</h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 2 }}>All your money movements in one place</p>
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
          <button key={f} className="btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>{f}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {transactions.map((tx, i) => (
          <div key={tx.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < transactions.length - 1 ? `1px solid ${COLORS.border}` : "none", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: tx.type === "credit" ? COLORS.green + "22" : COLORS.orange + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {CAT_ICONS[tx.cat] || "📦"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{tx.desc}</div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
                <span>{tx.date}</span>
                <span className="badge" style={{ background: COLORS.border, color: COLORS.muted }}>{tx.source === "sms" ? "📱 SMS" : tx.source === "push" ? "🔔 Push" : "✍️ Manual"}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: tx.type === "credit" ? COLORS.green : COLORS.text }}>
                {tx.type === "credit" ? "+" : "-"}₦{tx.amount.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>{tx.cat}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavingsView({ totalSaved }) {
  const goals = [
    { name: "Emergency Fund", target: 150000, saved: 30000, color: COLORS.accent, icon: "🛡️" },
    { name: "New Laptop", target: 400000, saved: 85000, color: COLORS.purple, icon: "💻" },
    { name: "Vacation 2026", target: 200000, saved: 45000, color: COLORS.yellow, icon: "✈️" },
    { name: "Rent Renewal", target: 600000, saved: 120000, color: COLORS.green, icon: "🏠" },
  ];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>Savings</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 2 }}>Build your financial cushion, goal by goal</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total Saved", value: `₦${totalSaved.toLocaleString()}`, color: COLORS.green },
          { label: "Savings Rate", value: "6.7%", sub: "Target: 20%", color: COLORS.yellow },
          { label: "Savings Streak", value: "4 months", color: COLORS.accent },
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
        <button className="btn-primary">+ New Goal</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {goals.map((g, i) => {
          const pct = Math.round((g.saved / g.target) * 100);
          return (
            <div key={i} className="card" style={{ borderColor: g.color + "33" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{g.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</span>
                </div>
                <span style={{ color: g.color, fontWeight: 700, fontSize: 14 }}>{pct}%</span>
              </div>
              <div className="score-bar" style={{ marginBottom: 8 }}>
                <div className="score-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${g.color}, ${g.color}88)` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted }}>
                <span>₦{g.saved.toLocaleString()} saved</span>
                <span>Target: ₦{g.target.toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>+ Add to Goal</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: COLORS.green + "33", background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.green}08)` }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>💡 ARIA Insight</div>
        <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
          You're saving 6.7% of income. To hit your Emergency Fund goal in 12 months, you'd need to save ₦10,000/month more. That's just ₦333/day — less than a Bolt ride.
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
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Based on your current savings pool</div>
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
                { label: "Projection (6mo)", value: `₦${Math.round(totalSaved * 0.06).toLocaleString()}` },
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

function ARIAView({ chat, input, setInput, send, listening, startVoice, chatEndRef }) {
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>
          <span style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ARIA</span>
        </h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 2 }}>Your AI Financial Companion — ask anything about your money</p>
      </div>

      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
        {chat.map((msg, i) => (
          <div key={i} className="fade-in" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "aria" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 10, flexShrink: 0, alignSelf: "flex-end" }}>🤖</div>
            )}
            <div style={{
              maxWidth: "70%", padding: "12px 16px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user" ? `linear-gradient(135deg, ${COLORS.accent}33, ${COLORS.purple}33)` : COLORS.card,
              border: `1px solid ${msg.role === "user" ? COLORS.accent + "44" : COLORS.border}`,
              fontSize: 14, lineHeight: 1.6
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={startVoice} style={{ width: 44, height: 44, borderRadius: "50%", background: listening ? `${COLORS.red}33` : COLORS.border, border: `1px solid ${listening ? COLORS.red : COLORS.border}`, cursor: "pointer", fontSize: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: listening ? "pulse 0.8s infinite" : "none" }}>
          🎙️
        </button>
        <input
          className="input" style={{ flex: 1 }}
          placeholder="Ask ARIA anything... 'How much did I spend on food?' or 'Can I afford a new phone?'"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
        />
        <button className="btn-primary" onClick={send} style={{ flexShrink: 0 }}>Send</button>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["How long will my money last?", "How much did I spend on food?", "Where should I invest?", "How are my savings doing?"].map((q, i) => (
          <button key={i} onClick={() => setInput(q)} style={{ background: COLORS.border, border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 12, color: COLORS.muted, cursor: "pointer" }}>{q}</button>
        ))}
      </div>
    </div>
  );
}
