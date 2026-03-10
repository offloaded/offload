// Neon color palette
export const NEON_PINK = "#ff2d7b";
export const NEON_CYAN = "#00f0ff";
export const NEON_YELLOW = "#ffe14d";
export const NEON_GREEN = "#39ff14";
export const NEON_PURPLE = "#b388ff";
export const NEON_ORANGE = "#ff8a65";
export const DARK_BG = "#0a0a12";
export const GRID_COLOR = "rgba(0, 240, 255, 0.08)";

// Hero chat — humans AND agents collaborating
export const heroChatMessages = [
  { name: "YOU", icon: "👤", color: NEON_PINK, msg: "Team — I need a competitor analysis for the investor meeting Thursday.", isHuman: true },
  { name: "RESEARCHER", icon: "🔍", color: NEON_GREEN, msg: "On it. Pulling data on 4 direct competitors now. I'll save a report by EOD." },
  { name: "STRATEGIST", icon: "🧠", color: NEON_CYAN, msg: "I'll build the positioning matrix once Research shares findings. Want me to loop in @WRITER for the deck narrative?" },
  { name: "KARLEE", icon: "👩‍💼", color: NEON_ORANGE, msg: "I can handle the financial comparison slides — just tag me when the data's ready.", isHuman: true },
  { name: "WRITER", icon: "✍️", color: NEON_YELLOW, msg: "Standing by. I'll draft the exec summary and match your brand voice from the last pitch." },
];

// Legacy agents array (used by old components if any still reference it)
export const agents = heroChatMessages;

// Power-ups: all 6 features
export const powerUps = [
  { icon: "💬", title: "TEAM CHAT", color: NEON_CYAN, desc: "Humans and AI agents in one group conversation. Collaborate like a real team — because it is one." },
  { icon: "🛠️", title: "CUSTOM AGENTS", color: NEON_GREEN, desc: "Build an agent in under a minute. Name it, give it a role, connect your tools. No code required." },
  { icon: "🏪", title: "MARKETPLACE", color: NEON_PINK, desc: "Browse pre-built agents. One-click install. Customise to fit your workflow. New characters dropping weekly." },
  { icon: "📄", title: "SAVE AS REPORT", color: NEON_YELLOW, desc: "Tell any agent to save its work. Get polished, shareable reports from any conversation — on demand." },
  { icon: "⏰", title: "SCHEDULED TASKS", color: NEON_PURPLE, desc: "Set agents to run on autopilot. Morning briefs, weekly reports, pipeline updates — all on your schedule." },
  { icon: "👥", title: "INVITE TEAMMATES", color: NEON_ORANGE, desc: "Bring real people into the chat. Work alongside your AI agents as a blended team. Humans + AI, together." },
];

// Legacy features array (3-card version)
export const features = [
  { title: "GROUP CHAT", subtitle: "One conversation. Whole team.", desc: "Talk to your agents the way you already talk to your team — in a group chat. Ask questions, give direction, watch them collaborate." },
  { title: "AGENT BUILDER", subtitle: "No code. No kidding.", desc: "Describe what you need. Name them. Give them a role. Your agent is live in under a minute. Built for operators, not engineers." },
  { title: "TOOL CONNECT", subtitle: "Plug into your workflow.", desc: "Your agents use the tools you already use — Asana, email, web search. They don't just talk, they do." },
];

export const marketplaceAgents = [
  { name: "SOCIAL MEDIA MGR", icon: "📱", color: NEON_PINK, tier: "S" as const, stats: { SPD: 9, ACC: 8, CRE: 9 }, desc: "Drafts posts, plans calendars, matches your voice across platforms.", tags: ["CONTENT", "SCHEDULING"] },
  { name: "BOOKKEEPER", icon: "📊", color: NEON_GREEN, tier: "A" as const, stats: { SPD: 7, ACC: 10, CRE: 4 }, desc: "Categorises expenses, flags anomalies, preps monthly summaries.", tags: ["FINANCE", "REPORTING"] },
  { name: "MEETING PREP", icon: "🎯", color: NEON_CYAN, tier: "A" as const, stats: { SPD: 8, ACC: 9, CRE: 7 }, desc: "Researches attendees, drafts agendas, summarises action items.", tags: ["PRODUCTIVITY", "RESEARCH"] },
  { name: "LEAD QUALIFIER", icon: "🔥", color: NEON_YELLOW, tier: "S" as const, stats: { SPD: 10, ACC: 8, CRE: 6 }, desc: "Scores inbound leads, enriches contacts, drafts personalised outreach.", tags: ["SALES", "CRM"] },
  { name: "GRANT WRITER", icon: "📝", color: NEON_PURPLE, tier: "B" as const, stats: { SPD: 5, ACC: 9, CRE: 8 }, desc: "Finds relevant grants, drafts applications, tracks deadlines.", tags: ["FUNDING", "WRITING"] },
  { name: "CLIENT ONBOARDER", icon: "🤝", color: NEON_ORANGE, tier: "A" as const, stats: { SPD: 8, ACC: 8, CRE: 7 }, desc: "Sends welcome sequences, collects docs, sets up project boards.", tags: ["OPS", "AUTOMATION"] },
];

export const builderSteps = [
  { label: "NAME", value: "Proposal Writer", color: NEON_CYAN },
  { label: "ROLE", value: "Drafts client proposals from brief + template library", color: NEON_GREEN },
  { label: "TOOLS", value: "Google Docs  •  Asana  •  Web Search", color: NEON_YELLOW },
  { label: "VOICE", value: "Professional, concise, confident", color: NEON_PINK },
];

export const socialProof = [
  "EOS IMPLEMENTERS",
  "FITNESS COACHES",
  "AGENCY FOUNDERS",
  "CONSULTANTS",
  "OPERATORS",
  "SMALL TEAMS",
];

export const builderBullets = [
  { icon: "⚡", text: "No code, no prompting skills required", color: NEON_YELLOW },
  { icon: "🔧", text: "Connect Asana, email, docs, web search", color: NEON_CYAN },
  { icon: "🎭", text: "Set personality, tone, and guardrails", color: NEON_PINK },
  { icon: "🔄", text: "Iterate and refine as your needs change", color: NEON_GREEN },
];

// Reports demo data
export const reportEntries = [
  { title: "Competitor Analysis — Q2 2026", agent: "RESEARCHER", date: "2 hrs ago", color: NEON_GREEN, pages: 12 },
  { title: "Weekly Client Retro Summary", agent: "STRATEGIST", date: "Yesterday", color: NEON_CYAN, pages: 4 },
  { title: "Lead Pipeline — March Snapshot", agent: "LEAD QUALIFIER", date: "2 days ago", color: NEON_YELLOW, pages: 8 },
  { title: "Social Content Calendar — April", agent: "SOCIAL MEDIA MGR", date: "3 days ago", color: NEON_PINK, pages: 6 },
];

// Scheduled tasks demo data
export const scheduledTasks = [
  { name: "Morning news brief", agent: "RESEARCHER", schedule: "Weekdays 7:00 AM", color: NEON_GREEN, icon: "📰" },
  { name: "Weekly pipeline report", agent: "LEAD QUALIFIER", schedule: "Mondays 9:00 AM", color: NEON_YELLOW, icon: "📊" },
  { name: "Social post drafts", agent: "WRITER", schedule: "Tue / Thu 10:00 AM", color: NEON_PINK, icon: "📱" },
  { name: "Invoice follow-ups", agent: "BOOKKEEPER", schedule: "Fridays 2:00 PM", color: NEON_CYAN, icon: "💰" },
];
