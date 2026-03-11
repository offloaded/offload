import { useState, useEffect } from "react";

const NEON_PINK = "#ff2d7b";
const NEON_CYAN = "#00f0ff";
const NEON_YELLOW = "#ffe14d";
const NEON_GREEN = "#39ff14";
const DARK_BG = "#0a0a12";
const GRID_COLOR = "rgba(0, 240, 255, 0.08)";

// Hero chat demo — shows agents doing real work
const heroMessages = [
  { name: "POLITICAL ANALYST", icon: "📰", color: NEON_CYAN, msg: "Your morning briefing is ready. Three items flagged — housing policy shift in the Senate and two state budget implications." },
  { name: "PROJECT MANAGER", icon: "📋", color: NEON_GREEN, msg: "Pulled your Asana data. 4 tasks overdue, 2 blocked. I've drafted a meeting agenda for Friday's leadership sync." },
  { name: "BOOKKEEPER", icon: "💰", color: NEON_YELLOW, msg: "Found 2 new invoices in your email. Created payment tasks with due dates. Your accounts receivable report is updated." },
  { name: "YOU", icon: "👤", color: NEON_PINK, msg: "Save the project status as a report and send me the CEO update draft.", isHuman: true },
];

// Features — the real differentiators
const featureBlocks = [
  { title: "AGENT TEAMS", subtitle: "Collaboration, not just chat.", desc: "Put agents in a team and watch them work together. Each agent stays in their lane — only responding to topics within their expertise. Like a real team, not a noisy group chat.", color: NEON_CYAN, icon: "👥" },
  { title: "REPORTS & TEMPLATES", subtitle: "Work that persists.", desc: "Agents don't just chat — they produce structured reports using templates that encode your thinking frameworks. Risk assessments, scorecards, briefs — all in the format you define.", color: NEON_PINK, icon: "📄" },
  { title: "LIVE EDITING", subtitle: "Collaborate on the document.", desc: "Reports open side-by-side with the chat. Edit directly, click done, and your agent reviews the changes and suggests refinements. Say 'sounds good' and watch it update live.", color: NEON_GREEN, icon: "✏️" },
  { title: "AGENTS THAT LEARN", subtitle: "Your edits make them smarter.", desc: "When you edit an agent's report, those changes are stored. Next time, the agent considers your past feedback. Reports get better over time without retraining any model.", color: NEON_YELLOW, icon: "🧠" },
  { title: "BACKGROUND WORK", subtitle: "Agents that work while you don't.", desc: "Schedule agents to run daily briefings, monitor your email for invoices, or compile weekly digests. They produce reports on a schedule — you just review them.", color: NEON_CYAN, icon: "⏰" },
  { title: "KNOWLEDGE BASE", subtitle: "Ask questions across your documents.", desc: "Upload hundreds of documents and ask questions in plain English. Get trustworthy answers grounded in your actual data, with source references.", color: NEON_PINK, icon: "📚" },
];

// Marketplace agents
const marketplaceAgents = [
  { name: "METRICS ANALYST", icon: "📊", color: NEON_CYAN, desc: "Weekly scorecards and KPI tracking" },
  { name: "CONTENT STRATEGIST", icon: "✍️", color: NEON_PINK, desc: "Content calendars and brand voice" },
  { name: "MEETING PREP", icon: "🎯", color: NEON_GREEN, desc: "Agendas, research, and action items" },
  { name: "LEAD QUALIFIER", icon: "🔥", color: NEON_YELLOW, desc: "Research, score, and draft outreach" },
  { name: "COMPETITOR INTEL", icon: "🔍", color: "#b388ff", desc: "Track competitors and brief you" },
  { name: "RISK FLAGGER", icon: "⚠️", color: "#ff8a65", desc: "Spot emerging risks early" },
  { name: "NUTRITION PLANNER", icon: "🥗", color: NEON_GREEN, desc: "Macro-aligned meal plans" },
  { name: "SOP BUILDER", icon: "📋", color: NEON_CYAN, desc: "Document your processes" },
];

// The workflow loop
const workflowSteps = [
  { num: "01", label: "DEFINE", desc: "Give agents a role, voice, and templates that encode what good looks like", color: NEON_CYAN },
  { num: "02", label: "COLLABORATE", desc: "Work with your agents in teams or DMs — they stay in their lane and produce structured reports", color: NEON_GREEN },
  { num: "03", label: "REFINE", desc: "Edit reports side-by-side with the chat. Your agent reviews changes and suggests improvements", color: NEON_YELLOW },
  { num: "04", label: "LEARN", desc: "Your edits are stored. Next time, agents produce better work. The system gets smarter through use", color: NEON_PINK },
];

// Components
const Scanlines = () => (
  <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)" }} />
);

const GridFloor = () => (
  <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "45%", background: `linear-gradient(to bottom, transparent 0%, ${DARK_BG} 100%), repeating-linear-gradient(90deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px), repeating-linear-gradient(0deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px)`, transform: "perspective(400px) rotateX(45deg)", transformOrigin: "bottom center", opacity: 0.6 }} />
);

const GlowText = ({ children, color = NEON_CYAN, size = "1rem", delay = 0, style = {} }) => (
  <span style={{ color, fontWeight: 700, fontSize: size, textShadow: `0 0 7px ${color}, 0 0 20px ${color}, 0 0 40px ${color}80`, animation: `flicker 3s ease-in-out ${delay}s infinite alternate`, ...style }}>{children}</span>
);

const Cursor = ({ color = NEON_CYAN }) => (
  <span style={{ display: "inline-block", width: "3px", height: "1.1em", backgroundColor: color, marginLeft: "4px", verticalAlign: "text-bottom", animation: "blink 1s step-end infinite", boxShadow: `0 0 6px ${color}` }} />
);

const Stars = () => {
  const stars = Array.from({ length: 60 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, size: Math.random() * 2 + 1, delay: Math.random() * 4, duration: Math.random() * 3 + 2 }));
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
      {stars.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.6)", animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite alternate` }} />
      ))}
    </div>
  );
};

const ChatBubble = ({ msg, index }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 600 + index * 500); return () => clearTimeout(t); }, [index]);
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "all 0.5s cubic-bezier(0.22, 1, 0.36, 1)", marginBottom: "12px", flexDirection: msg.isHuman ? "row-reverse" : "row" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `linear-gradient(135deg, ${msg.color}30, ${msg.color}10)`, border: `1px solid ${msg.color}60`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0, boxShadow: `0 0 12px ${msg.color}30` }}>{msg.icon}</div>
      <div style={{ flex: 1, maxWidth: "85%" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: msg.color, marginBottom: "6px", textShadow: `0 0 8px ${msg.color}80`, letterSpacing: "1px", textAlign: msg.isHuman ? "right" : "left" }}>{msg.name}</div>
        <div style={{ background: msg.isHuman ? `${msg.color}15` : "rgba(255,255,255,0.04)", border: `1px solid ${msg.isHuman ? msg.color + "30" : "rgba(255,255,255,0.08)"}`, borderRadius: msg.isHuman ? "12px 0 12px 12px" : "0 12px 12px 12px", padding: "11px 15px", fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{msg.msg}</div>
      </div>
    </div>
  );
};

const FeatureCard = ({ feature }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: hovered ? `linear-gradient(135deg, ${feature.color}08, ${feature.color}04)` : "rgba(255,255,255,0.02)", border: `1px solid ${hovered ? feature.color + "60" : "rgba(255,255,255,0.06)"}`, borderRadius: "2px", padding: "28px 24px", transition: "all 0.4s ease", cursor: "default", position: "relative", overflow: "hidden", boxShadow: hovered ? `0 0 30px ${feature.color}15, inset 0 0 30px ${feature.color}05` : "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "16px", height: "16px", borderTop: `2px solid ${feature.color}`, borderLeft: `2px solid ${feature.color}`, opacity: hovered ? 1 : 0.3, transition: "opacity 0.3s" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "16px", height: "16px", borderBottom: `2px solid ${feature.color}`, borderRight: `2px solid ${feature.color}`, opacity: hovered ? 1 : 0.3, transition: "opacity 0.3s" }} />
      <div style={{ fontSize: "24px", marginBottom: "14px" }}>{feature.icon}</div>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: feature.color, marginBottom: "6px", textShadow: `0 0 10px ${feature.color}80`, letterSpacing: "2px" }}>{feature.title}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "rgba(255,255,255,0.45)", marginBottom: "14px", letterSpacing: "1px" }}>{feature.subtitle}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{feature.desc}</div>
    </div>
  );
};

const WorkflowStep = ({ step }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: "flex", gap: "20px", alignItems: "flex-start", padding: "24px", borderLeft: `2px solid ${hovered ? step.color : "rgba(255,255,255,0.08)"}`, transition: "all 0.3s ease", background: hovered ? `linear-gradient(90deg, ${step.color}06, transparent)` : "transparent" }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "20px", color: step.color, textShadow: `0 0 15px ${step.color}60`, flexShrink: 0, width: "50px" }}>{step.num}</div>
      <div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px", color: step.color, marginBottom: "8px", letterSpacing: "2px", textShadow: `0 0 8px ${step.color}80` }}>{step.label}</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{step.desc}</div>
      </div>
    </div>
  );
};

const MarketplaceMiniCard = ({ agent }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: hovered ? `${agent.color}08` : "rgba(255,255,255,0.02)", border: `1px solid ${hovered ? agent.color + "50" : "rgba(255,255,255,0.06)"}`, borderRadius: "2px", padding: "16px", transition: "all 0.3s", cursor: "default", boxShadow: hovered ? `0 0 20px ${agent.color}15` : "none" }}>
      <div style={{ fontSize: "22px", marginBottom: "10px" }}>{agent.icon}</div>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: agent.color, marginBottom: "6px", letterSpacing: "1px", textShadow: hovered ? `0 0 6px ${agent.color}60` : "none", lineHeight: 1.4 }}>{agent.name}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{agent.desc}</div>
    </div>
  );
};

const ReportEditDemo = () => {
  const [editMode, setEditMode] = useState(false);
  const [agentResponse, setAgentResponse] = useState(false);
  useEffect(() => {
    const cycle = () => {
      setEditMode(false); setAgentResponse(false);
      setTimeout(() => setEditMode(true), 1500);
      setTimeout(() => { setEditMode(false); setAgentResponse(true); }, 4000);
      setTimeout(() => setAgentResponse(false), 7000);
    };
    cycle();
    const interval = setInterval(cycle, 8000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ background: DARK_BG, padding: "16px" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: "12px" }}>CHAT</div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 14px", marginBottom: "8px", fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
          <span style={{ color: NEON_PINK, fontFamily: "'Press Start 2P', monospace", fontSize: "7px" }}>YOU </span>
          I've adjusted the risk section
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 14px", fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5, opacity: agentResponse ? 1 : 0.3, transition: "opacity 0.5s" }}>
          <span style={{ color: NEON_CYAN, fontFamily: "'Press Start 2P', monospace", fontSize: "7px" }}>ANALYST </span>
          Good call adding supply chain risk. I'd also flag the Q3 budget dependency. Want me to update it?
        </div>
      </div>
      <div style={{ background: `${DARK_BG}ee`, padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>REPORT</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px", color: editMode ? NEON_GREEN : "rgba(255,255,255,0.3)", letterSpacing: "1px", textShadow: editMode ? `0 0 6px ${NEON_GREEN}80` : "none", transition: "all 0.3s" }}>{editMode ? "EDITING..." : "VIEW"}</div>
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
          <div style={{ color: NEON_CYAN, fontSize: "9px", fontFamily: "'Press Start 2P', monospace", marginBottom: "6px" }}>RISK ASSESSMENT</div>
          <div style={{ borderLeft: editMode ? `2px solid ${NEON_GREEN}` : "2px solid transparent", paddingLeft: "10px", transition: "all 0.3s", background: editMode ? `${NEON_GREEN}08` : "transparent" }}>
            Supply chain disruption risk is <span style={{ color: editMode ? NEON_GREEN : "rgba(255,255,255,0.6)", transition: "color 0.3s" }}>{editMode ? "high due to contractor shortages" : "moderate"}</span>.
            {editMode && <Cursor color={NEON_GREEN} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function OffloadedHomepage() {
  const [heroVisible, setHeroVisible] = useState(false);
  const [email, setEmail] = useState("");
  useEffect(() => { setTimeout(() => setHeroVisible(true), 200); }, []);

  return (
    <div style={{ backgroundColor: DARK_BG, minHeight: "100vh", color: "#fff", overflowX: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap');
        @keyframes flicker { 0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; } 20%, 24%, 55% { opacity: 0.85; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes twinkle { 0% { opacity: 0.2; } 100% { opacity: 1; } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 20px rgba(255,45,123,0.3), 0 0 40px rgba(255,45,123,0.1); } 50% { box-shadow: 0 0 30px rgba(255,45,123,0.5), 0 0 60px rgba(255,45,123,0.2); } }
        @keyframes chromatic { 0% { text-shadow: -2px 0 #ff2d7b, 2px 0 #00f0ff; } 50% { text-shadow: 2px 0 #ff2d7b, -2px 0 #00f0ff; } 100% { text-shadow: -2px 0 #ff2d7b, 2px 0 #00f0ff; } }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::selection { background: ${NEON_PINK}40; color: #fff; }
      `}</style>

      <Scanlines />
      <Stars />

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 100, padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(to bottom, ${DARK_BG}, transparent)`, backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px", background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "2px" }}>OFFLOADED</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: NEON_GREEN, border: `1px solid ${NEON_GREEN}60`, padding: "2px 6px", borderRadius: "2px", textShadow: `0 0 6px ${NEON_GREEN}80` }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: "32px", alignItems: "center", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
          {["FEATURES", "MARKETPLACE", "BLOG"].map((item, i) => (
            <a key={i} href="#" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", letterSpacing: "2px", transition: "color 0.3s" }}
              onMouseEnter={e => e.target.style.color = NEON_CYAN}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.5)"}
            >{item}</a>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "120px 40px 80px" }}>
        <GridFloor />
        <div style={{ maxWidth: "1100px", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center", position: "relative", zIndex: 1 }}>
          <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(40px)", transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: NEON_PINK, marginBottom: "20px", letterSpacing: "4px", textShadow: `0 0 10px ${NEON_PINK}80` }}>▸ AI FOR PRODUCTIVE WORK</div>
            <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "28px", lineHeight: 1.6, marginBottom: "24px", animation: "chromatic 4s ease-in-out infinite" }}>
              <span style={{ color: "#fff" }}>AGENTS THAT</span><br />
              <span style={{ color: NEON_CYAN, textShadow: `0 0 20px ${NEON_CYAN}, 0 0 40px ${NEON_CYAN}60` }}>PRODUCE WORK</span><br />
              <span style={{ color: "#fff", fontSize: "20px" }}>NOT JUST ANSWERS</span>
            </h1>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "15px", color: "rgba(255,255,255,0.6)", lineHeight: 1.8, marginBottom: "36px", maxWidth: "460px" }}>
              Build a team of AI agents with real roles. They collaborate, produce structured reports, and learn from your feedback. The more you work with them, the better they get.
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)}
                style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", padding: "14px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "2px", color: "#fff", width: "260px", outline: "none", transition: "border-color 0.3s" }}
                onFocus={e => e.target.style.borderColor = NEON_CYAN + "80"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              <button style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", padding: "16px 24px", background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_PINK}cc)`, color: "#fff", border: "none", borderRadius: "2px", cursor: "pointer", letterSpacing: "1px", animation: "pulseGlow 2s ease-in-out infinite", transition: "transform 0.2s", whiteSpace: "nowrap" }}
                onMouseEnter={e => e.target.style.transform = "scale(1.05)"} onMouseLeave={e => e.target.style.transform = "scale(1)"}
              >GET EARLY ACCESS</button>
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "14px", letterSpacing: "1px" }}>Free beta. No credit card.</div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px", padding: "20px", position: "relative", opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(40px)", transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: NEON_CYAN, letterSpacing: "2px", textShadow: `0 0 8px ${NEON_CYAN}60` }}># OPERATIONS TEAM</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>3 agents</div>
            </div>
            {heroMessages.map((msg, i) => <ChatBubble key={i} msg={msg} index={i} />)}
          </div>
        </div>
      </section>

      {/* THE LOOP */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 40px 100px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: NEON_GREEN, marginBottom: "16px", letterSpacing: "4px", textShadow: `0 0 10px ${NEON_GREEN}80` }}>▸ THE LOOP</div>
            <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "20px", lineHeight: 1.6, marginBottom: "20px" }}>
              <span style={{ color: "#fff" }}>AGENTS THAT GET</span><br />
              <GlowText color={NEON_GREEN} size="20px">BETTER OVER TIME</GlowText>
            </h2>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "40px" }}>
              Most AI gives you a one-shot answer and moves on. Offloaded creates a feedback loop — you define what good looks like, agents produce work, you refine it, and they learn from your edits. Every cycle makes the next output better.
            </p>
            {workflowSteps.map((step, i) => <WorkflowStep key={i} step={step} />)}
          </div>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: "rgba(255,255,255,0.2)", letterSpacing: "2px", marginBottom: "12px", textAlign: "center" }}>LIVE EDITING DEMO</div>
            <ReportEditDemo />
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: "12px", letterSpacing: "1px" }}>Edit the report. Agent reviews. Approve changes. Report updates live.</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: NEON_YELLOW, marginBottom: "16px", letterSpacing: "4px", textShadow: `0 0 10px ${NEON_YELLOW}80` }}>▸ WHAT'S INSIDE</div>
          <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "20px", lineHeight: 1.6 }}>
            <span style={{ color: "#fff" }}>NOT ANOTHER </span><GlowText color={NEON_YELLOW} size="20px">CHATBOT</GlowText>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
          {featureBlocks.map((f, i) => <FeatureCard key={i} feature={f} />)}
        </div>
      </section>

      {/* MARKETPLACE */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: NEON_PINK, marginBottom: "16px", letterSpacing: "4px", textShadow: `0 0 10px ${NEON_PINK}80` }}>▸ AGENT MARKETPLACE</div>
          <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "18px", lineHeight: 1.6, marginBottom: "12px" }}>
            <GlowText color={NEON_PINK} size="18px">20+ AGENTS</GlowText><span style={{ color: "#fff" }}> READY TO WORK</span>
          </h2>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: "500px", margin: "0 auto" }}>
            Pre-built agents with roles, templates, and report structures. Install in one click, customise to fit your workflow, or build your own from scratch.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
          {marketplaceAgents.map((agent, i) => <MarketplaceMiniCard key={i} agent={agent} />)}
        </div>
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px" }}>Operations • Marketing • Strategy • Sales • Fitness • Finance • HR • and more</span>
        </div>
      </section>

      {/* USE CASES */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "80px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: NEON_CYAN, marginBottom: "16px", letterSpacing: "4px", textShadow: `0 0 10px ${NEON_CYAN}80` }}>▸ BUILT FOR REAL WORK</div>
          <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "18px", lineHeight: 1.6 }}>
            <span style={{ color: "#fff" }}>WHAT PEOPLE </span><GlowText color={NEON_CYAN} size="18px">ACTUALLY USE IT FOR</GlowText>
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            { emoji: "📰", title: "Daily briefings", desc: "Political analyst scans the web every morning and delivers a structured briefing before you start work" },
            { emoji: "📋", title: "Project status reports", desc: "Pulls data from Asana, generates a status report, and drafts a meeting agenda — one prompt, two outputs" },
            { emoji: "💰", title: "Automated bookkeeping", desc: "Monitors your email for invoices, creates payment tasks, and keeps your accounts receivable current — without being asked" },
            { emoji: "✍️", title: "CEO updates", desc: "Connects to your calendar and meeting notes, drafts a fortnightly update for leadership in 30 seconds instead of 45 minutes" },
            { emoji: "🥗", title: "Fitness and nutrition", desc: "Builds meal plans and training programs matched to your macros, goals, and schedule — with batch prep instructions" },
            { emoji: "✈️", title: "Trip planning", desc: "You and a partner chat with a travel agent in real time, plan an itinerary together, and save it as a report" },
          ].map((uc, i) => (
            <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start", padding: "20px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "2px" }}>
              <span style={{ fontSize: "24px", flexShrink: 0 }}>{uc.emoji}</span>
              <div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: "rgba(255,255,255,0.8)", marginBottom: "6px", letterSpacing: "1px" }}>{uc.title.toUpperCase()}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{uc.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING CTA */}
      <section style={{ maxWidth: "800px", margin: "0 auto", padding: "80px 40px 120px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: NEON_PINK, marginBottom: "24px", letterSpacing: "4px", textShadow: `0 0 10px ${NEON_PINK}80` }}>▸ READY?</div>
        <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "20px", lineHeight: 1.8, marginBottom: "24px" }}>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>I BUILT THIS FOR MYSELF.</span><br />
          <GlowText color={NEON_CYAN} size="20px" delay={1}>TURNS OUT IT WORKS.</GlowText>
        </h2>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "15px", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, maxWidth: "560px", margin: "0 auto 40px" }}>
          Offloaded started as a personal tool to search council documents. It turned into a platform where AI agents produce real work and get better every time. It's in beta, it's free, and I'm looking for people who want to see if it works for them too.
        </p>
        <button style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px", padding: "20px 40px", background: "transparent", color: NEON_CYAN, border: `2px solid ${NEON_CYAN}`, borderRadius: "2px", cursor: "pointer", letterSpacing: "2px", transition: "all 0.3s", textShadow: `0 0 10px ${NEON_CYAN}80`, boxShadow: `0 0 20px ${NEON_CYAN}20` }}
          onMouseEnter={e => { e.target.style.background = NEON_CYAN + "15"; e.target.style.boxShadow = `0 0 30px ${NEON_CYAN}40`; }}
          onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.boxShadow = `0 0 20px ${NEON_CYAN}20`; }}
        >TRY THE BETA →</button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "40px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "12px" }}>OFFLOADED</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px" }}>© 2026 OFFLOADED.LIFE</div>
      </footer>
    </div>
  );
}
