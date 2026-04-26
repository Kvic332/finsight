import { useState } from "react";
import { parseSMS, autoCategory, detectBank } from "./dataEngine";

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

const CAT_ICONS = {
  Food: "🍔", Transport: "🚗", Entertainment: "🎬", Utilities: "💡",
  Health: "💊", Savings: "🏦", Income: "💰", Housing: "🏠",
  Education: "📚", Transfer: "↔️", Other: "📦",
};

const SAMPLE_SMS = `GTBank: Acct **1234 debited N12,400.00 on 22-Apr-2026. Desc: POS/SHOPRITE IKEJA. Bal: N387,000.00
Kuda: Your account has been credited with NGN450,000.00 on 20-Apr-2026. Narration: Salary April 2026. Balance: NGN850,000.00
Access Bank: Debit Alert! Amount: NGN2,800.00. Desc: Bolt Technologies. Date: 22/04/2026. Avail Bal: NGN384,200.00
MTN: Your airtime purchase of N1,000 was successful on 21-Apr-2026. Thank you for using MTN.
GTBank: Acct **1234 debited N4,200.00 on 19-Apr-2026. Desc: NETFLIX. Bal: N380,000.00`;

export default function SMSPanel({ onImport }) {
  const [smsText, setSmsText] = useState("");
  const [parsed, setParsed] = useState([]);
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState("input"); // input | review | done
  const [importCount, setImportCount] = useState(0);

  function handleParse() {
    if (!smsText.trim()) return;
    const results = parseSMS(smsText);
    if (results.length === 0) {
      setParsed([{ _error: true, raw: smsText }]);
    } else {
      setParsed(results);
      setSelected(results.map((_, i) => i));
    }
    setStep("review");
  }

  function toggleSelect(i) {
    setSelected(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  }

  function handleImport() {
    const toImport = parsed.filter((_, i) => selected.includes(i) && !parsed[i]._error);
    onImport(toImport);
    setImportCount(toImport.length);
    setStep("done");
  }

  function reset() {
    setSmsText("");
    setParsed([]);
    setSelected([]);
    setStep("input");
    setImportCount(0);
  }

  function updateField(i, key, value) {
    setParsed(prev => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [key]: value };
      return updated;
    });
  }

  return (
    <div className="fade-in" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
        .slide-in { animation: slideIn 0.25s ease; }
        .sms-textarea { background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 16px; color: ${COLORS.text}; font-size: 13px; outline: none; width: 100%; resize: vertical; min-height: 180px; font-family: 'DM Mono', monospace; line-height: 1.6; transition: border-color 0.2s; }
        .sms-textarea:focus { border-color: ${COLORS.accent}66; }
        .sms-textarea::placeholder { color: ${COLORS.muted}; }
        .tx-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid ${COLORS.border}; transition: background 0.15s; cursor: pointer; }
        .tx-row:hover { background: ${COLORS.surface}; }
        .tx-row:last-child { border-bottom: none; }
        .tx-checkbox { width: 18px; height: 18px; border-radius: 5px; border: 2px solid ${COLORS.border}; background: ${COLORS.surface}; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .tx-checkbox.checked { background: ${COLORS.accent}; border-color: ${COLORS.accent}; }
        .inline-select { background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; border-radius: 6px; padding: 3px 8px; color: ${COLORS.text}; font-size: 12px; outline: none; cursor: pointer; }
        .btn-parse { background: linear-gradient(135deg, ${COLORS.accent}, #0099BB); color: #000; border: none; border-radius: 12px; padding: 14px 28px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.2s; font-family: inherit; width: 100%; }
        .btn-parse:hover { opacity: 0.85; transform: translateY(-1px); }
        .btn-import { background: linear-gradient(135deg, ${COLORS.green}, #00BB77); color: #000; border: none; border-radius: 12px; padding: 14px 28px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.2s; font-family: inherit; }
        .btn-import:hover { opacity: 0.85; transform: translateY(-1px); }
        .btn-ghost { background: ${COLORS.border}; color: ${COLORS.text}; border: none; border-radius: 12px; padding: 14px 28px; font-weight: 500; cursor: pointer; font-size: 14px; transition: all 0.2s; font-family: inherit; }
        .btn-ghost:hover { background: #2A3A55; }
        .bank-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: ${COLORS.border}; color: ${COLORS.muted}; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>📱 SMS Import</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
          Paste your bank SMS alerts and we'll automatically extract all transactions
        </p>
      </div>

      {/* Supported Banks */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {["GTBank", "Access Bank", "Kuda", "OPay", "Moniepoint", "PalmPay", "Zenith", "First Bank", "UBA", "Sterling"].map(b => (
          <span key={b} className="bank-chip">✓ {b}</span>
        ))}
      </div>

      {/* STEP 1: Input */}
      {step === "input" && (
        <div className="fade-in">
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Paste SMS Alerts</div>
              <button
                onClick={() => setSmsText(SAMPLE_SMS)}
                style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 12px", color: COLORS.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
              >
                Try sample SMS
              </button>
            </div>
            <textarea
              className="sms-textarea"
              placeholder={`Paste one or multiple bank SMS alerts here. For example:\n\nGTBank: Acct **1234 debited N12,400.00 on 22-Apr-2026. Desc: POS/SHOPRITE IKEJA.\nKuda: Your account has been credited with NGN450,000.00. Narration: Salary April 2026.`}
              value={smsText}
              onChange={e => setSmsText(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.muted }}>
                {smsText.split("\n").filter(l => l.trim()).length} lines detected
              </span>
              {smsText && (
                <button onClick={() => setSmsText("")} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <button className="btn-parse" onClick={handleParse} disabled={!smsText.trim()}>
            🔍 Parse & Extract Transactions →
          </button>

          {/* How to use */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: COLORS.muted }}>HOW TO USE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { step: "1", text: "Open your SMS app on your phone", icon: "📱" },
                { step: "2", text: "Find your bank debit/credit alert messages", icon: "🔍" },
                { step: "3", text: "Copy the SMS text and paste it above", icon: "📋" },
                { step: "4", text: "We extract all transactions automatically", icon: "⚡" },
                { step: "5", text: "Review and confirm before importing", icon: "✅" },
              ].map(item => (
                <div key={item.step} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{item.icon}</div>
                  <span style={{ color: COLORS.muted }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Review */}
      {step === "review" && (
        <div className="fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {parsed.filter(p => !p._error).length} transaction{parsed.filter(p => !p._error).length !== 1 ? "s" : ""} found
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
                Review and edit before importing. {selected.length} selected.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" onClick={reset} style={{ padding: "10px 18px", fontSize: 13 }}>← Back</button>
              <button
                onClick={() => setSelected(parsed.map((_, i) => i))}
                style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
              >
                Select All
              </button>
            </div>
          </div>

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            {parsed.map((tx, i) => (
              tx._error ? (
                <div key={i} style={{ padding: "16px 20px", background: COLORS.red + "11", border: `1px solid ${COLORS.red}33` }}>
                  <div style={{ fontSize: 13, color: COLORS.red, marginBottom: 4 }}>⚠️ Could not parse this SMS</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "monospace" }}>{tx.raw?.substring(0, 100)}...</div>
                </div>
              ) : (
                <div key={i} className="tx-row slide-in" onClick={() => toggleSelect(i)}>
                  <div className={`tx-checkbox ${selected.includes(i) ? "checked" : ""}`}>
                    {selected.includes(i) && <span style={{ color: "#000", fontSize: 12 }}>✓</span>}
                  </div>

                  <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.type === "credit" ? COLORS.green + "22" : COLORS.orange + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {CAT_ICONS[tx.cat] || "📦"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{tx.desc}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="bank-chip">📱 {tx.bank || "SMS"}</span>
                      <span style={{ fontSize: 11, color: COLORS.muted }}>{tx.date}</span>
                      <select
                        className="inline-select"
                        value={tx.cat}
                        onChange={e => { e.stopPropagation(); updateField(i, "cat", e.target.value); }}
                        onClick={e => e.stopPropagation()}
                      >
                        {["Food", "Transport", "Entertainment", "Utilities", "Health", "Savings", "Income", "Housing", "Education", "Transfer", "Other"].map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tx.type === "credit" ? COLORS.green : COLORS.text }}>
                      {tx.type === "credit" ? "+" : "-"}₦{tx.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: tx.type === "credit" ? COLORS.green : COLORS.orange, marginTop: 2 }}>
                      {tx.type === "credit" ? "Credit" : "Debit"}
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-ghost" onClick={reset}>← Try Again</button>
            <button
              className="btn-import"
              onClick={handleImport}
              disabled={selected.length === 0}
              style={{ flex: 1, opacity: selected.length === 0 ? 0.4 : 1 }}
            >
              ✅ Import {selected.length} Transaction{selected.length !== 1 ? "s" : ""} →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Done */}
      {step === "done" && (
        <div className="fade-in" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
            {importCount} Transaction{importCount !== 1 ? "s" : ""} Imported!
          </div>
          <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Your dashboard, Broke Clock, and FinScore have all been updated with the new data. ARIA now knows about these transactions too.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn-ghost" onClick={reset}>Import More SMS</button>
            <button className="btn-parse" style={{ width: "auto", padding: "14px 28px" }} onClick={() => onImport([], true)}>
              View Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}