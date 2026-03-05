import { useState, useEffect, useRef } from "react";

// ─── Theme ───
const C = {
  bg: "#FAFAFA",
  white: "#FFFFFF",
  hover: "#F5F5F7",
  active: "#EDEDF0",
  border: "#E5E5EA",
  borderLight: "#F0F0F3",
  text: "#1D1D1F",
  textSec: "#6E6E73",
  textTer: "#AEAEB2",
  accent: "#2C5FF6",
  accentSoft: "rgba(44,95,246,0.08)",
  green: "#16A34A",
  greenSoft: "rgba(22,163,74,0.06)",
  red: "#DC2626",
  redSoft: "rgba(220,38,38,0.07)",
  inputBg: "#F5F5F7",
};

const PALETTE = ["#2C5FF6","#16A34A","#D97706","#9333EA","#DC2626","#0891B2","#4F46E5","#C026D3","#059669","#E11D48"];

const f = `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
const gf = <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />;

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return m;
}

// ─── Icons ───
const I = {
  Hash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
  Send: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>,
  X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Gear: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Up: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="20 6 9 17 4 12"/></svg>,
  Back: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="15 18 9 12 15 6"/></svg>,
  Trash: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  File: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Arrow: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="9 18 15 12 9 6"/></svg>,
};

// ─── Seed data ───
const defaultAgents = [
  {
    id: "hr", name: "HR Advisor", color: "#2C5FF6",
    purpose: "Advise on HR policy, employment law, position descriptions, and recruitment. Reference uploaded legislation and company HR policies when responding.",
    docs: [{ name: "hr-policy-2025.pdf", size: "2.4 MB" }, { name: "fair-work-act-wa.pdf", size: "8.1 MB" }],
  },
  {
    id: "books", name: "Bookkeeper", color: "#16A34A",
    purpose: "Manage expense categorisation, receipt processing, and financial record-keeping. Reference the chart of accounts and expense policy when categorising.",
    docs: [{ name: "expense-policy.pdf", size: "1.2 MB" }, { name: "chart-of-accounts.xlsx", size: "340 KB" }],
  },
  {
    id: "legal", name: "Legal Advisor", color: "#D97706",
    purpose: "Review contracts, governance policies, and compliance requirements. Flag risks and draft revised clauses based on uploaded governance framework and legislation.",
    docs: [{ name: "governance-policy.pdf", size: "3.8 MB" }, { name: "contract-templates.zip", size: "5.2 MB" }],
  },
];

const seedAllMessages = [
  { agentId: "hr", text: "Morning. I've reviewed this quarter's Fair Work updates — two changes affect your current employment contracts. Let me know when you'd like a rundown.", ts: "9:02 am" },
  { agentId: "books", text: "I've processed the November receipts. 12 categorised, 2 flagged as potential duplicates from Bay Coffee ($14.50 each on the same day). Want me to keep both?", ts: "9:15 am" },
  { agentId: "legal", text: "Finished reviewing your contractor agreement template. Found three areas that need attention — missing IP assignment clause, liability cap below your policy minimum, and a short termination notice period. Happy to walk you through it.", ts: "9:31 am" },
  { agentId: "hr", text: "Also — two of your casual staff may now be eligible to request permanent status under the updated casual conversion rules. I've flagged them for your review.", ts: "9:44 am" },
];

const seedDmMessages = {
  hr: [
    { agentId: "hr", text: "You're in a direct conversation with me. I have access to your HR policy and Fair Work legislation. How can I help?", ts: "9:00 am" },
  ],
  books: [
    { agentId: "books", text: "You're in a direct conversation with me. I have your expense policy and chart of accounts loaded. What do you need?", ts: "9:00 am" },
  ],
  legal: [
    { agentId: "legal", text: "You're in a direct conversation with me. I have your governance policy and contract templates loaded. What would you like to review?", ts: "9:00 am" },
  ],
};

// ─── Avatar ───
function Avatar({ agent, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: `${agent.color}14`, color: agent.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, fontFamily: f,
    }}>{agent.name.charAt(0)}</div>
  );
}

// ─── Message Row (Slack style) ───
function MessageRow({ agent, text, ts, isUser, mob }) {
  if (isUser) {
    return (
      <div style={{ padding: mob ? "6px 16px" : "6px 24px" }}>
        <div style={{ display: "flex", gap: mob ? 8 : 10, maxWidth: 720 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: C.active, color: C.textSec,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, fontFamily: f,
          }}>Y</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>You</span>
              <span style={{ fontSize: 11, color: C.textTer }}>{ts}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }}>{text}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: mob ? "6px 16px" : "6px 24px" }}
      onMouseEnter={e => e.currentTarget.style.background = C.hover}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ display: "flex", gap: mob ? 8 : 10, maxWidth: 720 }}>
        <Avatar agent={agent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: agent.color }}>{agent.name}</span>
            <span style={{ fontSize: 11, color: C.textTer }}>{ts}</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }}>{text}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Typing Indicator Row ───
function TypingRow({ agent, mob }) {
  return (
    <div style={{ padding: mob ? "6px 16px" : "6px 24px" }}>
      <div style={{ display: "flex", gap: mob ? 8 : 10 }}>
        <Avatar agent={agent} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 8 }}>
          {[0,1,2].map(d => <div key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: C.textTer, animation: `tp 1.2s ease-in-out ${d*0.15}s infinite` }} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Chat View ───
function ChatView({ channel, agents, mob, onMenu }) {
  const isAll = channel === "all";
  const agent = !isAll ? agents.find(a => a.id === channel) : null;
  const channelLabel = isAll ? "All" : agent?.name || "";

  const initial = isAll
    ? seedAllMessages.map(m => ({ ...m, isUser: false }))
    : (seedDmMessages[channel] || [{ agentId: channel, text: `Direct conversation started.`, ts: "9:00 am" }]).map(m => ({ ...m, isUser: false }));

  const [msgs, setMsgs] = useState(initial);
  const [inp, setInp] = useState("");
  const [typing, setTyping] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    const init = isAll
      ? seedAllMessages.map(m => ({ ...m, isUser: false }))
      : (seedDmMessages[channel] || [{ agentId: channel, text: `Direct conversation started.`, ts: "9:00 am" }]).map(m => ({ ...m, isUser: false }));
    setMsgs(init);
    setInp("");
    setTyping(null);
  }, [channel]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const now = () => {
    const d = new Date();
    const h = d.getHours(); const m = d.getMinutes();
    return `${h > 12 ? h - 12 : h || 12}:${m < 10 ? "0" : ""}${m} ${h >= 12 ? "pm" : "am"}`;
  };

  const send = () => {
    if (!inp.trim() || typing) return;
    const text = inp.trim();
    setMsgs(p => [...p, { isUser: true, text, ts: now() }]);
    setInp("");

    // Pick responding agent
    let responder;
    if (!isAll) {
      responder = agent;
    } else {
      // Simple routing: match input words against agent name/purpose
      const lower = text.toLowerCase();
      let best = null;
      for (const a of agents) {
        const words = `${a.name} ${a.purpose}`.toLowerCase().split(/\s+/);
        const score = lower.split(/\s+/).filter(w => words.some(aw => aw.includes(w) || w.includes(aw))).length;
        if (score > 0 && (!best || score > best.score)) best = { agent: a, score };
      }
      responder = best?.agent || agents[Math.floor(Math.random() * agents.length)];
    }

    if (responder) {
      setTyping(responder);
      setTimeout(() => {
        setTyping(null);
        setMsgs(p => [...p, {
          agentId: responder.id, isUser: false, ts: now(),
          text: isAll
            ? `I can help with that. Let me check against the ${responder.docs.length} document${responder.docs.length !== 1 ? "s" : ""} in my knowledge base and get back to you.`
            : `Let me look into that. I'll reference my ${responder.docs.length} document${responder.docs.length !== 1 ? "s" : ""} and respond shortly.`,
        }]);
      }, 1400);
    }
  };

  const typingAgent = typing ? agents.find(a => a.id === typing.id) || typing : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", fontFamily: f, overflow: "hidden", background: C.white }}>
      {/* Header */}
      <div style={{
        padding: mob ? "10px 16px" : "12px 24px",
        borderBottom: `1px solid ${C.border}`, background: C.white,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {mob && <button onClick={onMenu} style={{ background: "none", border: "none", color: C.textSec, cursor: "pointer", padding: 2, display: "flex" }}><I.Menu /></button>}
        {isAll ? (
          <>
            <span style={{ color: C.textTer, fontSize: 16 }}><I.Hash /></span>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>All</span>
            <span style={{ fontSize: 12, color: C.textTer }}>{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
          </>
        ) : agent ? (
          <>
            <Avatar agent={agent} size={26} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{agent.name}</span>
          </>
        ) : null}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", paddingTop: mob ? 8 : 16, paddingBottom: 8 }}>
        {msgs.map((m, i) => {
          const ma = !m.isUser ? agents.find(a => a.id === m.agentId) : null;
          return m.isUser
            ? <MessageRow key={i} isUser text={m.text} ts={m.ts} mob={mob} />
            : ma ? <MessageRow key={i} agent={ma} text={m.text} ts={m.ts} mob={mob} /> : null;
        })}
        {typingAgent && <TypingRow agent={typingAgent} mob={mob} />}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: mob ? "8px 12px 16px" : "8px 20px 20px" }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          background: C.inputBg, borderRadius: 10, padding: "4px 4px 4px 16px",
          border: `1px solid ${C.border}`,
        }}>
          <input value={inp} onChange={e => setInp(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={isAll ? "Message #All..." : `Message ${agent?.name || ""}...`}
            style={{ flex: 1, border: "none", background: "transparent", color: C.text, fontSize: 14, fontFamily: f, outline: "none", padding: "10px 0" }}
          />
          <button onClick={send} disabled={!inp.trim() || !!typing} style={{
            width: 34, height: 34, borderRadius: 8, border: "none", flexShrink: 0,
            background: inp.trim() && !typing ? C.accent : "transparent",
            color: inp.trim() && !typing ? "#fff" : C.textTer,
            cursor: inp.trim() && !typing ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s ease",
          }}><I.Send /></button>
        </div>
      </div>
      <style>{`@keyframes tp { 0%,60%,100%{opacity:.25;transform:translateY(0)} 30%{opacity:1;transform:translateY(-3px)} }`}</style>
    </div>
  );
}

// ─── Settings ───
function SettingsView({ agents, setAgents, mob, onMenu, onBack }) {
  const [editing, setEditing] = useState(null);
  const [v, setV] = useState(false);
  useEffect(() => { setV(true); }, []);

  if (editing) {
    const isNew = editing === "new";
    const existing = !isNew ? agents.find(a => a.id === editing) : null;
    const [name, setName] = useState(existing?.name || "");
    const [purpose, setPurpose] = useState(existing?.purpose || "");
    const [color, setColor] = useState(existing?.color || PALETTE[agents.length % PALETTE.length]);
    const [docs, setDocs] = useState(existing?.docs || []);

    const save = () => {
      if (!name.trim()) return;
      if (isNew) setAgents(p => [...p, { id: `a_${Date.now()}`, name: name.trim(), purpose: purpose.trim(), color, docs }]);
      else setAgents(p => p.map(a => a.id === editing ? { ...a, name: name.trim(), purpose: purpose.trim(), color, docs } : a));
      setEditing(null);
    };
    const remove = () => { setAgents(p => p.filter(a => a.id !== editing)); setEditing(null); };
    const addDoc = () => {
      const n = ["policy-document.pdf","compliance-guide.pdf","procedures-manual.docx","reference.xlsx","templates.zip","legislation.pdf"];
      const s = ["1.2 MB","3.4 MB","890 KB","2.1 MB","5.6 MB","4.3 MB"];
      const i = docs.length % n.length;
      setDocs(p => [...p, { name: n[i], size: s[i] }]);
    };

    return (
      <div style={{ flex: 1, overflow: "auto", background: C.white, fontFamily: f }}>
        <div style={{ padding: mob ? "16px" : "32px 40px", maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: C.textSec, cursor: "pointer", padding: 2, display: "flex" }}><I.Back /></button>
            <span style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{isNew ? "New Agent" : "Edit Agent"}</span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 8 }}>Colour</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PALETTE.map(c => <div key={c} onClick={() => setColor(c)} style={{
                width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2,
              }} />)}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 8 }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HR Advisor, Marketing Lead..."
              style={{ width: "100%", padding: "11px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: f, color: C.text, background: C.white, outline: "none" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 8 }}>Purpose</label>
            <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={4}
              placeholder="Describe this agent's role and how it should behave..."
              style={{ width: "100%", padding: "11px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: f, color: C.text, background: C.white, outline: "none", resize: "vertical", lineHeight: 1.6 }} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 8 }}>Documents</label>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              {docs.map((d, i) => (
                <div key={i} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderLight}` }}>
                  <div style={{ color: C.textTer }}><I.File /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: C.textTer }}>{d.size}</div>
                  </div>
                  <button onClick={() => setDocs(p => p.filter((_,j)=>j!==i))} style={{ background: "none", border: "none", color: C.textTer, cursor: "pointer", padding: 2, display: "flex" }}><I.X /></button>
                </div>
              ))}
              <button onClick={addDoc} style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", color: C.accent, fontSize: 13, fontWeight: 500, fontFamily: f }}>
                <I.Plus /> Upload document
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} disabled={!name.trim()} style={{
              flex: 1, padding: "11px 20px", background: name.trim() ? C.accent : C.active,
              color: name.trim() ? "#fff" : C.textTer, border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: name.trim() ? "pointer" : "default", fontFamily: f,
            }}>{isNew ? "Create Agent" : "Save"}</button>
            {!isNew && <button onClick={remove} style={{ padding: "11px 14px", background: C.redSoft, color: C.red, border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center" }}><I.Trash /></button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", background: C.white, fontFamily: f }}>
      <div style={{ padding: mob ? "16px" : "32px 40px", maxWidth: 520, opacity: v ? 1 : 0, transition: "opacity 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          {mob && <button onClick={onBack} style={{ background: "none", border: "none", color: C.textSec, cursor: "pointer", padding: 2, display: "flex" }}><I.Back /></button>}
          <span style={{ fontSize: 18, fontWeight: 600, color: C.text, flex: 1 }}>Your Team</span>
          <button onClick={() => setEditing("new")} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
            background: C.accent, color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: f,
          }}><I.Plus /> New</button>
        </div>

        {agents.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: C.textSec, marginBottom: 4 }}>No agents yet</div>
            <div style={{ fontSize: 13, color: C.textTer }}>Create your first team member to get started</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {agents.map(a => (
            <div key={a.id} onClick={() => setEditing(a.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
              background: C.white,
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.hover}
              onMouseLeave={e => e.currentTarget.style.background = C.white}
            >
              <Avatar agent={a} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{a.name}</div>
                <div style={{ fontSize: 12, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.purpose}</div>
              </div>
              <div style={{ fontSize: 11, color: C.textTer, flexShrink: 0 }}>{a.docs.length} doc{a.docs.length !== 1 ? "s" : ""}</div>
              <div style={{ color: C.textTer }}><I.Arrow /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ───
function SidebarContent({ active, onNav, agents, showClose, onClose }) {
  const item = (id, children, isActive) => (
    <button onClick={() => onNav(id)} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
      border: "none", borderRadius: 6, width: "100%", textAlign: "left",
      background: isActive ? C.accentSoft : "transparent",
      color: isActive ? C.accent : C.textSec,
      cursor: "pointer", fontSize: 14, fontWeight: isActive ? 600 : 400, fontFamily: f,
      WebkitTapHighlightColor: "transparent",
    }}>{children}</button>
  );

  return (
    <>
      <div style={{ padding: "16px 16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Offload</span>
        {showClose && <button onClick={onClose} style={{ background: "none", border: "none", color: C.textTer, cursor: "pointer", padding: 2, display: "flex" }}><I.X /></button>}
      </div>

      <div style={{ flex: 1, padding: "0 8px", display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
        {/* Channels */}
        <div style={{ padding: "8px 8px 4px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em" }}>Channels</span>
        </div>
        {item("all", <><span style={{ color: "inherit", opacity: 0.6 }}><I.Hash /></span><span># All</span></>, active === "all")}

        {/* Direct messages */}
        {agents.length > 0 && (
          <>
            <div style={{ padding: "14px 8px 4px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em" }}>Direct messages</span>
            </div>
            {agents.map(a => (
              item(`dm:${a.id}`, <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, opacity: active === `dm:${a.id}` ? 1 : 0.4 }} />
                <span>{a.name}</span>
              </>, active === `dm:${a.id}`)
            ))}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Settings */}
        <div style={{ padding: "4px 0 8px", borderTop: `1px solid ${C.borderLight}`, marginTop: 8, paddingTop: 12 }}>
          {item("settings", <><span style={{ color: "inherit", opacity: 0.6 }}><I.Gear /></span><span>Settings</span></>, active === "settings")}
        </div>
      </div>

      <div style={{ padding: "8px 8px 12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: C.active, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.textSec }}>N</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Nick's Business</div>
        </div>
      </div>
    </>
  );
}

function Drawer({ active, onNav, agents, open, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.12)", zIndex: 200, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s ease" }} />
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 260, background: C.white, zIndex: 300,
        transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column", borderRight: `1px solid ${C.border}`, fontFamily: f,
      }}>
        <SidebarContent active={active} onNav={id => { onNav(id); onClose(); }} agents={agents} showClose onClose={onClose} />
      </div>
    </>
  );
}

// ─── App ───
export default function App() {
  const [view, setView] = useState("all");
  const [drawer, setDrawer] = useState(false);
  const [agents, setAgents] = useState(defaultAgents);
  const mob = useIsMobile();
  const menu = () => setDrawer(true);

  const channel = view === "all" ? "all" : view.startsWith("dm:") ? view.replace("dm:", "") : null;

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: C.white, color: C.text, fontFamily: f, overflow: "hidden" }}>
      {gf}
      <style>{`*,*::before,*::after{box-sizing:border-box}body{margin:0;padding:0;overflow:hidden;-webkit-font-smoothing:antialiased}input,textarea{font-size:16px!important}::selection{background:rgba(44,95,246,0.15)}`}</style>

      {!mob && (
        <div style={{ width: 220, minWidth: 220, background: C.bg, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          <SidebarContent active={view} onNav={setView} agents={agents} />
        </div>
      )}
      {mob && <Drawer active={view} onNav={setView} agents={agents} open={drawer} onClose={() => setDrawer(false)} />}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {channel && <ChatView channel={channel} agents={agents} mob={mob} onMenu={menu} />}
        {view === "settings" && <SettingsView agents={agents} setAgents={setAgents} mob={mob} onMenu={menu} onBack={() => setView("all")} />}
      </div>
    </div>
  );
}
