import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════
// CONSTANTS & DATA
// ═══════════════════════════════════════════════════════════
const NEON_PINK = "#ff2d7b";
const NEON_CYAN = "#00f0ff";
const NEON_YELLOW = "#ffe14d";
const NEON_GREEN = "#39ff14";
const NEON_PURPLE = "#b388ff";
const NEON_ORANGE = "#ff8a65";
const DARK_BG = "#0a0a12";
const GRID_COLOR = "rgba(0, 240, 255, 0.08)";

// Hero chat — humans AND agents collaborating
const heroChatMessages = [
  { name: "YOU", icon: "👤", color: NEON_PINK, msg: "Team — I need a competitor analysis for the investor meeting Thursday.", isHuman: true },
  { name: "RESEARCHER", icon: "🔍", color: NEON_GREEN, msg: "On it. Pulling data on 4 direct competitors now. I'll save a report by EOD." },
  { name: "STRATEGIST", icon: "🧠", color: NEON_CYAN, msg: "I'll build the positioning matrix once Research shares findings. Want me to loop in @WRITER for the deck narrative?" },
  { name: "KARLEE", icon: "👩‍💼", color: NEON_ORANGE, msg: "I can handle the financial comparison slides — just tag me when the data's ready.", isHuman: true },
  { name: "WRITER", icon: "✍️", color: NEON_YELLOW, msg: "Standing by. I'll draft the exec summary and match your brand voice from the last pitch." },
];

// Marketplace agents
const marketplaceAgents = [
  { name: "SOCIAL MEDIA MGR", icon: "📱", color: NEON_PINK, tier: "S", stats: { SPD: 9, ACC: 8, CRE: 9 }, desc: "Drafts posts, plans calendars, matches your voice across platforms.", tags: ["CONTENT", "SCHEDULING"] },
  { name: "BOOKKEEPER", icon: "📊", color: NEON_GREEN, tier: "A", stats: { SPD: 7, ACC: 10, CRE: 4 }, desc: "Categorises expenses, flags anomalies, preps monthly summaries.", tags: ["FINANCE", "REPORTING"] },
  { name: "MEETING PREP", icon: "🎯", color: NEON_CYAN, tier: "A", stats: { SPD: 8, ACC: 9, CRE: 7 }, desc: "Researches attendees, drafts agendas, summarises action items.", tags: ["PRODUCTIVITY", "RESEARCH"] },
  { name: "LEAD QUALIFIER", icon: "🔥", color: NEON_YELLOW, tier: "S", stats: { SPD: 10, ACC: 8, CRE: 6 }, desc: "Scores inbound leads, enriches contacts, drafts personalised outreach.", tags: ["SALES", "CRM"] },
  { name: "GRANT WRITER", icon: "📝", color: NEON_PURPLE, tier: "B", stats: { SPD: 5, ACC: 9, CRE: 8 }, desc: "Finds relevant grants, drafts applications, tracks deadlines.", tags: ["FUNDING", "WRITING"] },
  { name: "CLIENT ONBOARDER", icon: "🤝", color: NEON_ORANGE, tier: "A", stats: { SPD: 8, ACC: 8, CRE: 7 }, desc: "Sends welcome sequences, collects docs, sets up project boards.", tags: ["OPS", "AUTOMATION"] },
];

// Builder steps
const builderSteps = [
  { label: "NAME", value: "Proposal Writer", color: NEON_CYAN },
  { label: "ROLE", value: "Drafts client proposals from brief + template library", color: NEON_GREEN },
  { label: "TOOLS", value: "Google Docs  •  Asana  •  Web Search", color: NEON_YELLOW },
  { label: "VOICE", value: "Professional, concise, confident", color: NEON_PINK },
];

// Reports demo
const reportEntries = [
  { title: "Competitor Analysis — Q2 2026", agent: "RESEARCHER", date: "2 hrs ago", color: NEON_GREEN, pages: 12 },
  { title: "Weekly Client Retro Summary", agent: "STRATEGIST", date: "Yesterday", color: NEON_CYAN, pages: 4 },
  { title: "Lead Pipeline — March Snapshot", agent: "LEAD QUALIFIER", date: "2 days ago", color: NEON_YELLOW, pages: 8 },
  { title: "Social Content Calendar — April", agent: "SOCIAL MEDIA MGR", date: "3 days ago", color: NEON_PINK, pages: 6 },
];

// Scheduled tasks demo
const scheduledTasks = [
  { name: "Morning news brief", agent: "RESEARCHER", schedule: "Weekdays 7:00 AM", color: NEON_GREEN, icon: "📰" },
  { name: "Weekly pipeline report", agent: "LEAD QUALIFIER", schedule: "Mondays 9:00 AM", color: NEON_YELLOW, icon: "📊" },
  { name: "Social post drafts", agent: "WRITER", schedule: "Tue / Thu 10:00 AM", color: NEON_PINK, icon: "📱" },
  { name: "Invoice follow-ups", agent: "BOOKKEEPER", schedule: "Fridays 2:00 PM", color: NEON_CYAN, icon: "💰" },
];

const audiences = ["EOS IMPLEMENTERS", "FITNESS COACHES", "AGENCY FOUNDERS", "CONSULTANTS", "OPERATORS", "SMALL TEAMS"];

// All 6 features
const powerUps = [
  { icon: "💬", title: "TEAM CHAT", color: NEON_CYAN, desc: "Humans and AI agents in one group conversation. Collaborate like a real team — because it is one." },
  { icon: "🛠️", title: "CUSTOM AGENTS", color: NEON_GREEN, desc: "Build an agent in under a minute. Name it, give it a role, connect your tools. No code required." },
  { icon: "🏪", title: "MARKETPLACE", color: NEON_PINK, desc: "Browse pre-built agents. One-click install. Customise to fit your workflow. New characters dropping weekly." },
  { icon: "📄", title: "SAVE AS REPORT", color: NEON_YELLOW, desc: "Tell any agent to save its work. Get polished, shareable reports from any conversation — on demand." },
  { icon: "⏰", title: "SCHEDULED TASKS", color: NEON_PURPLE, desc: "Set agents to run on autopilot. Morning briefs, weekly reports, pipeline updates — all on your schedule." },
  { icon: "👥", title: "INVITE TEAMMATES", color: NEON_ORANGE, desc: "Bring real people into the chat. Work alongside your AI agents as a blended team. Humans + AI, together." },
];

// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════

const Scanlines = () => (
  <div style={{
    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 9999,
    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
  }} />
);

const GridFloor = () => (
  <div style={{
    position: "absolute", bottom: 0, left: 0, width: "100%", height: "45%",
    background: `linear-gradient(to bottom, transparent 0%, ${DARK_BG} 100%), repeating-linear-gradient(90deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px), repeating-linear-gradient(0deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px)`,
    transform: "perspective(400px) rotateX(45deg)",
    transformOrigin: "bottom center", opacity: 0.6,
  }} />
);

const GlowText = ({ children, color = NEON_CYAN, size = "1rem", style = {} }) => (
  <span style={{
    color, fontWeight: 700, fontSize: size,
    textShadow: `0 0 7px ${color}, 0 0 20px ${color}, 0 0 40px ${color}80`,
    animation: "flicker 3s ease-in-out infinite alternate", ...style,
  }}>{children}</span>
);

const Cursor = ({ color = NEON_CYAN }) => (
  <span style={{
    display: "inline-block", width: "3px", height: "1.1em",
    backgroundColor: color, marginLeft: "4px", verticalAlign: "text-bottom",
    animation: "blink 1s step-end infinite", boxShadow: `0 0 6px ${color}`,
  }} />
);

const SectionLabel = ({ color, children }) => (
  <div style={{
    fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color,
    marginBottom: "16px", letterSpacing: "4px",
    textShadow: `0 0 10px ${color}80`,
  }}>▸ {children}</div>
);

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontFamily: "'Press Start 2P', monospace",
    fontSize: "20px", lineHeight: 1.6, marginBottom: "12px",
  }}>{children}</h2>
);

const SectionDesc = ({ children, maxWidth = "520px" }) => (
  <p style={{
    fontFamily: "'Space Mono', monospace", fontSize: "14px",
    color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth, margin: "0 auto",
  }}>{children}</p>
);

const CornerAccents = ({ color, active = true }) => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, width: "20px", height: "20px", borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}`, opacity: active ? 1 : 0.3, transition: "opacity 0.3s" }} />
    <div style={{ position: "absolute", bottom: 0, right: 0, width: "20px", height: "20px", borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}`, opacity: active ? 1 : 0.3, transition: "opacity 0.3s" }} />
  </>
);

const Stars = () => {
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * 100, y: Math.random() * 100,
    size: Math.random() * 2 + 1, delay: Math.random() * 4,
    duration: Math.random() * 3 + 2,
  }));
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
          width: `${s.size}px`, height: `${s.size}px`, borderRadius: "50%",
          backgroundColor: "rgba(255,255,255,0.6)",
          animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
        }} />
      ))}
    </div>
  );
};

const Ticker = () => {
  const items = [...audiences, ...audiences, ...audiences];
  return (
    <div style={{ overflow: "hidden", width: "100%", padding: "20px 0" }}>
      <div style={{ display: "flex", gap: "48px", whiteSpace: "nowrap", animation: "scroll 20s linear infinite" }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: "10px",
            color: "rgba(255,255,255,0.25)", letterSpacing: "3px",
          }}>{item} <span style={{ color: NEON_PINK, margin: "0 12px" }}>◆</span></span>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// FEATURE COMPONENTS
// ═══════════════════════════════════════════════════════════

// HERO CHAT — humans + agents
const ChatBubble = ({ entry, index }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400 + index * 500);
    return () => clearTimeout(t);
  }, [index]);
  return (
    <div style={{
      display: "flex", gap: "12px", alignItems: "flex-start",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)",
      transition: "all 0.5s cubic-bezier(0.22, 1, 0.36, 1)", marginBottom: "10px",
    }}>
      <div style={{
        width: "36px", height: "36px",
        borderRadius: entry.isHuman ? "50%" : "8px",
        background: `linear-gradient(135deg, ${entry.color}${entry.isHuman ? "50" : "30"}, ${entry.color}${entry.isHuman ? "20" : "10"})`,
        border: `1px solid ${entry.color}60`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px", flexShrink: 0, boxShadow: `0 0 12px ${entry.color}30`,
      }}>{entry.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
          color: entry.color, marginBottom: "5px",
          textShadow: `0 0 8px ${entry.color}80`, letterSpacing: "1px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          {entry.name}
          {entry.isHuman && <span style={{
            fontSize: "6px", color: "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "1px 5px", borderRadius: "2px",
          }}>HUMAN</span>}
        </div>
        <div style={{
          background: entry.isHuman ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${entry.isHuman ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: "0 10px 10px 10px", padding: "10px 14px",
          fontFamily: "'Space Mono', monospace", fontSize: "12px",
          color: "rgba(255,255,255,0.82)", lineHeight: 1.5,
        }}>{entry.msg}</div>
      </div>
    </div>
  );
};

// MARKETPLACE CARD
const MarketplaceCard = ({ agent, index, selected, onSelect }) => {
  const isActive = selected === index;
  return (
    <div onClick={() => onSelect(index)} style={{
      background: isActive ? `linear-gradient(180deg, ${agent.color}12, ${agent.color}04)` : "rgba(255,255,255,0.02)",
      border: `2px solid ${isActive ? agent.color : "rgba(255,255,255,0.06)"}`,
      borderRadius: "2px", padding: "20px", cursor: "pointer",
      transition: "all 0.3s ease", position: "relative", overflow: "hidden",
      boxShadow: isActive ? `0 0 25px ${agent.color}25, inset 0 0 25px ${agent.color}08` : "none",
      transform: isActive ? "scale(1.02)" : "scale(1)",
    }}>
      <div style={{
        position: "absolute", top: "10px", right: "10px",
        fontFamily: "'Press Start 2P', monospace", fontSize: "10px",
        color: agent.tier === "S" ? NEON_YELLOW : agent.tier === "A" ? NEON_CYAN : "rgba(255,255,255,0.4)",
        textShadow: agent.tier === "S" ? `0 0 10px ${NEON_YELLOW}` : "none",
      }}>{agent.tier}</div>
      <div style={{ fontSize: "32px", marginBottom: "12px", filter: isActive ? `drop-shadow(0 0 8px ${agent.color})` : "none", transition: "filter 0.3s" }}>{agent.icon}</div>
      <div style={{
        fontFamily: "'Press Start 2P', monospace", fontSize: "8px",
        color: agent.color, marginBottom: "10px",
        textShadow: isActive ? `0 0 8px ${agent.color}80` : "none",
        letterSpacing: "1px", lineHeight: 1.4,
      }}>{agent.name}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
        {Object.entries(agent.stats).map(([stat, val]) => (
          <div key={stat} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "rgba(255,255,255,0.3)", width: "24px" }}>{stat}</span>
            <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ width: `${val * 10}%`, height: "100%", background: agent.color, boxShadow: `0 0 6px ${agent.color}60`, borderRadius: "2px" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {agent.tags.map((tag, i) => (
          <span key={i} style={{
            fontFamily: "'Space Mono', monospace", fontSize: "8px",
            color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)",
            padding: "2px 6px", borderRadius: "2px", letterSpacing: "1px",
          }}>{tag}</span>
        ))}
      </div>
    </div>
  );
};

// AGENT BUILDER
const AgentBuilderDemo = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStep(s => (s + 1) % (builderSteps.length + 2)), 1800);
    return () => clearInterval(interval);
  }, []);
  return (
    <div style={{
      background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "4px", padding: "28px", fontFamily: "'Space Mono', monospace",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "20px", paddingBottom: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[NEON_PINK, NEON_YELLOW, NEON_GREEN].map((c, i) => (
            <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: c, opacity: 0.8 }} />
          ))}
        </div>
        <span style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: "8px",
          color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginLeft: "8px",
        }}>AGENT BUILDER v2.0</span>
      </div>
      {builderSteps.map((s, i) => (
        <div key={i} style={{
          display: "flex", gap: "12px", marginBottom: "14px",
          opacity: step > i ? 1 : step === i ? 0.7 : 0.2,
          transform: step >= i ? "translateX(0)" : "translateX(-8px)",
          transition: "all 0.4s ease",
        }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: "8px",
            color: s.color, width: "52px", flexShrink: 0,
            textShadow: step >= i ? `0 0 8px ${s.color}60` : "none", paddingTop: "3px",
          }}>{s.label}</span>
          <div style={{
            flex: 1, background: "rgba(255,255,255,0.03)",
            border: `1px solid ${step === i ? s.color + "50" : "rgba(255,255,255,0.05)"}`,
            borderRadius: "2px", padding: "8px 12px", fontSize: "13px",
            color: step > i ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
            transition: "all 0.3s", boxShadow: step === i ? `0 0 12px ${s.color}15` : "none",
          }}>
            {step > i ? s.value : step === i ? (<span>{s.value.slice(0, Math.floor(s.value.length * 0.6))}<Cursor color={s.color} /></span>) : "..."}
          </div>
        </div>
      ))}
      <div style={{
        marginTop: "20px", opacity: step >= builderSteps.length ? 1 : 0,
        transform: step >= builderSteps.length ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.5s ease", display: "flex", alignItems: "center", gap: "10px",
      }}>
        <div style={{
          width: "8px", height: "8px", borderRadius: "50%",
          backgroundColor: step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW,
          boxShadow: `0 0 8px ${step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW}`,
          transition: "all 0.4s",
        }} />
        <span style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: "9px",
          color: step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW,
          textShadow: `0 0 8px ${step >= builderSteps.length + 1 ? NEON_GREEN : NEON_YELLOW}80`,
          letterSpacing: "2px",
        }}>{step >= builderSteps.length + 1 ? "✓ AGENT DEPLOYED" : "DEPLOYING..."}</span>
      </div>
    </div>
  );
};

// REPORTS PANEL
const ReportsDemo = () => {
  const [selected, setSelected] = useState(0);
  return (
    <div style={{
      background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "4px", overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>SAVED REPORTS</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>{reportEntries.length} files</div>
      </div>
      {reportEntries.map((r, i) => (
        <div key={i} onClick={() => setSelected(i)} style={{
          padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", gap: "16px", cursor: "pointer",
          background: selected === i ? `${r.color}08` : "transparent",
          borderLeft: selected === i ? `3px solid ${r.color}` : "3px solid transparent",
          transition: "all 0.2s ease",
        }}>
          <div style={{
            width: "32px", height: "40px", borderRadius: "3px",
            background: `linear-gradient(135deg, ${r.color}20, ${r.color}08)`,
            border: `1px solid ${r.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
            color: r.color, flexShrink: 0,
          }}>PDF</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Space Mono', monospace", fontSize: "13px",
              color: selected === i ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
              marginBottom: "4px", transition: "color 0.2s",
            }}>{r.title}</div>
            <div style={{
              fontFamily: "'Space Mono', monospace", fontSize: "11px",
              color: "rgba(255,255,255,0.25)", display: "flex", gap: "12px",
            }}>
              <span style={{ color: r.color + "80" }}>{r.agent}</span>
              <span>•</span><span>{r.pages} pages</span>
              <span>•</span><span>{r.date}</span>
            </div>
          </div>
          <div style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: "6px",
            color: "rgba(255,255,255,0.2)", opacity: selected === i ? 1 : 0,
            transition: "opacity 0.2s",
          }}>OPEN →</div>
        </div>
      ))}
    </div>
  );
};

// SCHEDULED TASKS PANEL
const SchedulerDemo = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(i);
  }, []);
  return (
    <div style={{
      background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "4px", overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>SCHEDULED TASKS</div>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          fontFamily: "'Space Mono', monospace", fontSize: "11px", color: NEON_GREEN,
        }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            backgroundColor: NEON_GREEN, boxShadow: `0 0 6px ${NEON_GREEN}`,
            animation: "blink 2s ease-in-out infinite",
          }} />
          ALL SYSTEMS GO
        </div>
      </div>
      {scheduledTasks.map((task, i) => {
        const isRunning = tick % scheduledTasks.length === i;
        return (
          <div key={i} style={{
            padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", gap: "16px",
            background: isRunning ? `${task.color}06` : "transparent",
            transition: "all 0.4s ease",
          }}>
            <div style={{ fontSize: "20px", width: "28px", textAlign: "center" }}>{task.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Space Mono', monospace", fontSize: "13px",
                color: isRunning ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                marginBottom: "4px", transition: "color 0.4s",
              }}>{task.name}</div>
              <div style={{
                fontFamily: "'Space Mono', monospace", fontSize: "11px",
                color: "rgba(255,255,255,0.25)", display: "flex", gap: "12px",
              }}>
                <span style={{ color: task.color + "80" }}>{task.agent}</span>
                <span>•</span><span>{task.schedule}</span>
              </div>
            </div>
            <div style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
              padding: "4px 10px", borderRadius: "2px",
              color: isRunning ? DARK_BG : task.color,
              background: isRunning ? task.color : "transparent",
              border: `1px solid ${isRunning ? task.color : task.color + "40"}`,
              transition: "all 0.4s ease", letterSpacing: "1px",
            }}>{isRunning ? "RUNNING" : "READY"}</div>
          </div>
        );
      })}
    </div>
  );
};

// POWER-UP CARD
const PowerUpCard = ({ item }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      background: hovered ? `linear-gradient(135deg, ${item.color}08, ${item.color}04)` : "rgba(255,255,255,0.02)",
      border: `1px solid ${hovered ? item.color + "60" : "rgba(255,255,255,0.06)"}`,
      borderRadius: "2px", padding: "28px 24px", transition: "all 0.4s ease",
      cursor: "default", position: "relative", overflow: "hidden",
      boxShadow: hovered ? `0 0 30px ${item.color}15, inset 0 0 30px ${item.color}05` : "none",
    }}>
      <CornerAccents color={item.color} active={hovered} />
      <div style={{ fontSize: "28px", marginBottom: "14px", filter: hovered ? `drop-shadow(0 0 8px ${item.color})` : "none", transition: "filter 0.3s" }}>{item.icon}</div>
      <div style={{
        fontFamily: "'Press Start 2P', monospace", fontSize: "10px",
        color: item.color, marginBottom: "10px",
        textShadow: hovered ? `0 0 10px ${item.color}80` : "none", letterSpacing: "2px",
      }}>{item.title}</div>
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: "13px",
        color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
      }}>{item.desc}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function OffloadedHomepage() {
  const [heroVisible, setHeroVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(0);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 200); }, []);

  return (
    <div style={{ backgroundColor: DARK_BG, minHeight: "100vh", color: "#fff", overflowX: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap');
        @keyframes flicker{0%,19%,21%,23%,25%,54%,56%,100%{opacity:1}20%,24%,55%{opacity:.85}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-33.33%)}}
        @keyframes twinkle{0%{opacity:.2}100%{opacity:1}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 20px rgba(255,45,123,.3),0 0 40px rgba(255,45,123,.1)}50%{box-shadow:0 0 30px rgba(255,45,123,.5),0 0 60px rgba(255,45,123,.2)}}
        @keyframes chromatic{0%{text-shadow:-2px 0 #ff2d7b,2px 0 #00f0ff}50%{text-shadow:2px 0 #ff2d7b,-2px 0 #00f0ff}100%{text-shadow:-2px 0 #ff2d7b,2px 0 #00f0ff}}
        *{margin:0;padding:0;box-sizing:border-box}
        ::selection{background:${NEON_PINK}40;color:#fff}
      `}</style>
      <Scanlines />
      <Stars />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, width: "100%", zIndex: 100,
        padding: "20px 40px", display: "flex", justifyContent: "space-between",
        alignItems: "center", background: `linear-gradient(to bottom, ${DARK_BG}, transparent)`,
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: "14px",
            background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "2px",
          }}>OFFLOADED</span>
          <span style={{
            fontFamily: "'Space Mono', monospace", fontSize: "9px", color: NEON_GREEN,
            border: `1px solid ${NEON_GREEN}60`, padding: "2px 6px", borderRadius: "2px",
            textShadow: `0 0 6px ${NEON_GREEN}80`,
          }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: "32px", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
          {["FEATURES", "MARKETPLACE", "PRICING", "DOCS"].map((item, i) => (
            <a key={i} href="#" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", letterSpacing: "2px", transition: "color 0.3s" }}
              onMouseEnter={e => e.target.style.color = NEON_CYAN}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.5)"}>{item}</a>
          ))}
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "120px 40px 80px" }}>
        <GridFloor />
        <div style={{ maxWidth: "1100px", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center", position: "relative", zIndex: 1 }}>
          <div style={{
            opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: NEON_PINK, marginBottom: "20px", letterSpacing: "4px", textShadow: `0 0 10px ${NEON_PINK}80` }}>▸ INSERT COIN TO BEGIN</div>
            <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "30px", lineHeight: 1.6, marginBottom: "24px", animation: "chromatic 4s ease-in-out infinite" }}>
              <span style={{ color: "#fff" }}>YOUR TEAM.</span><br />
              <span style={{ color: NEON_CYAN, textShadow: `0 0 20px ${NEON_CYAN}, 0 0 40px ${NEON_CYAN}60` }}>AI + HUMANS.</span>
            </h1>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "16px", color: "rgba(255,255,255,0.65)", lineHeight: 1.8, marginBottom: "36px", maxWidth: "440px" }}>
              Build a crew of AI agents. Invite your teammates. Talk in a group chat. Get work done — together.
              <br /><br />
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>No code. No complexity. Just results.</span>
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)}
                style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", padding: "14px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "2px", color: "#fff", width: "260px", outline: "none", transition: "border-color 0.3s" }}
                onFocus={e => e.target.style.borderColor = NEON_CYAN + "80"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              <button style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", padding: "16px 24px", background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_PINK}cc)`, color: "#fff", border: "none", borderRadius: "2px", cursor: "pointer", letterSpacing: "1px", animation: "pulseGlow 2s ease-in-out infinite", transition: "transform 0.2s", whiteSpace: "nowrap" }}
                onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                onMouseLeave={e => e.target.style.transform = "scale(1)"}>START GAME</button>
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "14px", letterSpacing: "1px" }}>Free to play. No credit card required.</div>
          </div>

          {/* Chat demo — humans + agents */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "4px", padding: "20px",
            opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: NEON_CYAN, letterSpacing: "2px", textShadow: `0 0 8px ${NEON_CYAN}60` }}># OPERATIONS CREW</div>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.25)", marginRight: "6px" }}>2 humans • 3 agents</span>
                {heroChatMessages.map((a, i) => (
                  <div key={i} style={{ width: "7px", height: "7px", borderRadius: a.isHuman ? "50%" : "2px", backgroundColor: a.color, opacity: 0.7, boxShadow: `0 0 6px ${a.color}` }} />
                ))}
              </div>
            </div>
            {heroChatMessages.map((entry, i) => <ChatBubble key={i} entry={entry} index={i} />)}
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "8px 0" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: "rgba(255,255,255,0.2)", textAlign: "center", marginBottom: "4px", letterSpacing: "4px" }}>BUILT FOR</div>
          <Ticker />
        </div>
      </div>

      {/* ═══ POWER-UPS: ALL 6 FEATURES ═══ */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "120px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
          <SectionLabel color={NEON_GREEN}>SELECT YOUR POWER-UPS</SectionLabel>
          <SectionTitle><span style={{ color: "#fff" }}>SIX WAYS TO </span><GlowText color={NEON_YELLOW} size="20px">LEVEL UP</GlowText></SectionTitle>
          <SectionDesc>Everything you need to build, run, and scale your AI-powered team.</SectionDesc>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
          {powerUps.map((item, i) => <PowerUpCard key={i} item={item} />)}
        </div>
      </section>

      {/* ═══ MARKETPLACE ═══ */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 40px 120px" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <SectionLabel color={NEON_YELLOW}>CHARACTER SELECT</SectionLabel>
          <SectionTitle><span style={{ color: "#fff" }}>THE </span><GlowText color={NEON_PINK} size="20px">AGENT MARKETPLACE</GlowText></SectionTitle>
          <SectionDesc>Browse pre-built agents ready to join your crew. Install in one click. Or build your own from scratch.</SectionDesc>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
          {marketplaceAgents.slice(0, 3).map((a, i) => <MarketplaceCard key={i} agent={a} index={i} selected={selectedAgent} onSelect={setSelectedAgent} />)}
        </div>
        <div style={{
          background: `linear-gradient(90deg, ${marketplaceAgents[selectedAgent].color}08, transparent, ${marketplaceAgents[selectedAgent].color}08)`,
          border: `1px solid ${marketplaceAgents[selectedAgent].color}30`,
          borderRadius: "2px", padding: "16px 24px", margin: "16px 0",
          display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.3s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "24px" }}>{marketplaceAgents[selectedAgent].icon}</span>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: marketplaceAgents[selectedAgent].color, textShadow: `0 0 6px ${marketplaceAgents[selectedAgent].color}60`, marginBottom: "6px", letterSpacing: "1px" }}>{marketplaceAgents[selectedAgent].name}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{marketplaceAgents[selectedAgent].desc}</div>
            </div>
          </div>
          <button style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", padding: "10px 18px", background: `${marketplaceAgents[selectedAgent].color}20`, color: marketplaceAgents[selectedAgent].color, border: `1px solid ${marketplaceAgents[selectedAgent].color}60`, borderRadius: "2px", cursor: "pointer", letterSpacing: "1px", whiteSpace: "nowrap", textShadow: `0 0 6px ${marketplaceAgents[selectedAgent].color}80` }}>+ ADD TO CREW</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {marketplaceAgents.slice(3, 6).map((a, i) => <MarketplaceCard key={i + 3} agent={a} index={i + 3} selected={selectedAgent} onSelect={setSelectedAgent} />)}
        </div>
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>+ DOZENS MORE IN THE ARCADE</span>
        </div>
      </section>

      {/* ═══ CUSTOM BUILDER ═══ */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 40px 120px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>
          <div>
            <SectionLabel color={NEON_CYAN}>CREATE-A-CHARACTER</SectionLabel>
            <SectionTitle><span style={{ color: "#fff" }}>CAN'T FIND IT?</span><br /><GlowText color={NEON_GREEN} size="20px">BUILD IT.</GlowText></SectionTitle>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "15px", color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: "28px", marginTop: "16px" }}>
              The marketplace is just the starting roster. Describe what you need in plain English — name it, give it a role, connect your tools — and your custom agent is live in under a minute.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { icon: "⚡", text: "No code, no prompting skills required" },
                { icon: "🔧", text: "Connect Asana, email, docs, web search" },
                { icon: "🎭", text: "Set personality, tone, and guardrails" },
                { icon: "🔄", text: "Iterate and refine as your needs change" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", fontFamily: "'Space Mono', monospace", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ fontSize: "16px" }}>{item.icon}</span><span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <AgentBuilderDemo />
        </div>
      </section>

      {/* ═══ REPORTS + SCHEDULER ═══ */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 40px 120px" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <SectionLabel color={NEON_PURPLE}>BONUS ROUNDS</SectionLabel>
          <SectionTitle><span style={{ color: "#fff" }}>WORK </span><GlowText color={NEON_YELLOW} size="20px">WHILE YOU SLEEP</GlowText></SectionTitle>
          <SectionDesc>Save any conversation as a polished report. Set agents to run on autopilot. Your crew never clocks out.</SectionDesc>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: NEON_YELLOW, marginBottom: "16px", letterSpacing: "2px", textShadow: `0 0 8px ${NEON_YELLOW}60` }}>📄 SAVED REPORTS</div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: "20px" }}>
              Say "save as report" and your agent compiles, formats, and stores the output. Every report is searchable, shareable, and ready when you need it.
            </p>
            <ReportsDemo />
          </div>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: NEON_PURPLE, marginBottom: "16px", letterSpacing: "2px", textShadow: `0 0 8px ${NEON_PURPLE}60` }}>⏰ SCHEDULED TASKS</div>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: "20px" }}>
              Set any agent to run on a schedule. Morning briefs, weekly reports, pipeline updates — they fire automatically and drop results in your chat or reports.
            </p>
            <SchedulerDemo />
          </div>
        </div>
      </section>

      {/* ═══ CLOSING CTA ═══ */}
      <section style={{ maxWidth: "800px", margin: "0 auto", padding: "80px 40px 120px", textAlign: "center" }}>
        <SectionLabel color={NEON_PINK}>FINAL BOSS: YOUR TO-DO LIST</SectionLabel>
        <SectionTitle>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>STOP DOING EVERYTHING.</span><br />
          <GlowText color={NEON_CYAN} size="20px">START OFFLOADING.</GlowText>
        </SectionTitle>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "15px", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, maxWidth: "560px", margin: "20px auto 48px" }}>
          You didn't start your business to write content calendars and chase invoices. Build an AI crew that handles the work you keep putting off — so you can focus on the work that actually matters.
        </p>
        <button style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: "12px", padding: "20px 40px",
          background: "transparent", color: NEON_CYAN, border: `2px solid ${NEON_CYAN}`,
          borderRadius: "2px", cursor: "pointer", letterSpacing: "2px", transition: "all 0.3s",
          textShadow: `0 0 10px ${NEON_CYAN}80`, boxShadow: `0 0 20px ${NEON_CYAN}20`,
        }}
          onMouseEnter={e => { e.target.style.background = NEON_CYAN + "15"; e.target.style.boxShadow = `0 0 30px ${NEON_CYAN}40`; }}
          onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.boxShadow = `0 0 20px ${NEON_CYAN}20`; }}
        >PLAY NOW →</button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "40px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px", background: `linear-gradient(135deg, ${NEON_PINK}, ${NEON_CYAN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "12px" }}>OFFLOADED</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px" }}>© 2026 OFFLOADED.LIFE — ALL RIGHTS RESERVED</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.15)", marginTop: "8px", letterSpacing: "2px" }}>GAME OVER? NEVER. ◆ PRESS START TO CONTINUE</div>
      </footer>
    </div>
  );
}
