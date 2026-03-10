import { useState, useEffect, useRef } from "react";

const NEON_PINK = "#ff2d7b";
const NEON_CYAN = "#00f0ff";
const NEON_YELLOW = "#ffe14d";
const NEON_GREEN = "#39ff14";
const DARK_BG = "#0a0a12";
const GRID_COLOR = "rgba(0, 240, 255, 0.08)";

const agents = [
  { name: "STRATEGIST", icon: "🧠", color: NEON_CYAN, msg: "I've drafted your Q2 roadmap based on last quarter's retro notes." },
  { name: "RESEARCHER", icon: "🔍", color: NEON_GREEN, msg: "Found 3 competitor case studies. Summary incoming." },
  { name: "WRITER", icon: "✍️", color: NEON_YELLOW, msg: "Blog post draft is ready. Matched your brand voice." },
  { name: "SCHEDULER", icon: "📅", color: NEON_PINK, msg: "Blocked 2 hours tomorrow for deep work. Moved the 1:1 to Thursday." },
];

const features = [
  { title: "GROUP CHAT", subtitle: "One conversation. Whole team.", desc: "Talk to your agents the way you already talk to your team — in a group chat. Ask questions, give direction, watch them collaborate." },
  { title: "AGENT BUILDER", subtitle: "No code. No kidding.", desc: "Describe what you need. Name them. Give them a role. Your agent is live in under a minute. Built for operators, not engineers." },
  { title: "TOOL CONNECT", subtitle: "Plug into your workflow.", desc: "Your agents use the tools you already use — Asana, email, web search. They don't just talk, they do." },
];

const marketplaceAgents = [
  { name: "SOCIAL MEDIA MGR", icon: "📱", color: NEON_PINK, tier: "S", stats: { SPD: 9, ACC: 8, CRE: 9 }, desc: "Drafts posts, plans calendars, matches your voice across platforms.", tags: ["CONTENT", "SCHEDULING"] },
  { name: "BOOKKEEPER", icon: "📊", color: NEON_GREEN, tier: "A", stats: { SPD: 7, ACC: 10, CRE: 4 }, desc: "Categorises expenses, flags anomalies, preps monthly summaries.", tags: ["FINANCE", "REPORTING"] },
  { name: "MEETING PREP", icon: "🎯", color: NEON_CYAN, tier: "A", stats: { SPD: 8, ACC: 9, CRE: 7 }, desc: "Researches attendees, drafts agendas, summarises action items.", tags: ["PRODUCTIVITY", "RESEARCH"] },
  { name: "LEAD QUALIFIER", icon: "🔥", color: NEON_YELLOW, tier: "S", stats: { SPD: 10, ACC: 8, CRE: 6 }, desc: "Scores inbound leads, enriches contacts, drafts personalised outreach.", tags: ["SALES", "CRM"] },
  { name: "GRANT WRITER", icon: "📝", color: "#b388ff", tier: "B", stats: { SPD: 5, ACC: 9, CRE: 8 }, desc: "Finds relevant grants, drafts applications, tracks deadlines.", tags: ["FUNDING", "WRITING"] },
  { name: "CLIENT ONBOARDER", icon: "🤝", color: "#ff8a65", tier: "A", stats: { SPD: 8, ACC: 8, CRE: 7 }, desc: "Sends welcome sequences, collects docs, sets up project boards.", tags: ["OPS", "AUTOMATION"] },
];

const builderSteps = [
  { label: "NAME", value: "Proposal Writer", color: NEON_CYAN },
  { label: "ROLE", value: "Drafts client proposals from brief + template library", color: NEON_GREEN },
  { label: "TOOLS", value: "Google Docs  •  Asana  •  Web Search", color: NEON_YELLOW },
  { label: "VOICE", value: "Professional, concise, confident", color: NEON_PINK },
];

const socialProof = [
  "EOS IMPLEMENTERS",
  "FITNESS COACHES",
  "AGENCY FOUNDERS",
  "CONSULTANTS",
  "OPERATORS",
];

// Scanline overlay
const Scanlines = () => (
  <div style={{
    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 9999,
    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
  }} />
);

// Animated grid floor
const GridFloor = () => (
  <div style={{
    position: "absolute", bottom: 0, left: 0, width: "100%", height: "45%",
    background: `
      linear-gradient(to bottom, transparent 0%, ${DARK_BG} 100%),
      repeating-linear-gradient(90deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px),
      repeating-linear-gradient(0deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px)
    `,
    transform: "perspective(400px) rotateX(45deg)",
    transformOrigin: "bottom center",
    opacity: 0.6,
  }} />
);

// Glow text component
const GlowText = ({ children, color = NEON_CYAN, size = "1rem", weight = 700, style = {}, delay = 0 }) => (
  <span style={{
    color,
    fontWeight: weight,
    fontSize: size,
    textShadow: `0 0 7px ${color}, 0 0 20px ${color}, 0 0 40px ${color}80`,
    animation: `flicker 3s ease-in-out ${delay}s infinite alternate`,
    ...style,
  }}>
    {children}
  </span>
);

// Blinking cursor
const Cursor = ({ color = NEON_CYAN }) => (
  <span style={{
    display: "inline-block", width: "3px", height: "1.1em",
    backgroundColor: color, marginLeft: "4px", verticalAlign: "text-bottom",
    animation: "blink 1s step-end infinite",
    boxShadow: `0 0 6px ${color}`,
  }} />
);

// Chat message bubble
const ChatBubble = ({ agent, index }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600 + index * 450);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div style={{
      display: "flex", gap: "12px", alignItems: "flex-start",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(16px)",
      transition: "all 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
      marginBottom: "12px",
    }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "8px",
        background: `linear-gradient(135deg, ${agent.color}30, ${agent.color}10)`,
        border: `1px solid ${agent.color}60`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "20px", flexShrink: 0,
        boxShadow: `0 0 12px ${agent.color}30`,
      }}>
        {agent.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "9px", color: agent.color, marginBottom: "6px",
          textShadow: `0 0 8px ${agent.color}80`,
          letterSpacing: "1px",
        }}>
          {agent.name}
        </div>
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "0 12px 12px 12px",
          padding: "12px 16px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "13px",
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.5,
        }}>
          {agent.msg}
        </div>
      </div>
    </div>
  );
};

// Feature card
const FeatureCard = ({ feature, index }) => {
  const [hovered, setHovered] = useState(false);
  const colors = [NEON_CYAN, NEON_PINK, NEON_GREEN];
  const c = colors[index % 3];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `linear-gradient(135deg, ${c}08, ${c}04)` : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? c + "60" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "2px",
        padding: "32px 28px",
        transition: "all 0.4s ease",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
        boxShadow: hovered ? `0 0 30px ${c}15, inset 0 0 30px ${c}05` : "none",
      }}
    >
      {/* Corner accents */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "20px", height: "20px", borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}`, opacity: hovered ? 1 : 0.3, transition: "opacity 0.3s" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "20px", height: "20px", borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}`, opacity: hovered ? 1 : 0.3, transition: "opacity 0.3s" }} />

      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "11px", color: c, marginBottom: "6px",
        textShadow: `0 0 10px ${c}80`,
        letterSpacing: "2px",
      }}>
        {feature.title}
      </div>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: "13px", color: "rgba(255,255,255,0.5)",
        marginBottom: "16px", letterSpacing: "1px",
      }}>
        {feature.subtitle}
      </div>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: "14px", color: "rgba(255,255,255,0.7)",
        lineHeight: 1.7,
      }}>
        {feature.desc}
      </div>
    </div>
  );
};

// Scrolling ticker
const Ticker = () => {
  const items = [...socialProof, ...socialProof, ...socialProof];
  return (
    <div style={{ overflow: "hidden", width: "100%", padding: "20px 0" }}>
      <div style={{
        display: "flex", gap: "48px", whiteSpace: "nowrap",
        animation: "scroll 20s linear infinite",
      }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "3px",
          }}>
            {item} <span style={{ color: NEON_PINK, margin: "0 12px" }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// Marketplace agent card — arcade character select style
const MarketplaceCard = ({ agent, index, selected, onSelect }) => {
  const isActive = selected === index;
  return (
    <div
      onClick={() => onSelect(index)}
      style={{
        background: isActive ? `linear-gradient(180deg, ${agent.color}12, ${agent.color}04)` : "rgba(255,255,255,0.02)",
        border: `2px solid ${isActive ? agent.color : "rgba(255,255,255,0.06)"}`,
        borderRadius: "2px",
        padding: "20px",
        cursor: "pointer",
        transition: "all 0.3s ease",
        position: "relative",
        overflow: "hidden",
        boxShadow: isActive ? `0 0 25px ${agent.color}25, inset 0 0 25px ${agent.color}08` : "none",
        transform: isActive ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Tier badge */}
      <div style={{
        position: "absolute", top: "10px", right: "10px",
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "10px",
        color: agent.tier === "S" ? NEON_YELLOW : agent.tier === "A" ? NEON_CYAN : "rgba(255,255,255,0.4)",
        textShadow: agent.tier === "S" ? `0 0 10px ${NEON_YELLOW}` : "none",
      }}>
        {agent.tier}
      </div>

      {/* Icon */}
      <div style={{
        fontSize: "32px", marginBottom: "12px",
        filter: isActive ? `drop-shadow(0 0 8px ${agent.color})` : "none",
        transition: "filter 0.3s",
      }}>
        {agent.icon}
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "8px", color: agent.color, marginBottom: "10px",
        textShadow: isActive ? `0 0 8px ${agent.color}80` : "none",
        letterSpacing: "1px", lineHeight: 1.4,
      }}>
        {agent.name}
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
        {Object.entries(agent.stats).map(([stat, val]) => (
          <div key={stat} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "6px", color: "rgba(255,255,255,0.3)",
              width: "24px",
            }}>{stat}</span>
            <div style={{
              flex: 1, height: "4px", background: "rgba(255,255,255,0.06)",
              borderRadius: "2px", overflow: "hidden",
            }}>
              <div style={{
                width: `${val * 10}%`, height: "100%",
                background: agent.color,
                boxShadow: `0 0 6px ${agent.color}60`,
                borderRadius: "2px",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {agent.tags.map((tag, i) => (
          <span key={i} style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "8px",
            color: "rgba(255,255,255,0.35)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "2px 6px",
            borderRadius: "2px",
            letterSpacing: "1px",
          }}>{tag}</span>
        ))}
      </div>
    </div>
  );
};

// Custom agent builder — terminal-style creation
const AgentBuilderDemo = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % (builderSteps.length + 2));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "4px",
      padding: "28px",
      fontFamily: "'Space Mono', monospace",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Terminal header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "20px", paddingBottom: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: NEON_PINK, opacity: 0.8 }} />
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: NEON_YELLOW, opacity: 0.8 }} />
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: NEON_GREEN, opacity: 0.8 }} />
        </div>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "8px", color: "rgba(255,255,255,0.3)",
          letterSpacing: "2px", marginLeft: "8px",
        }}>
          AGENT BUILDER v2.0
        </span>
      </div>

      {/* Builder fields */}
      {builderSteps.map((s, i) => (
        <div key={i} style={{
          display: "flex", gap: "12px", marginBottom: "14px",
          opacity: step > i ? 1 : step === i ? 0.7 : 0.2,
          transform: step >= i ? "translateX(0)" : "translateX(-8px)",
          transition: "all 0.4s ease",
        }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "8px", color: s.color, width: "52px", flexShrink: 0,
            textShadow: step >= i ? `0 0 8px ${s.color}60` : "none",
            paddingTop: "3px",
          }}>
            {s.label}
          </span>
          <div style={{
            flex: 1,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${step === i ? s.color + "50" : "rgba(255,255,255,0.05)"}`,
            borderRadius: "2px",
            padding: "8px 12px",
            fontSize: "13px",
            color: step > i ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
            transition: "all 0.3s",
            boxShadow: step === i ? `0 0 12px ${s.color}15` : "none",
          }}>
            {step > i ? s.value : step === i ? (
              <span>{s.value.slice(0, Math.floor(s.value.length * 0.6))}<Cursor color={s.color} /></span>
            ) : "..."}
          </div>
        </div>
      ))}

      {/* Deploy line */}
      <div style={{
        marginTop: "20px",
        opacity: step >= builderSteps.length ? 1 : 0,
        transform: step >= builderSteps.length ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.5s ease",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <div style={{
          width: "8px", height: "8px", borderRadius: "50%",
          backgroundColor: step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW,
          boxShadow: `0 0 8px ${step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW}`,
          transition: "all 0.4s",
        }} />
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "9px",
          color: step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW,
          textShadow: `0 0 8px ${step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW}80`,
          letterSpacing: "2px",
        }}>
          {step >= builderSteps.length + 1 ? "✓ AGENT DEPLOYED" : "DEPLOYING..."}
        </span>
      </div>
    </div>
  );
};

// Stars background
const Stars = () => {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 4,
    duration: Math.random() * 3 + 2,
  }));
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: `${s.size}px`, height: `${s.size}px`,
          borderRadius: "50%",
          backgroundColor: "rgba(255,255,255,0.6)",
          animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
        }} />
      ))}
    </div>
  );
};

export default function OffloadedHomepage() {
  const [heroVisible, setHeroVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(0);

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 200);
  }, []);

  return (
    <div style={{
      backgroundColor: DARK_BG,
      minHeight: "100vh",
      color: "#fff",
      overflowX: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap');

        @keyframes flicker {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
          20%, 24%, 55% { opacity: 0.85; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        @keyframes twinkle {
          0% { opacity: 0.2; }
          100% { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,45,123,0.3), 0 0 40px rgba(255,45,123,0.1); }
          50% { box-shadow: 0 0 30px rgba(255,45,123,0.5), 0 0 60px rgba(255,45,123,0.2); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chromatic {
          0% { text-shadow: -2px 0 #ff2d7b, 2px 0 #00f0ff; }
          50% { text-shadow: 2px 0 #ff2d7b, -2px 0 #00f0ff; }
          100% { text-shadow: -2px 0 #ff2d7b, 2px 0 #00f0ff; }
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::selection { background: ${NEON_PINK}40; color: #fff; }
      `}</style>

      <Scanlines />
      <Stars />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, width: "100%", zIndex: 100,
        padding: "20px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: `linear-gradient(to bottom, ${DARK_BG}, transparent)`,
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
            background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "2px",
          }}>
            OFFLOADED
          </span>
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "9px", color: NEON_GREEN,
            border: `1px solid ${NEON_GREEN}60`,
            padding: "2px 6px", borderRadius: "2px",
            textShadow: `0 0 6px ${NEON_GREEN}80`,
          }}>
            BETA
          </span>
        </div>
        <div style={{
          display: "flex", gap: "32px", alignItems: "center",
          fontFamily: "'Space Mono', monospace", fontSize: "12px",
        }}>
          {["HOW IT WORKS", "PRICING", "DOCS"].map((item, i) => (
            <a key={i} href="#" style={{
              color: "rgba(255,255,255,0.5)", textDecoration: "none",
              letterSpacing: "2px", transition: "color 0.3s",
            }}
              onMouseEnter={e => e.target.style.color = NEON_CYAN}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.5)"}
            >
              {item}
            </a>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: "120px 40px 80px",
      }}>
        <GridFloor />

        <div style={{
          maxWidth: "1100px", width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "60px",
          alignItems: "center",
          position: "relative", zIndex: 1,
        }}>
          {/* Left: Copy */}
          <div style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "10px", color: NEON_PINK, marginBottom: "20px",
              letterSpacing: "4px",
              textShadow: `0 0 10px ${NEON_PINK}80`,
            }}>
              ▸ INSERT COIN TO BEGIN
            </div>

            <h1 style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "32px",
              lineHeight: 1.6,
              marginBottom: "24px",
              animation: "chromatic 4s ease-in-out infinite",
            }}>
              <span style={{ color: "#fff" }}>BUILD YOUR</span><br />
              <span style={{ color: NEON_CYAN, textShadow: `0 0 20px ${NEON_CYAN}, 0 0 40px ${NEON_CYAN}60` }}>AI CREW</span>
            </h1>

            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "16px",
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.8,
              marginBottom: "36px",
              maxWidth: "440px",
            }}>
              Assemble a team of AI agents. Talk to them in a group chat. Watch them get your work done.
              <br /><br />
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
                No code. No complexity. Just results.
              </span>
            </p>

            {/* CTA */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "14px",
                  padding: "14px 20px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(255,255,255,0.1)`,
                  borderRadius: "2px",
                  color: "#fff",
                  width: "260px",
                  outline: "none",
                  transition: "border-color 0.3s",
                }}
                onFocus={e => e.target.style.borderColor = NEON_CYAN + "80"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              <button style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "10px",
                padding: "16px 24px",
                background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_PINK}cc)`,
                color: "#fff",
                border: "none",
                borderRadius: "2px",
                cursor: "pointer",
                letterSpacing: "1px",
                animation: "pulseGlow 2s ease-in-out infinite",
                transition: "transform 0.2s",
                whiteSpace: "nowrap",
              }}
                onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                onMouseLeave={e => e.target.style.transform = "scale(1)"}
              >
                START GAME
              </button>
            </div>

            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px", color: "rgba(255,255,255,0.3)",
              marginTop: "14px", letterSpacing: "1px",
            }}>
              Free to play. No credit card required.
            </div>
          </div>

          {/* Right: Chat demo */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "4px",
            padding: "24px",
            position: "relative",
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s",
          }}>
            {/* Chat header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "20px", paddingBottom: "16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "9px", color: NEON_CYAN,
                letterSpacing: "2px",
                textShadow: `0 0 8px ${NEON_CYAN}60`,
              }}>
                # OPERATIONS CREW
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {agents.map((a, i) => (
                  <div key={i} style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    backgroundColor: a.color, opacity: 0.7,
                    boxShadow: `0 0 6px ${a.color}`,
                  }} />
                ))}
              </div>
            </div>

            {/* Messages */}
            {agents.map((agent, i) => (
              <ChatBubble key={i} agent={agent} index={i} />
            ))}

            {/* Typing indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginTop: "8px", opacity: 0.5,
              fontFamily: "'Space Mono', monospace", fontSize: "12px",
              color: "rgba(255,255,255,0.4)",
            }}>
              <span style={{ color: NEON_PINK }}>YOU</span>
              <span>Type a message...</span>
              <Cursor color={NEON_PINK} />
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{
          maxWidth: "1100px", margin: "0 auto",
          padding: "8px 0",
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "8px",
            color: "rgba(255,255,255,0.2)",
            textAlign: "center",
            marginBottom: "4px",
            letterSpacing: "4px",
          }}>
            BUILT FOR
          </div>
          <Ticker />
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section style={{
        maxWidth: "1100px", margin: "0 auto",
        padding: "120px 40px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px", color: NEON_GREEN, marginBottom: "16px",
            letterSpacing: "4px",
            textShadow: `0 0 10px ${NEON_GREEN}80`,
          }}>
            ▸ SELECT YOUR LOADOUT
          </div>
          <h2 style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "22px", lineHeight: 1.6,
          }}>
            <span style={{ color: "#fff" }}>THREE MOVES.</span>{" "}
            <GlowText color={NEON_YELLOW} size="22px">GAME ON.</GlowText>
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "24px",
        }}>
          {features.map((f, i) => (
            <FeatureCard key={i} feature={f} index={i} />
          ))}
        </div>
      </section>

      {/* AGENT MARKETPLACE — CHARACTER SELECT */}
      <section style={{
        maxWidth: "1100px", margin: "0 auto",
        padding: "40px 40px 120px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px", color: NEON_YELLOW, marginBottom: "16px",
            letterSpacing: "4px",
            textShadow: `0 0 10px ${NEON_YELLOW}80`,
          }}>
            ▸ CHARACTER SELECT
          </div>
          <h2 style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "20px", lineHeight: 1.6,
            marginBottom: "12px",
          }}>
            <span style={{ color: "#fff" }}>THE </span>
            <GlowText color={NEON_PINK} size="20px">AGENT MARKETPLACE</GlowText>
          </h2>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "14px",
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.7, maxWidth: "520px", margin: "0 auto",
          }}>
            Browse pre-built agents ready to join your crew. Install in one click.
            Customise to fit your workflow. New agents dropping weekly.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "32px",
        }}>
          {marketplaceAgents.slice(0, 3).map((agent, i) => (
            <MarketplaceCard key={i} agent={agent} index={i} selected={selectedAgent} onSelect={setSelectedAgent} />
          ))}
        </div>

        {/* Selected agent detail strip */}
        <div style={{
          background: `linear-gradient(90deg, ${marketplaceAgents[selectedAgent].color}08, transparent, ${marketplaceAgents[selectedAgent].color}08)`,
          border: `1px solid ${marketplaceAgents[selectedAgent].color}30`,
          borderRadius: "2px",
          padding: "16px 24px",
          margin: "16px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "all 0.3s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "24px" }}>{marketplaceAgents[selectedAgent].icon}</span>
            <div>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "9px", color: marketplaceAgents[selectedAgent].color,
                textShadow: `0 0 6px ${marketplaceAgents[selectedAgent].color}60`,
                marginBottom: "6px", letterSpacing: "1px",
              }}>
                {marketplaceAgents[selectedAgent].name}
              </div>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "13px", color: "rgba(255,255,255,0.6)",
              }}>
                {marketplaceAgents[selectedAgent].desc}
              </div>
            </div>
          </div>
          <button style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "8px",
            padding: "10px 18px",
            background: `${marketplaceAgents[selectedAgent].color}20`,
            color: marketplaceAgents[selectedAgent].color,
            border: `1px solid ${marketplaceAgents[selectedAgent].color}60`,
            borderRadius: "2px",
            cursor: "pointer",
            letterSpacing: "1px",
            whiteSpace: "nowrap",
            transition: "all 0.3s",
            textShadow: `0 0 6px ${marketplaceAgents[selectedAgent].color}80`,
          }}>
            + ADD TO CREW
          </button>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
        }}>
          {marketplaceAgents.slice(3, 6).map((agent, i) => (
            <MarketplaceCard key={i + 3} agent={agent} index={i + 3} selected={selectedAgent} onSelect={setSelectedAgent} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "10px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "2px",
          }}>
            + DOZENS MORE IN THE ARCADE
          </span>
        </div>
      </section>

      {/* CUSTOM AGENT BUILDER */}
      <section style={{
        maxWidth: "1100px", margin: "0 auto",
        padding: "40px 40px 120px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "60px",
          alignItems: "center",
        }}>
          {/* Left: Copy */}
          <div>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "10px", color: NEON_CYAN, marginBottom: "16px",
              letterSpacing: "4px",
              textShadow: `0 0 10px ${NEON_CYAN}80`,
            }}>
              ▸ CREATE-A-CHARACTER
            </div>
            <h2 style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "20px", lineHeight: 1.6,
              marginBottom: "20px",
            }}>
              <span style={{ color: "#fff" }}>CAN'T FIND IT?</span><br />
              <GlowText color={NEON_GREEN} size="20px">BUILD IT.</GlowText>
            </h2>
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "15px",
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.8,
              marginBottom: "28px",
            }}>
              The marketplace is just the starting roster. Describe what you need in plain
              English — name it, give it a role, connect your tools — and your custom agent
              is live in under a minute.
            </p>
            <div style={{
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              {[
                { icon: "⚡", text: "No code, no prompting skills required", color: NEON_YELLOW },
                { icon: "🔧", text: "Connect Asana, email, docs, web search", color: NEON_CYAN },
                { icon: "🎭", text: "Set personality, tone, and guardrails", color: NEON_PINK },
                { icon: "🔄", text: "Iterate and refine as your needs change", color: NEON_GREEN },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.6)",
                }}>
                  <span style={{ fontSize: "16px" }}>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Builder demo */}
          <AgentBuilderDemo />
        </div>
      </section>

      {/* VALUE PROP */}
      <section style={{
        maxWidth: "800px", margin: "0 auto",
        padding: "80px 40px 120px",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "9px", color: NEON_PINK, marginBottom: "24px",
          letterSpacing: "4px",
          textShadow: `0 0 10px ${NEON_PINK}80`,
        }}>
          ▸ FINAL BOSS: YOUR TO-DO LIST
        </div>
        <h2 style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "20px", lineHeight: 1.8,
          marginBottom: "24px",
        }}>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>STOP DOING EVERYTHING.</span><br />
          <GlowText color={NEON_CYAN} size="20px" delay={1}>START OFFLOADING.</GlowText>
        </h2>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "15px",
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.8,
          maxWidth: "560px",
          margin: "0 auto 48px",
        }}>
          You didn't start your business to write content calendars and chase invoices.
          Build an AI crew that handles the work you keep putting off — so you can
          focus on the work that actually matters.
        </p>

        <button style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "12px",
          padding: "20px 40px",
          background: "transparent",
          color: NEON_CYAN,
          border: `2px solid ${NEON_CYAN}`,
          borderRadius: "2px",
          cursor: "pointer",
          letterSpacing: "2px",
          transition: "all 0.3s",
          textShadow: `0 0 10px ${NEON_CYAN}80`,
          boxShadow: `0 0 20px ${NEON_CYAN}20`,
        }}
          onMouseEnter={e => {
            e.target.style.background = NEON_CYAN + "15";
            e.target.style.boxShadow = `0 0 30px ${NEON_CYAN}40`;
          }}
          onMouseLeave={e => {
            e.target.style.background = "transparent";
            e.target.style.boxShadow = `0 0 20px ${NEON_CYAN}20`;
          }}
        >
          PLAY NOW →
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.04)",
        padding: "40px",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "10px",
          background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "12px",
        }}>
          OFFLOADED
        </div>
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "11px",
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "1px",
        }}>
          © 2026 OFFLOADED.LIFE — ALL RIGHTS RESERVED
        </div>
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.15)",
          marginTop: "8px",
          letterSpacing: "2px",
        }}>
          GAME OVER? NEVER. ◆ PRESS START TO CONTINUE
        </div>
      </footer>
    </div>
  );
}
