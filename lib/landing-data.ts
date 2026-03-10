// Neon color palette
export const NEON_PINK = "#ff2d7b";
export const NEON_CYAN = "#00f0ff";
export const NEON_YELLOW = "#ffe14d";
export const NEON_GREEN = "#39ff14";
export const DARK_BG = "#0a0a12";
export const GRID_COLOR = "rgba(0, 240, 255, 0.08)";

export const agents = [
  { name: "STRATEGIST", icon: "🧠", color: NEON_CYAN, msg: "I've drafted your Q2 roadmap based on last quarter's retro notes." },
  { name: "RESEARCHER", icon: "🔍", color: NEON_GREEN, msg: "Found 3 competitor case studies. Summary incoming." },
  { name: "WRITER", icon: "✍️", color: NEON_YELLOW, msg: "Blog post draft is ready. Matched your brand voice." },
  { name: "SCHEDULER", icon: "📅", color: NEON_PINK, msg: "Blocked 2 hours tomorrow for deep work. Moved the 1:1 to Thursday." },
];

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
  { name: "GRANT WRITER", icon: "📝", color: "#b388ff", tier: "B" as const, stats: { SPD: 5, ACC: 9, CRE: 8 }, desc: "Finds relevant grants, drafts applications, tracks deadlines.", tags: ["FUNDING", "WRITING"] },
  { name: "CLIENT ONBOARDER", icon: "🤝", color: "#ff8a65", tier: "A" as const, stats: { SPD: 8, ACC: 8, CRE: 7 }, desc: "Sends welcome sequences, collects docs, sets up project boards.", tags: ["OPS", "AUTOMATION"] },
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
];

export const builderBullets = [
  { icon: "⚡", text: "No code, no prompting skills required", color: NEON_YELLOW },
  { icon: "🔧", text: "Connect Asana, email, docs, web search", color: NEON_CYAN },
  { icon: "🎭", text: "Set personality, tone, and guardrails", color: NEON_PINK },
  { icon: "🔄", text: "Iterate and refine as your needs change", color: NEON_GREEN },
];
