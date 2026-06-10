import SMSPanel from './SMSPanel';
import { useState } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import ARIAViewAI from './ARIAView';
import Onboarding from './Onboarding';
import { loadUser, loadTransactions, computeStats, addTransaction as saveNewTransaction } from './dataEngine';
function GridIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
function TxIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/></svg>;
}
function PigIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M19 9a7 7 0 1 0-13.9 1.4L4 14h1l1 3h8l1-3h1l-.1-3.6A7 7 0 0 0 19 9z"/><path d="M12 7v2m5 4h1"/></svg>;
}
function ChartIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
}
function PhoneIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>;
}
function BotIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7m-3 0a3 3 0 1 1 6 0"/><circle cx="9" cy="16" r="1"/><circle cx="15" cy="16" r="1"/></svg>;
}

// ── Design Tokens (matching HTML design) ─────────────────────────────────────
const T = {
  bg0:      "#F5F3EE",
  bg1:      "#ECE9E2",
  bg2:      "#F0EDE6",
  surface:  "#FFFFFF",
  surface2: "#F8F6F1",
  line:     "#E2DED4",
  line2:    "#CFC9BC",
  ink:      "#0E120F",
  ink2:     "#2B3127",
  mute:     "#6B6E66",
  mute2:    "#989A91",
  lime:     "#B4DC2A",
  limeDeep: "#84A816",
  amber:    "#C77A00",
  rose:     "#D14545",
  indigo:   "#4F4FE0",
  radius:   "18px",
  radiusSm: "12px",
};

const INVESTMENTS = [
  { name: "Cowrywise Mutual Fund", ret: "14%", risk: "Low risk", riskColor: T.limeDeep, riskBg: T.lime, min: "₦1,000", lock: "7 days" },
  { name: "Piggyvest Fixed Savings", ret: "10–13%", risk: "Low risk", riskColor: T.limeDeep, riskBg: T.lime, min: "₦1,000", lock: "Lock-in" },
  { name: "FGN Savings Bond", ret: "12.5%", risk: "Zero risk", riskColor: T.amber, riskBg: "rgba(199,122,0,0.10)", min: "₦5,000", lock: "90 days" },
  { name: "Risevest — Real Estate", ret: "15–18%", risk: "Medium risk", riskColor: T.indigo, riskBg: "rgba(79,79,224,0.10)", min: "₦3,000", lock: "12 months" },
];

const NAV = [
  { id: "Dashboard", icon: <GridIcon />, label: "Dashboard" },
  { id: "Transactions", icon: <TxIcon />, label: "Transactions" },
  { id: "Savings", icon: <PigIcon />, label: "Savings" },
  { id: "Investments", icon: <ChartIcon />, label: "Investments" },
  { id: "SMS Import", icon: <PhoneIcon />, label: "SMS Import" },
  { id: "ARIA", icon: <BotIcon />, label: "ARIA" },
];

const CAT_COLORS = {
  Food: "#84A816", Transport: "#4F4FE0", Entertainment: "#C77A00",
  Utilities: "#D14545", Health: "#84A816", Savings: "#0E120F",
  Income: "#84A816", Transfer: "#6B6E66", Shopping: "#C77A00", Other: "#989A91",
};
const CAT_ICONS = { Food:"🍔", Transport:"🚗", Entertainment:"🎬", Utilities:"💡", Health:"💊", Savings:"🏦", Income:"💰", Other:"📦" };

export default function FinSight() {
  const [user, setUser] = useState(() => loadUser());
  const [transactions, setTransactions] = useState(() => loadTransactions());
  const [active, setActive] = useState("Dashboard");
  const [showAddTx, setShowAddTx] = useState(false);
  const [newTx, setNewTx] = useState({ desc: "", amount: "", type: "debit", cat: "Food" });

  if (!user || !user.setupComplete) {
    return <Onboarding onComplete={(data) => setUser(data)} />;
  }

  const stats = computeStats(user, transactions);
  const { balance, totalSpend, totalSaved, daysLeft, finScore, spendTrend, balanceProjection, categoryTotals, savingsGoals } = stats;

  const catChartData = Object.entries(categoryTotals).map(([name, value]) => ({
    name, value, color: CAT_COLORS[name] || T.mute,
  }));

  function handleAddTransaction() {
    if (!newTx.desc || !newTx.amount) return;
    const updated = saveNewTransaction({
      desc: newTx.desc, amount: parseInt(newTx.amount),
      type: newTx.type, cat: newTx.cat, source: "manual",
    });
    setTransactions(updated);
    setNewTx({ desc: "", amount: "", type: "debit", cat: "Food" });
    setShowAddTx(false);
  }

  const firstName = user.name ? user.name.split(" ")[0] : "there";
  const initial = firstName[0]?.toUpperCase() || "U";
  const scoreGrade = finScore >= 90 ? "A · Excellent" : finScore >= 80 ? "A− · Great" : finScore >= 70 ? "B+ · Above average" : finScore >= 60 ? "B · Good" : finScore >= 50 ? "C · Average" : "D · Needs work";

  return (
    <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", background: T.bg0, minHeight: "100vh", color: T.ink, WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: radial-gradient(900px 600px at 8% -5%, rgba(180,220,42,0.10), transparent 60%), radial-gradient(700px 500px at 100% 0%, rgba(79,79,224,0.04), transparent 60%), linear-gradient(180deg, #F5F3EE 0%, #EFEDE6 100%); }
        .serif { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.line2}; border-radius: 2px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 500; color: ${T.ink2}; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
        .nav-item:hover { background: rgba(0,0,0,0.03); color: ${T.ink}; }
        .nav-item.active { background: ${T.ink}; color: ${T.lime}; font-weight: 600; }
        .nav-item.active svg { color: ${T.lime}; }
        .nav-item svg { color: ${T.mute}; transition: color 0.15s; }
        .nav-item:hover svg { color: ${T.ink}; }
        .card { background: ${T.surface}; border: 1px solid ${T.line}; border-radius: ${T.radius}; padding: 22px; }
        .card-sm { background: ${T.surface}; border: 1px solid ${T.line}; border-radius: ${T.radiusSm}; padding: 16px; }
        .btn-cta { display: inline-flex; align-items: center; gap: 8px; background: ${T.ink}; color: ${T.lime}; border: none; padding: 10px 18px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; box-shadow: 0 8px 20px -10px rgba(14,18,15,0.4); transition: all 0.15s; }
        .btn-cta:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: ${T.ink2}; border: 1px solid ${T.line}; padding: 10px 18px; border-radius: 12px; font-weight: 500; font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .btn-ghost:hover { border-color: ${T.line2}; color: ${T.ink}; background: ${T.bg1}; }
        .lbl { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: ${T.mute}; font-weight: 600; }
        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid ${T.line}; background: ${T.surface}; border-radius: 999px; font-size: 12px; color: ${T.ink2}; }
        .input { background: ${T.surface2}; border: 1px solid ${T.line}; border-radius: 10px; padding: 11px 14px; color: ${T.ink}; font-size: 13px; outline: none; width: 100%; font-family: inherit; transition: border-color 0.15s; }
        .input:focus { border-color: ${T.limeDeep}; box-shadow: 0 0 0 3px rgba(132,168,22,0.12); }
        .select { background: ${T.surface2}; border: 1px solid ${T.line}; border-radius: 10px; padding: 11px 14px; color: ${T.ink}; font-size: 13px; outline: none; font-family: inherit; }
        .bar-track { height: 4px; background: ${T.line}; border-radius: 2px; overflow: hidden; margin-top: 8px; }
        .bar-fill { height: 100%; border-radius: 2px; transition: width 0.8s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.35s ease; }
        .source-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; background: ${T.bg1}; color: ${T.ink2}; border: 1px solid ${T.line}; font-family: 'JetBrains Mono', monospace; }
        .tx-row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid ${T.line}; }
        .tx-row:last-child { border-bottom: none; }
        .tx-icon { width: 36px; height: 36px; border-radius: 10px; background: ${T.bg1}; border: 1px solid ${T.line}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; }
        .tx-icon.in { background: rgba(132,168,22,0.12); border-color: rgba(132,168,22,0.25); }
        .risk-badge { font-size: 10px; padding: 3px 9px; border-radius: 999px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", maxWidth: 1440, margin: "0 auto", minHeight: "100vh" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ padding: "24px 14px", borderRight: `1px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 22, position: "sticky", top: 0, height: "100vh", background: "rgba(245,243,238,0.85)", backdropFilter: "blur(12px)" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.ink, color: T.lime, display: "grid", placeItems: "center", fontFamily: "'Instrument Serif', serif", fontSize: 22, fontStyle: "italic" }}>f</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>Fin<em style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: T.limeDeep }}>Sight</em></div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: T.mute2, letterSpacing: "0.16em", textTransform: "uppercase", padding: "0 10px", marginTop: -16 }}>Personal Finance, Clearer</div>

          {/* Nav */}
          <div>
            <div className="lbl" style={{ padding: "0 12px 8px" }}>Menu</div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {NAV.map(n => (
                <div key={n.id} className={`nav-item ${active === n.id ? "active" : ""}`} onClick={() => setActive(n.id)}>
                  {n.icon}
                  <span>{n.label}</span>
                </div>
              ))}
            </nav>
          </div>

          {/* FinScore card */}
          <div style={{ marginTop: "auto" }}>
            <div className="card-sm" style={{ marginBottom: 12 }}>
              <div className="lbl">FinScore</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span className="serif" style={{ fontSize: 36, lineHeight: 1, color: T.ink }}>{finScore}</span>
                <span style={{ color: T.mute, fontSize: 13 }}>/100</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${finScore}%`, background: finScore >= 70 ? T.limeDeep : finScore >= 50 ? T.amber : T.rose }} />
              </div>
              <div style={{ fontSize: 11, color: T.mute, marginTop: 8 }}>Grade {scoreGrade}</div>
            </div>

            {/* Profile */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, border: `1px solid ${T.line}`, borderRadius: 12, background: T.surface }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: T.ink, color: T.lime, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initial}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name || firstName}</div>
                <div style={{ fontSize: 11, color: T.mute }}>
                  {user.banks?.[0] || "FinSight user"}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ padding: "22px 28px 40px", minWidth: 0 }}>

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: T.mute }}>
              FinSight · <strong style={{ color: T.ink }}>{active}</strong>
            </div>
            <div style={{ flex: 1 }} />
            <div className="pill">
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.limeDeep }} />
              {new Date().toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })}
            </div>
            <button className="btn-cta" onClick={() => setActive("SMS Import")}>
              <PhoneIcon size={14} /> Import SMS
            </button>
          </div>

          {/* ── VIEWS ── */}
          {active === "Dashboard" && (
            <DashboardView
              balance={balance} daysLeft={daysLeft} totalSpend={totalSpend}
              totalSaved={totalSaved} finScore={finScore} scoreGrade={scoreGrade}
              transactions={transactions} spendTrend={spendTrend}
              balanceProjection={balanceProjection} catChartData={catChartData}
              firstName={firstName} income={stats.income} savingsGoals={savingsGoals}
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
            <SavingsView totalSaved={totalSaved} savingsGoals={savingsGoals} savingsRate={stats.savingsRate} income={stats.income} />
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
              income: stats.income, transactions: transactions.slice(0, 20), savingsGoals,
            }} />
          )}
        </main>
      </div>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardView({ balance, daysLeft, totalSpend, totalSaved, finScore, scoreGrade, transactions, spendTrend, balanceProjection, catChartData, firstName, income, savingsGoals }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const urgencyColor = daysLeft < 20 ? T.rose : daysLeft < 30 ? T.amber : T.limeDeep;

  return (
    <div className="fade-up">
      {/* HERO */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22, marginBottom: 22 }}>
        {/* Hero Left */}
        <div style={{
          border: `1px solid ${T.line}`, borderRadius: T.radius, padding: "30px 32px 26px",
          background: `radial-gradient(700px 400px at 100% 0%, rgba(180,220,42,0.18), transparent 55%), linear-gradient(180deg, ${T.surface} 0%, ${T.bg2} 100%)`,
          position: "relative", overflow: "hidden"
        }}>
          <div className="lbl">Good {greeting} · <strong style={{ color: T.ink, letterSpacing: 0 }}>{firstName}</strong></div>
          <h1 className="serif" style={{ margin: "14px 0 0", fontSize: 52, lineHeight: 1.0, letterSpacing: "-0.025em" }}>
            ₦<em style={{ fontStyle: "italic", color: T.limeDeep }}>{balance >= 1000000 ? `${(balance/1000000).toFixed(1)}M` : balance >= 1000 ? `${(balance/1000).toFixed(0)}K` : balance.toLocaleString()}</em>
            <span style={{ fontFamily: "'Space Grotesk'", fontSize: 22, fontWeight: 600, verticalAlign: "top", marginLeft: 6, color: T.ink2, fontStyle: "normal", lineHeight: 1.8 }}>balance</span>
          </h1>
          <p style={{ color: T.ink2, fontSize: 14, maxWidth: 420, lineHeight: 1.5, marginTop: 12 }}>
            {daysLeft >= 365 ? "Your balance is healthy — keep tracking." : `At your current pace, your balance covers <strong>${daysLeft} more days</strong>. ARIA has suggestions.`}
          </p>

          <div style={{ display: "flex", gap: 28, marginTop: 26, paddingTop: 22, borderTop: `1px dashed ${T.line2}` }}>
            {[
              { k: "Spent / month", v: `₦${totalSpend >= 1000 ? (totalSpend/1000).toFixed(0)+"K" : totalSpend.toLocaleString()}`, sub: income > 0 ? `${((totalSpend/income)*100).toFixed(0)}% of income` : "" },
              { k: "Saved / month", v: `₦${totalSaved >= 1000 ? (totalSaved/1000).toFixed(0)+"K" : totalSaved.toLocaleString()}`, sub: income > 0 ? `${((totalSaved/income)*100).toFixed(1)}%` : "" },
              { k: "Broke Clock™", v: daysLeft >= 365 ? "365+d" : `${daysLeft}d`, sub: "remaining", vColor: urgencyColor },
            ].map((s, i) => (
              <div key={i}>
                <div className="lbl" style={{ marginBottom: 6 }}>{s.k}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.vColor || T.ink, letterSpacing: "-0.02em" }}>{s.v}</div>
                {s.sub && <div style={{ fontSize: 11, color: T.mute, marginTop: 2 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Hero Right — Broke Clock detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ flex: 1, background: T.ink, borderColor: T.ink, color: T.lime }}>
            <div className="lbl" style={{ color: "rgba(180,220,42,0.6)" }}>Broke Clock™</div>
            <div className="serif" style={{ fontSize: 64, lineHeight: 1, marginTop: 8, color: T.lime }}>
              {daysLeft >= 365 ? "∞" : daysLeft}
            </div>
            <div style={{ fontSize: 13, color: "rgba(180,220,42,0.6)", marginTop: 4 }}>days remaining</div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              {[
                { l: "Now", d: daysLeft, c: "#D14545" },
                { l: "−20%", d: Math.round(daysLeft * 1.25), c: "#C77A00" },
                { l: "ARIA", d: Math.round(daysLeft * 1.5), c: T.lime },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 10px", border: `1px solid rgba(255,255,255,0.10)` }}>
                  <div style={{ fontSize: 10, color: "rgba(180,220,42,0.5)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{s.l}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: s.c, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{s.d >= 365 ? "365+" : s.d}d</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-sm" style={{ background: `linear-gradient(135deg, ${T.surface}, rgba(180,220,42,0.06))` }}>
            <div className="lbl" style={{ marginBottom: 10 }}>FinScore · {scoreGrade}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="serif" style={{ fontSize: 40, color: T.ink, lineHeight: 1 }}>{finScore}</span>
              <span style={{ color: T.mute, fontSize: 13 }}>/100</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${finScore}%`, background: finScore >= 70 ? T.limeDeep : finScore >= 50 ? T.amber : T.rose }} />
            </div>
          </div>
        </div>
      </div>

      {/* GRID: Charts + Transactions + Investments */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 22, marginBottom: 22 }}>

        {/* Spend trend */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div className="lbl">Daily spend</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>₦{totalSpend >= 1000 ? (totalSpend/1000).toFixed(0)+"K" : totalSpend}</div>
            </div>
            <div style={{ fontSize: 11, color: T.mute }}>Last 7 days</div>
          </div>
          {spendTrend.some(d => d.spend > 0) ? (
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={spendTrend}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.limeDeep} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={T.limeDeep} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: T.mute }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 11, color: T.ink }} formatter={v => [`₦${v.toLocaleString()}`, "Spent"]} />
                <Area type="monotone" dataKey="spend" stroke={T.limeDeep} fill="url(#sg)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", color: T.mute2, fontSize: 13 }}>
              Add transactions to see trend
            </div>
          )}
        </div>

        {/* Balance projection */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div className="lbl">Balance projection</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>8-week outlook</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={balanceProjection}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: T.mute }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`₦${v.toLocaleString()}`, "Balance"]} />
              <Line type="monotone" dataKey="balance" stroke={T.amber} strokeWidth={2} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="card">
          <div className="lbl" style={{ marginBottom: 14 }}>Spending categories</div>
          {catChartData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {catChartData.slice(0, 5).map((c, i) => {
                const max = Math.max(...catChartData.map(x => x.value));
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: T.ink2, fontWeight: 500 }}>{c.name}</span>
                      <span style={{ color: T.ink, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>₦{c.value.toLocaleString()}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(c.value / max) * 100}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: T.mute2, fontSize: 13, paddingTop: 20 }}>No category data yet</div>
          )}
        </div>
      </div>

      {/* GRID: Recent Transactions + Investments */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, marginBottom: 22 }}>

        {/* Recent transactions */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent transactions</h3>
            <span style={{ fontSize: 12, color: T.mute }}>{transactions.length} total</span>
          </div>
          <div>
            {transactions.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: T.mute2, fontSize: 13 }}>No transactions yet</div>
            ) : transactions.slice(0, 6).map((tx, i) => (
              <div key={tx.id} className="tx-row">
                <div className={`tx-icon ${tx.type === "credit" ? "in" : ""}`}>
                  {CAT_ICONS[tx.cat] || "📦"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{tx.desc}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="source-badge">{tx.source === "sms" ? "SMS" : tx.source === "push" ? "Push" : "Manual"}</span>
                    {tx.bank && <span className="source-badge">{tx.bank}</span>}
                    <span style={{ fontSize: 11, color: T.mute }}>{tx.date}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: tx.type === "credit" ? T.limeDeep : T.ink, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.01em" }}>
                    {tx.type === "credit" ? "+" : "−"}₦{tx.amount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: T.mute, marginTop: 2 }}>{tx.cat}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick investments */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recommended for you</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {INVESTMENTS.slice(0, 3).map((inv, i) => (
              <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, background: T.bg1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{inv.name}</div>
                  <span className="risk-badge" style={{ background: inv.riskBg, color: inv.riskColor, border: `1px solid ${inv.riskColor}44`, flexShrink: 0 }}>{inv.risk}</span>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <div className="lbl" style={{ marginBottom: 2 }}>Return</div>
                    <div className="serif" style={{ fontSize: 20, color: inv.riskColor, lineHeight: 1.1 }}>{inv.ret} <span style={{ fontFamily: "'Space Grotesk'", fontSize: 11, color: T.mute }}>p.a</span></div>
                  </div>
                  <div>
                    <div className="lbl" style={{ marginBottom: 2 }}>Min</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.min}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINSCORE BREAKDOWN */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>FinScore · Composite</div>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>How <em className="serif" style={{ color: T.limeDeep, fontStyle: "italic" }}>healthy</em> are your money habits?</h3>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="serif" style={{ fontSize: 48, lineHeight: 1, color: T.ink }}>{finScore}<span style={{ fontFamily: "'Space Grotesk'", fontSize: 18, color: T.mute }}>/100</span></div>
            <div style={{ fontSize: 12, color: T.mute, marginTop: 4 }}>Grade {scoreGrade}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {[
            { label: "Spend Discipline", score: Math.min(100, income > 0 ? Math.round((1 - totalSpend/income) * 100) : 50), desc: "% of income spent vs target 60%" },
            { label: "Savings Rate", score: Math.min(100, income > 0 ? Math.round((totalSaved/income) * 500) : 0), desc: `${income > 0 ? ((totalSaved/income)*100).toFixed(1) : 0}% saved vs recommended 20%` },
            { label: "Budget Adherence", score: transactions.length > 5 ? 72 : Math.round((transactions.length/5)*72), desc: "Based on transaction consistency" },
            { label: "Investment Activity", score: 30, desc: "No active investments detected" },
          ].map((f, i) => {
            const c = f.score >= 70 ? T.limeDeep : f.score >= 50 ? T.amber : T.rose;
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: T.ink2, fontWeight: 500 }}>{f.label}</span>
                  <strong style={{ color: c }}>{Math.max(0, f.score)}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, f.score))}%`, background: c }} />
                </div>
                <div style={{ fontSize: 11, color: T.mute, marginTop: 6, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── TRANSACTIONS ─────────────────────────────────────────────────────────────
function TransactionsView({ transactions, showAdd, setShowAdd, newTx, setNewTx, addTransaction }) {
  const [filter, setFilter] = useState("All");
  const filtered = transactions.filter(tx => filter === "All" || tx.source === filter.toLowerCase());

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="lbl" style={{ marginBottom: 6 }}>Ledger</div>
          <h1 className="serif" style={{ fontSize: 36, lineHeight: 1 }}>Transactions</h1>
          <p style={{ color: T.mute, fontSize: 14, marginTop: 6 }}>{transactions.length} entries recorded</p>
        </div>
        <button className="btn-cta" onClick={() => setShowAdd(!showAdd)}>+ Log transaction</button>
      </div>

      {showAdd && (
        <div className="card fade-up" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>New Transaction</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            <input className="input" placeholder="Description" value={newTx.desc} onChange={e => setNewTx({ ...newTx, desc: e.target.value })} />
            <input className="input" placeholder="Amount (₦)" type="number" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
            <select className="select" value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value })}>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            <select className="select" value={newTx.cat} onChange={e => setNewTx({ ...newTx, cat: e.target.value })}>
              {["Food","Transport","Entertainment","Utilities","Health","Savings","Income","Other"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-cta" onClick={addTransaction}>Add</button>
            <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["All","Manual","SMS","Push"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${filter === f ? T.ink : T.line}`, background: filter === f ? T.ink : T.surface, color: filter === f ? T.lime : T.ink2, transition: "all 0.15s" }}>{f}</button>
        ))}
      </div>

      <div className="card" style={{ padding: "0 22px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: T.mute2, fontSize: 14 }}>No transactions found. Add one or import from SMS.</div>
        ) : filtered.map((tx, i) => (
          <div key={tx.id} className="tx-row">
            <div className={`tx-icon ${tx.type === "credit" ? "in" : ""}`}>{CAT_ICONS[tx.cat] || "📦"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{tx.desc}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className="source-badge">{tx.source === "sms" ? "📱 SMS" : tx.source === "push" ? "🔔 Push" : "✍️ Manual"}</span>
                {tx.bank && <span className="source-badge">{tx.bank}</span>}
                <span style={{ fontSize: 11, color: T.mute }}>{tx.date}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: tx.type === "credit" ? T.limeDeep : T.ink, fontFamily: "'JetBrains Mono', monospace" }}>
                {tx.type === "credit" ? "+" : "−"}₦{tx.amount.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: T.mute, marginTop: 2 }}>{tx.cat}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SAVINGS ──────────────────────────────────────────────────────────────────
function SavingsView({ totalSaved, savingsGoals, savingsRate, income }) {
  const goalColors = [T.limeDeep, T.indigo, T.amber, T.rose, "#0E120F"];
  const goalIcons = ["🛡️","💻","✈️","🏠","🎯"];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <div className="lbl" style={{ marginBottom: 6 }}>Goals & Progress</div>
        <h1 className="serif" style={{ fontSize: 36, lineHeight: 1 }}>Savings</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 22 }}>
        {[
          { label: "Total saved", value: `₦${totalSaved.toLocaleString()}`, sub: "This month" },
          { label: "Savings rate", value: `${savingsRate}%`, sub: "Target: 20%", highlight: savingsRate >= 20 },
          { label: "Active goals", value: `${savingsGoals.filter(g => g.name).length}`, sub: "Goals in progress" },
        ].map((s, i) => (
          <div key={i} className="card-sm">
            <div className="lbl">{s.label}</div>
            <div className="serif" style={{ fontSize: 32, marginTop: 4, color: s.highlight ? T.limeDeep : T.ink, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: T.mute, marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {savingsGoals.filter(g => g.name).length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: T.mute2 }}>No savings goals yet. Update your profile to add goals.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 22 }}>
          {savingsGoals.filter(g => g.name).map((g, i) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((g.saved/g.target)*100)) : 0;
            const color = goalColors[i % goalColors.length];
            return (
              <div key={i} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{goalIcons[i % goalIcons.length]}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</span>
                </div>
                <div className="bar-track" style={{ height: 6 }}>
                  <div className="bar-fill" style={{ width: `${pct}%`, background: color, height: "100%" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.mute, marginTop: 10 }}>
                  <span>₦{(g.saved||0).toLocaleString()} saved</span>
                  <span>Target ₦{(g.target||0).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ background: T.ink, borderColor: T.ink, color: T.lime }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(180,220,42,0.6)", marginBottom: 8 }}>ARIA Insight</div>
        <p style={{ fontSize: 14, color: T.lime, lineHeight: 1.6 }}>
          {savingsRate >= 20
            ? `You're saving ${savingsRate}% of income — above the recommended 20%. Excellent discipline.`
            : `You're saving ${savingsRate}% of income. Reach 20% by automating a transfer on payday before any spending happens.`}
        </p>
      </div>
    </div>
  );
}

// ── INVESTMENTS ──────────────────────────────────────────────────────────────
function InvestmentsView({ totalSaved }) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <div className="lbl" style={{ marginBottom: 6 }}>Portfolio</div>
        <h1 className="serif" style={{ fontSize: 36, lineHeight: 1 }}>Investments</h1>
        <p style={{ color: T.mute, fontSize: 14, marginTop: 8 }}>
          ₦{totalSaved.toLocaleString()} available · Personalized for your risk profile
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18 }}>
        {INVESTMENTS.map((inv, i) => (
          <div key={i} className="card" style={{ position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, borderRadius: "0 18px 0 120px", background: `${inv.riskBg}`, opacity: 0.5 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, position: "relative" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{inv.name}</div>
                <div style={{ fontSize: 12, color: T.mute }}>Min {inv.min} · Lock {inv.lock}</div>
              </div>
              <span className="risk-badge" style={{ background: inv.riskBg, color: inv.riskColor, border: `1px solid ${inv.riskColor}44` }}>{inv.risk}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, position: "relative" }}>
              <div>
                <div className="lbl" style={{ marginBottom: 4 }}>Return</div>
                <div className="serif" style={{ fontSize: 26, color: inv.riskColor, lineHeight: 1.1 }}>{inv.ret} <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, color: T.mute }}>p.a</span></div>
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 4 }}>6mo projection</div>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>
                  +₦{totalSaved > 0 ? Math.round(totalSaved * 0.06).toLocaleString() : "—"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>Learn →</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 18, background: T.bg1 }}>
        <div className="lbl" style={{ marginBottom: 6 }}>⚠️ Disclaimer</div>
        <p style={{ fontSize: 12, color: T.mute, lineHeight: 1.6 }}>
          Investment suggestions are for informational purposes only. FinSight does not execute transactions or provide regulated financial advice. Always research independently before investing.
        </p>
      </div>
    </div>
  );
}

// ── SVG ICONS ─────────────────────────────────────────────────────────────────
