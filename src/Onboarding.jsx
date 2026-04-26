import { useState } from "react";

const C = {
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

const BANKS = [
  "GTBank", "Access Bank", "Zenith Bank", "First Bank",
  "Kuda", "OPay", "Moniepoint", "PalmPay",
  "Sterling Bank", "UBA", "Fidelity Bank", "FCMB",
];

const SPEND_CATS = [
  { name: "Food & Dining", icon: "🍔" },
  { name: "Transport", icon: "🚗" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Utilities", icon: "💡" },
  { name: "Health", icon: "💊" },
  { name: "Shopping", icon: "🛍️" },
  { name: "Education", icon: "📚" },
  { name: "Housing/Rent", icon: "🏠" },
  { name: "Savings", icon: "🏦" },
  { name: "Business", icon: "💼" },
];

const PERSONALITY_QUESTIONS = [
  {
    q: "When you get paid, what do you usually do first?",
    options: [
      { text: "Spend on things I've been wanting", type: "impulsive" },
      { text: "Pay bills then see what's left", type: "reactive" },
      { text: "Set aside savings first, then budget", type: "disciplined" },
      { text: "Invest a portion immediately", type: "investor" },
    ],
  },
  {
    q: "How do you feel about checking your bank balance?",
    options: [
      { text: "I avoid it — ignorance is bliss", type: "impulsive" },
      { text: "I check when I need to spend", type: "reactive" },
      { text: "I check it daily", type: "disciplined" },
      { text: "I track it in a spreadsheet too", type: "investor" },
    ],
  },
  {
    q: "Your friend invites you on a surprise trip next week. It costs ₦80,000. You:",
    options: [
      { text: "Book immediately, figure out money later", type: "impulsive" },
      { text: "Go if I can afford it this month", type: "reactive" },
      { text: "Check my savings goal first", type: "disciplined" },
      { text: "Decline — it's not in the budget", type: "investor" },
    ],
  },
];

const PERSONALITY_PROFILES = {
  impulsive: { label: "The Spontaneous Spender", emoji: "⚡", desc: "You live in the moment. ARIA will help you enjoy life while building financial safety nets.", color: C.orange },
  reactive: { label: "The Reactive Manager", emoji: "🔄", desc: "You handle money as it comes. ARIA will help you get ahead of expenses before they hit.", color: C.yellow },
  disciplined: { label: "The Disciplined Planner", emoji: "📐", desc: "You think before you spend. ARIA will help you optimize your already-solid habits.", color: C.green },
  investor: { label: "The Growth Seeker", emoji: "📈", desc: "You think long-term. ARIA will help you find the best opportunities for your money.", color: C.accent },
};

const STEPS = ["Welcome", "Profile", "Income", "Banks", "Categories", "Goals", "Personality", "Complete"];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: "", email: "",
    monthlyIncome: "", incomeType: "salary", incomeDay: "25",
    banks: [],
    spendCategories: [],
    savingsGoals: [{ name: "", target: "", deadline: "" }],
    personality: {},
    personalityAnswers: [],
    personalityResult: null,
  });
  const [errors, setErrors] = useState({});

  function updateProfile(key, value) {
    setProfile(p => ({ ...p, [key]: value }));
  }

  function toggleBank(bank) {
    setProfile(p => ({
      ...p,
      banks: p.banks.includes(bank) ? p.banks.filter(b => b !== bank) : [...p.banks, bank],
    }));
  }

  function toggleCat(cat) {
    setProfile(p => ({
      ...p,
      spendCategories: p.spendCategories.includes(cat)
        ? p.spendCategories.filter(c => c !== cat)
        : [...p.spendCategories, cat],
    }));
  }

  function addGoal() {
    setProfile(p => ({ ...p, savingsGoals: [...p.savingsGoals, { name: "", target: "", deadline: "" }] }));
  }

  function updateGoal(i, key, value) {
    setProfile(p => {
      const goals = [...p.savingsGoals];
      goals[i] = { ...goals[i], [key]: value };
      return { ...p, savingsGoals: goals };
    });
  }

  function removeGoal(i) {
    setProfile(p => ({ ...p, savingsGoals: p.savingsGoals.filter((_, idx) => idx !== i) }));
  }

  function answerPersonality(qIndex, type) {
    const answers = [...profile.personalityAnswers];
    answers[qIndex] = type;
    const newProfile = { ...profile, personalityAnswers: answers };

    if (answers.length === PERSONALITY_QUESTIONS.length) {
      const counts = answers.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
      const result = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      newProfile.personalityResult = result;
    }
    setProfile(newProfile);
  }

  function validateStep() {
    const e = {};
    if (step === 1) {
      if (!profile.name.trim()) e.name = "Name is required";
    }
    if (step === 2) {
      if (!profile.monthlyIncome || isNaN(profile.monthlyIncome)) e.income = "Enter a valid income";
    }
    if (step === 3) {
      if (profile.banks.length === 0) e.banks = "Select at least one bank";
    }
    if (step === 4) {
      if (profile.spendCategories.length === 0) e.cats = "Select at least one category";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep()) return;
    if (step === STEPS.length - 1) {
      const data = {
        ...profile,
        balance: 0,
        transactions: [],
        totalSpend: 0,
        totalSaved: 0,
        finScore: 50,
        setupComplete: true,
        setupDate: new Date().toISOString(),
      };
      localStorage.setItem("finsight_user", JSON.stringify(data));
      onComplete(data);
    } else {
      setStep(s => s + 1);
    }
  }

  function back() { setStep(s => Math.max(0, s - 1)); }

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .ob-input { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 16px; color: ${C.text}; font-size: 14px; outline: none; width: 100%; font-family: inherit; transition: border-color 0.2s; }
        .ob-input:focus { border-color: ${C.accent}66; }
        .ob-select { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 16px; color: ${C.text}; font-size: 14px; outline: none; width: 100%; font-family: inherit; }
        .ob-btn { background: linear-gradient(135deg, ${C.accent}, #0099BB); color: #000; border: none; border-radius: 12px; padding: 14px 32px; font-weight: 700; cursor: pointer; font-size: 15px; transition: all 0.2s; font-family: inherit; }
        .ob-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .ob-btn-ghost { background: ${C.border}; color: ${C.text}; border: none; border-radius: 12px; padding: 14px 32px; font-weight: 500; cursor: pointer; font-size: 15px; transition: all 0.2s; font-family: inherit; }
        .ob-btn-ghost:hover { background: #2A3A55; }
        .chip { padding: 8px 14px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.muted}; }
        .chip:hover { border-color: ${C.accent}66; color: ${C.text}; }
        .chip.selected { background: ${C.accent}22; border-color: ${C.accent}; color: ${C.accent}; }
        .personality-opt { padding: 14px 18px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.surface}; cursor: pointer; transition: all 0.2s; font-size: 14px; color: ${C.text}; text-align: left; width: 100%; font-family: inherit; }
        .personality-opt:hover { border-color: ${C.accent}66; background: ${C.card}; }
        .personality-opt.selected { border-color: ${C.accent}; background: ${C.accent}22; color: ${C.accent}; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease; }
        .error-msg { color: ${C.red}; font-size: 12px; margin-top: 4px; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Progress bar */}
        {step > 0 && step < STEPS.length - 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: C.muted }}>
              <span>Step {step} of {STEPS.length - 2}</span>
              <span>{STEPS[step]}</span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.green})`, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        <div className="fade-up" key={step} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36 }}>

          {/* STEP 0: Welcome */}
          {step === 0 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>💡</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, background: `linear-gradient(135deg, ${C.accent}, ${C.green})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>
                Welcome to FinSight
              </div>
              <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
                Your personal financial OS. We'll take 2 minutes to set up your profile so ARIA can give you truly personalized advice.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
                {["Smart spending tracking", "AI financial advice", "Investment suggestions", "Broke Clock prediction"].map((f, i) => (
                  <span key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: C.muted }}>✓ {f}</span>
                ))}
              </div>
              <button className="ob-btn" onClick={next} style={{ width: "100%" }}>Get Started →</button>
            </div>
          )}

          {/* STEP 1: Profile */}
          {step === 1 && (
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Tell us about yourself</div>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>This personalizes your entire FinSight experience</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Full Name</label>
                  <input className="ob-input" placeholder="e.g. Kenechukwu Victor" value={profile.name} onChange={e => updateProfile("name", e.target.value)} />
                  {errors.name && <div className="error-msg">{errors.name}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Email (optional)</label>
                  <input className="ob-input" placeholder="your@email.com" type="email" value={profile.email} onChange={e => updateProfile("email", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Income */}
          {step === 2 && (
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Your Income</div>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Used to calculate your savings rate and Broke Clock</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Monthly Income (₦)</label>
                  <input className="ob-input" placeholder="e.g. 450000" type="number" value={profile.monthlyIncome} onChange={e => updateProfile("monthlyIncome", e.target.value)} />
                  {errors.income && <div className="error-msg">{errors.income}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Income Type</label>
                  <select className="ob-select" value={profile.incomeType} onChange={e => updateProfile("incomeType", e.target.value)}>
                    <option value="salary">Salary (Fixed monthly)</option>
                    <option value="freelance">Freelance (Variable)</option>
                    <option value="business">Business Owner</option>
                    <option value="mixed">Mixed Income</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Salary Day (day of month)</label>
                  <select className="ob-select" value={profile.incomeDay} onChange={e => updateProfile("incomeDay", e.target.value)}>
                    {["1", "5", "10", "15", "20", "25", "28", "30", "Variable"].map(d => (
                      <option key={d} value={d}>{d === "Variable" ? "Variable / Irregular" : `${d}th of every month`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Banks */}
          {step === 3 && (
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Your Banks</div>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Select all banks you use — we'll parse their SMS and statements</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {BANKS.map(bank => (
                  <button key={bank} className={`chip ${profile.banks.includes(bank) ? "selected" : ""}`} onClick={() => toggleBank(bank)}>{bank}</button>
                ))}
              </div>
              {errors.banks && <div className="error-msg" style={{ marginTop: 12 }}>{errors.banks}</div>}
            </div>
          )}

          {/* STEP 4: Spending Categories */}
          {step === 4 && (
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Spending Categories</div>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>What do you typically spend on? Select all that apply</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {SPEND_CATS.map(cat => (
                  <button key={cat.name} className={`chip ${profile.spendCategories.includes(cat.name) ? "selected" : ""}`} onClick={() => toggleCat(cat.name)}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
              {errors.cats && <div className="error-msg" style={{ marginTop: 12 }}>{errors.cats}</div>}
            </div>
          )}

          {/* STEP 5: Savings Goals */}
          {step === 5 && (
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Savings Goals</div>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>What are you saving towards? You can add more later</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {profile.savingsGoals.map((goal, i) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: C.muted }}>Goal {i + 1}</span>
                      {i > 0 && <button onClick={() => removeGoal(i)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 18 }}>×</button>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <input className="ob-input" placeholder="Goal name (e.g. Emergency Fund)" value={goal.name} onChange={e => updateGoal(i, "name", e.target.value)} />
                      <input className="ob-input" placeholder="Target amount (₦)" type="number" value={goal.target} onChange={e => updateGoal(i, "target", e.target.value)} />
                      <input className="ob-input" placeholder="Target date (optional)" type="month" value={goal.deadline} onChange={e => updateGoal(i, "deadline", e.target.value)} style={{ colorScheme: "dark" }} />
                    </div>
                  </div>
                ))}
                <button onClick={addGoal} style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: 12, padding: 14, color: C.muted, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
                  + Add another goal
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Personality */}
          {step === 6 && (
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Financial Personality</div>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>3 quick questions to personalize ARIA's advice style</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {PERSONALITY_QUESTIONS.map((pq, qi) => (
                  <div key={qi}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.text }}>{qi + 1}. {pq.q}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pq.options.map((opt, oi) => (
                        <button key={oi} className={`personality-opt ${profile.personalityAnswers[qi] === opt.type ? "selected" : ""}`} onClick={() => answerPersonality(qi, opt.type)}>
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: Complete */}
          {step === 7 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>
                {profile.personalityResult ? PERSONALITY_PROFILES[profile.personalityResult]?.emoji : "🎉"}
              </div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
                You're all set, {profile.name.split(" ")[0]}!
              </div>
              {profile.personalityResult && (
                <div style={{ background: C.surface, borderRadius: 14, padding: 20, marginBottom: 24, border: `1px solid ${PERSONALITY_PROFILES[profile.personalityResult]?.color}44` }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Your Financial Personality</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: PERSONALITY_PROFILES[profile.personalityResult]?.color, marginBottom: 8 }}>
                    {PERSONALITY_PROFILES[profile.personalityResult]?.label}
                  </div>
                  <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                    {PERSONALITY_PROFILES[profile.personalityResult]?.desc}
                  </p>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                {[
                  `Income: ₦${parseInt(profile.monthlyIncome || 0).toLocaleString()}/month`,
                  `Banks: ${profile.banks.join(", ")}`,
                  `Goals: ${profile.savingsGoals.filter(g => g.name).length} savings goal(s) set`,
                  `Categories: ${profile.spendCategories.length} spending categories tracked`,
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted, background: C.surface, borderRadius: 8, padding: "8px 14px" }}>
                    <span style={{ color: C.green }}>✓</span> {item}
                  </div>
                ))}
              </div>
              <button className="ob-btn" onClick={next} style={{ width: "100%" }}>
                Launch FinSight →
              </button>
            </div>
          )}

          {/* Navigation */}
          {step > 0 && step < STEPS.length - 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
              <button className="ob-btn-ghost" onClick={back}>← Back</button>
              <button className="ob-btn" onClick={next}>
                {step === STEPS.length - 2 ? "Finish Setup →" : "Continue →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
