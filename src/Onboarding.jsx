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

const ALL_BANKS = [
  // Tier 1 Commercial Banks
  { name: "GTBank", category: "Commercial" },
  { name: "Access Bank", category: "Commercial" },
  { name: "Zenith Bank", category: "Commercial" },
  { name: "First Bank", category: "Commercial" },
  { name: "UBA", category: "Commercial" },
  { name: "Fidelity Bank", category: "Commercial" },
  { name: "FCMB", category: "Commercial" },
  { name: "Sterling Bank", category: "Commercial" },
  { name: "Union Bank", category: "Commercial" },
  { name: "Ecobank", category: "Commercial" },
  { name: "Stanbic IBTC", category: "Commercial" },
  { name: "Standard Chartered", category: "Commercial" },
  { name: "Citibank", category: "Commercial" },
  { name: "Heritage Bank", category: "Commercial" },
  { name: "Keystone Bank", category: "Commercial" },
  { name: "Polaris Bank", category: "Commercial" },
  { name: "Wema Bank", category: "Commercial" },
  { name: "Unity Bank", category: "Commercial" },
  { name: "Jaiz Bank", category: "Commercial" },
  { name: "Globus Bank", category: "Commercial" },
  { name: "Titan Trust Bank", category: "Commercial" },
  { name: "Parallex Bank", category: "Commercial" },
  { name: "Optimus Bank", category: "Commercial" },
  { name: "Signature Bank", category: "Commercial" },
  { name: "Coronation Bank", category: "Commercial" },
  { name: "Providus Bank", category: "Commercial" },
  { name: "Suntrust Bank", category: "Commercial" },
  { name: "Nova Bank", category: "Commercial" },
  // Fintechs & Digital Banks
  { name: "Kuda", category: "Fintech" },
  { name: "OPay", category: "Fintech" },
  { name: "Moniepoint", category: "Fintech" },
  { name: "PalmPay", category: "Fintech" },
  { name: "Carbon", category: "Fintech" },
  { name: "FairMoney", category: "Fintech" },
  { name: "VFD Bank", category: "Fintech" },
  { name: "Rubies Bank", category: "Fintech" },
  { name: "Sparkle", category: "Fintech" },
  { name: "Mint Finex", category: "Fintech" },
  { name: "PiggyVest", category: "Fintech" },
  { name: "Cowrywise", category: "Fintech" },
  { name: "Risevest", category: "Fintech" },
  { name: "Bamboo", category: "Fintech" },
  { name: "Chaka", category: "Fintech" },
  { name: "Trove", category: "Fintech" },
  { name: "Chipper Cash", category: "Fintech" },
  { name: "Paga", category: "Fintech" },
  { name: "Eyowo", category: "Fintech" },
  { name: "Nomba", category: "Fintech" },
  { name: "Cleva", category: "Fintech" },
  { name: "Grey", category: "Fintech" },
  { name: "Raenest", category: "Fintech" },
  { name: "Leatherback", category: "Fintech" },
  { name: "Brass", category: "Fintech" },
  { name: "Bumpa", category: "Fintech" },
  { name: "Payaza", category: "Fintech" },
  { name: "MTN MoMo", category: "Fintech" },
  { name: "Airtel Money", category: "Fintech" },
  // Microfinance Banks
  { name: "Renmoney MFB", category: "MFB" },
  { name: "LAPO MFB", category: "MFB" },
  { name: "Accion MFB", category: "MFB" },
  { name: "AB Microfinance", category: "MFB" },
  { name: "NIRSAL MFB", category: "MFB" },
  { name: "Grooming MFB", category: "MFB" },
  { name: "Mkobo MFB", category: "MFB" },
  { name: "Infinity MFB", category: "MFB" },
  { name: "Trustfund MFB", category: "MFB" },
  { name: "Mutual Trust MFB", category: "MFB" },
  { name: "Advans MFB", category: "MFB" },
  { name: "Letshego MFB", category: "MFB" },
  { name: "Seed Capital MFB", category: "MFB" },
  { name: "Bowen MFB", category: "MFB" },
  { name: "Ibile MFB", category: "MFB" },
  { name: "Hackman MFB", category: "MFB" },
  { name: "Richway MFB", category: "MFB" },
  { name: "FSDH Merchant Bank", category: "MFB" },
];

const BANK_CATEGORIES = ["All", "Commercial", "Fintech", "MFB"];

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria 🇳🇬" },
  { code: "+1", country: "USA 🇺🇸" },
  { code: "+44", country: "UK 🇬🇧" },
  { code: "+233", country: "Ghana 🇬🇭" },
  { code: "+27", country: "South Africa 🇿🇦" },
  { code: "+254", country: "Kenya 🇰🇪" },
  { code: "+251", country: "Ethiopia 🇪🇹" },
  { code: "+256", country: "Uganda 🇺🇬" },
  { code: "+255", country: "Tanzania 🇹🇿" },
  { code: "+237", country: "Cameroon 🇨🇲" },
  { code: "+225", country: "Côte d'Ivoire 🇨🇮" },
  { code: "+221", country: "Senegal 🇸🇳" },
  { code: "+212", country: "Morocco 🇲🇦" },
  { code: "+20", country: "Egypt 🇪🇬" },
  { code: "+49", country: "Germany 🇩🇪" },
  { code: "+33", country: "France 🇫🇷" },
  { code: "+31", country: "Netherlands 🇳🇱" },
  { code: "+353", country: "Ireland 🇮🇪" },
  { code: "+1-CA", country: "Canada 🇨🇦" },
  { code: "+61", country: "Australia 🇦🇺" },
  { code: "+971", country: "UAE 🇦🇪" },
  { code: "+966", country: "Saudi Arabia 🇸🇦" },
];

// Generate all days 1-31
const SALARY_DAYS = [
  ...Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const suffix = day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
    return { value: String(day), label: `${day}${suffix} of every month` };
  }),
  { value: "Variable", label: "Variable / Irregular" },
  { value: "LastDay", label: "Last day of the month" },
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
  const [bankFilter, setBankFilter] = useState("All");
  const [bankSearch, setBankSearch] = useState("");
  const [profile, setProfile] = useState({
    name: "", email: "", phone: "", countryCode: "+234",
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
    if (answers.filter(Boolean).length === PERSONALITY_QUESTIONS.length) {
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
      if (profile.phone && !/^\d{7,15}$/.test(profile.phone.replace(/\s/g, ""))) e.phone = "Enter a valid phone number";
    }
    if (step === 2) {
      if (!profile.monthlyIncome || isNaN(profile.monthlyIncome)) e.income = "Enter a valid income amount";
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

  // Filtered banks for display
  const filteredBanks = ALL_BANKS.filter(b => {
    const matchesCategory = bankFilter === "All" || b.category === bankFilter;
    const matchesSearch = b.name.toLowerCase().includes(bankSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
        .chip { padding: 7px 13px; border-radius: 20px; font-size: 12px; cursor: pointer; transition: all 0.2s; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.muted}; }
        .chip:hover { border-color: ${C.accent}66; color: ${C.text}; }
        .chip.selected { background: ${C.accent}22; border-color: ${C.accent}; color: ${C.accent}; }
        .chip.cat-chip { padding: 8px 14px; font-size: 13px; }
        .personality-opt { padding: 14px 18px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.surface}; cursor: pointer; transition: all 0.2s; font-size: 14px; color: ${C.text}; text-align: left; width: 100%; font-family: inherit; }
        .personality-opt:hover { border-color: ${C.accent}66; background: ${C.card}; }
        .personality-opt.selected { border-color: ${C.accent}; background: ${C.accent}22; color: ${C.accent}; }
        .filter-btn { padding: 6px 14px; border-radius: 20px; font-size: 12px; cursor: pointer; border: 1px solid ${C.border}; background: ${C.surface}; color: ${C.muted}; font-family: inherit; transition: all 0.2s; }
        .filter-btn.active { background: ${C.accent}22; border-color: ${C.accent}; color: ${C.accent}; }
        .bank-grid { display: flex; flex-wrap: wrap; gap: 8px; max-height: 280px; overflow-y: auto; padding: 4px 2px; }
        .bank-grid::-webkit-scrollbar { width: 4px; }
        .bank-grid::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease; }
        .error-msg { color: ${C.red}; font-size: 12px; margin-top: 4px; }
        .phone-row { display: flex; gap: 8px; }
        .phone-country { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 14px; color: ${C.text}; font-size: 14px; outline: none; font-family: inherit; flex-shrink: 0; width: 180px; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 580 }}>
        {/* Progress */}
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
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
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
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Full Name *</label>
                  <input className="ob-input" placeholder="e.g. Kenechukwu Victor" value={profile.name} onChange={e => updateProfile("name", e.target.value)} />
                  {errors.name && <div className="error-msg">{errors.name}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Email (optional)</label>
                  <input className="ob-input" placeholder="your@email.com" type="email" value={profile.email} onChange={e => updateProfile("email", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Phone Number (optional)</label>
                  <div className="phone-row">
                    <select className="phone-country" value={profile.countryCode} onChange={e => updateProfile("countryCode", e.target.value)}>
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} {c.country}</option>
                      ))}
                    </select>
                    <input
                      className="ob-input"
                      placeholder="e.g. 08012345678"
                      type="tel"
                      value={profile.phone}
                      onChange={e => updateProfile("phone", e.target.value)}
                    />
                  </div>
                  {errors.phone && <div className="error-msg">{errors.phone}</div>}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Used for SMS alert matching and account recovery</div>
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
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Monthly Income (₦) *</label>
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
                  <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Salary / Payment Day</label>
                  <select className="ob-select" value={profile.incomeDay} onChange={e => updateProfile("incomeDay", e.target.value)}>
                    {SALARY_DAYS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
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
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>Select all banks and fintechs you use — we'll parse their SMS alerts</p>

              {/* Search */}
              <input
                className="ob-input"
                placeholder="🔍 Search banks..."
                value={bankSearch}
                onChange={e => setBankSearch(e.target.value)}
                style={{ marginBottom: 12 }}
              />

              {/* Category filter */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {BANK_CATEGORIES.map(cat => (
                  <button key={cat} className={`filter-btn ${bankFilter === cat ? "active" : ""}`} onClick={() => setBankFilter(cat)}>
                    {cat} {cat !== "All" && `(${ALL_BANKS.filter(b => b.category === cat).length})`}
                  </button>
                ))}
              </div>

              {/* Selected count */}
              {profile.banks.length > 0 && (
                <div style={{ fontSize: 12, color: C.accent, marginBottom: 10 }}>
                  ✓ {profile.banks.length} selected: {profile.banks.slice(0, 3).join(", ")}{profile.banks.length > 3 ? ` +${profile.banks.length - 3} more` : ""}
                </div>
              )}

              <div className="bank-grid">
                {filteredBanks.map(bank => (
                  <button
                    key={bank.name}
                    className={`chip ${profile.banks.includes(bank.name) ? "selected" : ""}`}
                    onClick={() => toggleBank(bank.name)}
                  >
                    {bank.name}
                  </button>
                ))}
                {filteredBanks.length === 0 && (
                  <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>No banks found for "{bankSearch}"</div>
                )}
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
                  <button key={cat.name} className={`chip cat-chip ${profile.spendCategories.includes(cat.name) ? "selected" : ""}`} onClick={() => toggleCat(cat.name)}>
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
                  `Phone: ${profile.countryCode} ${profile.phone || "Not provided"}`,
                  `Banks: ${profile.banks.slice(0, 3).join(", ")}${profile.banks.length > 3 ? ` +${profile.banks.length - 3} more` : ""}`,
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
