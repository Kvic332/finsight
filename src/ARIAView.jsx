import { useState, useEffect, useRef } from "react";

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

const SAMPLE_CONTEXT = {
  balance: 387000,
  income: 450000,
  totalSpend: 74500,
  totalSaved: 30000,
  daysLeft: 78,
  finScore: 67,
  transactions: [
    { desc: "Shoprite - Groceries", amount: 12400, type: "debit", cat: "Food", date: "2026-04-22" },
    { desc: "Salary Credit - Renmoney", amount: 450000, type: "credit", cat: "Income", date: "2026-04-20" },
    { desc: "Bolt Ride", amount: 2800, type: "debit", cat: "Transport", date: "2026-04-22" },
    { desc: "MTN Airtime", amount: 1000, type: "debit", cat: "Utilities", date: "2026-04-21" },
    { desc: "Netflix Subscription", amount: 4200, type: "debit", cat: "Entertainment", date: "2026-04-19" },
    { desc: "Eatright Restaurant", amount: 8500, type: "debit", cat: "Food", date: "2026-04-18" },
    { desc: "DSTV Monthly", amount: 6800, type: "debit", cat: "Entertainment", date: "2026-04-17" },
    { desc: "Kuda Transfer - Savings", amount: 30000, type: "debit", cat: "Savings", date: "2026-04-16" },
    { desc: "Pharmacy - Drugs", amount: 3200, type: "debit", cat: "Health", date: "2026-04-15" },
    { desc: "Uber Eats", amount: 5600, type: "debit", cat: "Food", date: "2026-04-14" },
  ],
  savingsGoals: [
    { name: "Emergency Fund", target: 150000, saved: 30000 },
    { name: "New Laptop", target: 400000, saved: 85000 },
    { name: "Vacation 2026", target: 200000, saved: 45000 },
  ],
};

// ── Paste your Anthropic API key here ───────────────────────────────────────
const ANTHROPIC_API_KEY = "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";
// ────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx) {
  const categoryTotals = ctx.transactions
    .filter(t => t.type === "debit")
    .reduce((acc, t) => {
      acc[t.cat] = (acc[t.cat] || 0) + t.amount;
      return acc;
    }, {});

  return `You are ARIA, an intelligent personal finance AI companion built into FinSight — a Nigerian personal finance app. You are warm, direct, and financially sharp. You speak conversationally, like a trusted friend who happens to be a financial expert.

KEY RULES:
- Always use Nigerian Naira (₦) for amounts
- Be concise — max 3-4 sentences per response unless the user asks for detail
- Give specific, actionable advice based on the real data below
- Reference actual numbers from their financial data
- Understand Nigerian context: mention Cowrywise, Piggyvest, PalmPay, Kuda, GTBank, etc. where relevant
- Never give generic advice — always tie it to their actual situation
- If they ask something unrelated to finance, gently redirect back
- Be encouraging, not preachy — one suggestion max per response
- Understand Nigerian informal terms: "ajo", "esusu", "thrift", "hustle", "side income"

USER'S CURRENT FINANCIAL DATA:
- Account Balance: ₦${ctx.balance.toLocaleString()}
- Monthly Income: ₦${ctx.income.toLocaleString()}
- Total Spent This Month: ₦${ctx.totalSpend.toLocaleString()}
- Total Saved This Month: ₦${ctx.totalSaved.toLocaleString()}
- Savings Rate: ${((ctx.totalSaved / ctx.income) * 100).toFixed(1)}% (recommended: 20%)
- FinScore: ${ctx.finScore}/100
- Days Until Balance Hits Zero (at current rate): ${ctx.daysLeft} days

SPENDING BY CATEGORY THIS MONTH:
${Object.entries(categoryTotals).map(([cat, amt]) => `- ${cat}: ₦${amt.toLocaleString()}`).join("\n")}

RECENT TRANSACTIONS:
${ctx.transactions.slice(0, 6).map(t => `- ${t.date}: ${t.desc} — ₦${t.amount.toLocaleString()} (${t.type})`).join("\n")}

SAVINGS GOALS:
${ctx.savingsGoals.map(g => `- ${g.name}: ₦${g.saved.toLocaleString()} / ₦${g.target.toLocaleString()} (${Math.round((g.saved / g.target) * 100)}%)`).join("\n")}

Respond as ARIA. Be helpful, specific, and human.`;
}

async function callARIA(messages, financialContext) {
  const systemPrompt = buildSystemPrompt(financialContext);
  const response = await fetch("/api/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages,
    }),
  });
  const data = await response.json();
  if (data.content && data.content[0]) {
    return data.content[0].text;
  }
  throw new Error("No response from ARIA");
}

const QUICK_QUESTIONS = [
  "How long will my money last?",
  "How much did I spend on food?",
  "Where should I invest my savings?",
  "How can I improve my FinScore?",
  "Am I saving enough?",
  "What's my biggest spending problem?",
];

export default function ARIAView({ financialContext = SAMPLE_CONTEXT }) {
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    const greeting = {
      role: "aria",
      text: `Hey! I'm ARIA, your financial companion. I can see your balance is ₦${financialContext.balance.toLocaleString()} and you have ${financialContext.daysLeft} days before you run out at your current rate. What would you like to work on today?`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([greeting]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function speakText(text) {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const clean = text.replace(/₦/g, "Naira ").replace(/[*_#]/g, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Female") || v.name.includes("Samantha") ||
      v.name.includes("Google UK English Female") || v.name.includes("Karen")
    );
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synthRef.current.speak(utterance);
  }

  function stopSpeaking() {
    synthRef.current?.cancel();
    setSpeaking(false);
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    const userText = text.trim();
    setInput("");
    setError(null);
    const userMsg = {
      role: "aria-user",
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    const newHistory = [...chatHistory, { role: "user", content: userText }];
    try {
      const reply = await callARIA(newHistory, financialContext);
      const ariaMsg = {
        role: "aria",
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, ariaMsg]);
      setChatHistory([...newHistory, { role: "assistant", content: reply }]);
      speakText(reply);
    } catch (err) {
      setError("ARIA is having trouble connecting. Please try again.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input not supported in this browser. Try Chrome.");
      return;
    }
    stopSpeaking();
    const rec = new SR();
    rec.lang = "en-NG";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setError("Couldn't hear you. Try again."); };
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setTimeout(() => sendMessage(transcript), 300);
    };
    rec.start();
    recognitionRef.current = rec;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.95); } }
        @keyframes wave { 0%,100% { height: 6px; } 50% { height: 20px; } }
        .msg { animation: fadeUp 0.25s ease; }
        .listening-ring { animation: pulse 0.8s infinite; }
        .wave-bar { animation: wave 0.6s ease-in-out infinite; background: ${COLORS.accent}; width: 3px; border-radius: 2px; }
        .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .wave-bar:nth-child(4) { animation-delay: 0.3s; }
        .quick-q { background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 7px 14px; font-size: 12px; color: ${COLORS.muted}; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .quick-q:hover { border-color: ${COLORS.accent}66; color: ${COLORS.text}; background: ${COLORS.card}; }
        .send-btn { background: linear-gradient(135deg, ${COLORS.accent}, #0099BB); color: #000; border: none; border-radius: 12px; padding: 12px 22px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.2s; flex-shrink: 0; }
        .send-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .voice-btn { width: 48px; height: 48px; border-radius: 50%; border: 2px solid ${COLORS.border}; background: ${COLORS.surface}; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: all 0.2s; flex-shrink: 0; }
        .voice-btn:hover { border-color: ${COLORS.accent}; background: ${COLORS.card}; }
        .chat-input { background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 12px 16px; color: ${COLORS.text}; font-size: 14px; outline: none; flex: 1; font-family: inherit; resize: none; transition: border-color 0.2s; }
        .chat-input:focus { border-color: ${COLORS.accent}66; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🤖</div>
            <div style={{ position: "absolute", bottom: 2, right: 2, width: 10, height: 10, borderRadius: "50%", background: COLORS.green, border: `2px solid ${COLORS.bg}` }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ARIA</div>
            <div style={{ fontSize: 12, color: COLORS.green, display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.green }} />
              AI Financial Companion — Online
            </div>
          </div>
          {speaking && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 3, height: 28, padding: "4px 12px", background: COLORS.card, borderRadius: 20, border: `1px solid ${COLORS.accent}33` }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />)}
              <span style={{ fontSize: 11, color: COLORS.accent, marginLeft: 6 }}>Speaking...</span>
              <button onClick={stopSpeaking} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 14, marginLeft: 4 }}>✕</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {[
            { label: "Balance", value: `₦${financialContext.balance.toLocaleString()}`, color: COLORS.accent },
            { label: "Spent", value: `₦${financialContext.totalSpend.toLocaleString()}`, color: COLORS.orange },
            { label: "Saved", value: `₦${financialContext.totalSaved.toLocaleString()}`, color: COLORS.green },
            { label: "Days Left", value: `${financialContext.daysLeft}d`, color: financialContext.daysLeft < 20 ? COLORS.red : COLORS.yellow },
            { label: "FinScore", value: `${financialContext.finScore}`, color: COLORS.purple },
          ].map((s, i) => (
            <div key={i} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "5px 12px", fontSize: 12 }}>
              <span style={{ color: COLORS.muted }}>{s.label}: </span>
              <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4, paddingBottom: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} className="msg" style={{ display: "flex", justifyContent: msg.role === "aria-user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
            {msg.role === "aria" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🤖</div>
            )}
            <div style={{ maxWidth: "72%" }}>
              <div style={{
                padding: "12px 16px",
                borderRadius: msg.role === "aria-user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: msg.role === "aria-user" ? `linear-gradient(135deg, ${COLORS.accent}33, ${COLORS.purple}22)` : COLORS.card,
                border: `1px solid ${msg.role === "aria-user" ? COLORS.accent + "44" : COLORS.border}`,
                fontSize: 14, lineHeight: 1.65, color: COLORS.text,
              }}>
                {msg.text}
              </div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4, textAlign: msg.role === "aria-user" ? "right" : "left", paddingLeft: msg.role === "aria" ? 4 : 0 }}>
                {msg.time}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg" style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "18px 18px 18px 4px", padding: "14px 18px", display: "flex", gap: 6, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        {error && (
          <div style={{ background: COLORS.red + "22", border: `1px solid ${COLORS.red}44`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.red, textAlign: "center" }}>
            {error}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ overflowX: "auto", display: "flex", gap: 8, paddingBottom: 10, paddingTop: 4, scrollbarWidth: "none" }}>
        {QUICK_QUESTIONS.map((q, i) => (
          <button key={i} className="quick-q" onClick={() => sendMessage(q)} disabled={loading}>{q}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className={`voice-btn ${listening ? "listening-ring" : ""}`}
          onClick={listening ? () => { recognitionRef.current?.stop(); setListening(false); } : startVoice}
          style={{ borderColor: listening ? COLORS.red : COLORS.border, background: listening ? COLORS.red + "22" : COLORS.surface }}
        >
          {listening ? "⏹" : "🎙️"}
        </button>
        <input
          className="chat-input"
          placeholder={listening ? "Listening..." : "Ask ARIA anything about your money..."}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          disabled={loading}
        />
        <button className="send-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          {loading ? "..." : "Send →"}
        </button>
      </div>
    </div>
  );
}
