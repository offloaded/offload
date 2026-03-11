// Neon color palette
export const NEON_PINK = "#ff2d7b";
export const NEON_CYAN = "#00f0ff";
export const NEON_YELLOW = "#ffe14d";
export const NEON_GREEN = "#39ff14";
export const NEON_PURPLE = "#b388ff";
export const NEON_ORANGE = "#ff8a65";
export const DARK_BG = "#0a0a12";
export const GRID_COLOR = "rgba(0, 240, 255, 0.08)";

// Hero chat demo — shows agents doing real work
export const heroMessages = [
  { name: "POLITICAL ANALYST", icon: "📰", color: NEON_CYAN, msg: "Your morning briefing is ready. Three items flagged — housing policy shift in the Senate and two state budget implications." },
  { name: "PROJECT MANAGER", icon: "📋", color: NEON_GREEN, msg: "Pulled your Asana data. 4 tasks overdue, 2 blocked. I've drafted a meeting agenda for Friday's leadership sync." },
  { name: "BOOKKEEPER", icon: "💰", color: NEON_YELLOW, msg: "Found 2 new invoices in your email. Created payment tasks with due dates. Your accounts receivable report is updated." },
  { name: "YOU", icon: "👤", color: NEON_PINK, msg: "Save the project status as a report and send me the CEO update draft.", isHuman: true },
];

// Features — the real differentiators
export const featureBlocks = [
  { title: "AGENT TEAMS", subtitle: "Collaboration, not just chat.", desc: "Put agents in a team and watch them work together. Each agent stays in their lane — only responding to topics within their expertise. Like a real team, not a noisy group chat.", color: NEON_CYAN, icon: "👥" },
  { title: "REPORTS & TEMPLATES", subtitle: "Work that persists.", desc: "Agents don't just chat — they produce structured reports using templates that encode your thinking frameworks. Risk assessments, scorecards, briefs — all in the format you define.", color: NEON_PINK, icon: "📄" },
  { title: "LIVE EDITING", subtitle: "Collaborate on the document.", desc: "Reports open side-by-side with the chat. Edit directly, click done, and your agent reviews the changes and suggests refinements. Say 'sounds good' and watch it update live.", color: NEON_GREEN, icon: "✏️" },
  { title: "AGENTS THAT LEARN", subtitle: "Your edits make them smarter.", desc: "When you edit an agent's report, those changes are stored. Next time, the agent considers your past feedback. Reports get better over time without retraining any model.", color: NEON_YELLOW, icon: "🧠" },
  { title: "BACKGROUND WORK", subtitle: "Agents that work while you don't.", desc: "Schedule agents to run daily briefings, monitor your email for invoices, or compile weekly digests. They produce reports on a schedule — you just review them.", color: NEON_CYAN, icon: "⏰" },
  { title: "KNOWLEDGE BASE", subtitle: "Ask questions across your documents.", desc: "Upload hundreds of documents and ask questions in plain English. Get trustworthy answers grounded in your actual data, with source references.", color: NEON_PINK, icon: "📚" },
];

// Marketplace agents
export const marketplaceAgents = [
  { name: "METRICS ANALYST", icon: "📊", color: NEON_CYAN, desc: "Weekly scorecards and KPI tracking" },
  { name: "CONTENT STRATEGIST", icon: "✍️", color: NEON_PINK, desc: "Content calendars and brand voice" },
  { name: "MEETING PREP", icon: "🎯", color: NEON_GREEN, desc: "Agendas, research, and action items" },
  { name: "LEAD QUALIFIER", icon: "🔥", color: NEON_YELLOW, desc: "Research, score, and draft outreach" },
  { name: "COMPETITOR INTEL", icon: "🔍", color: NEON_PURPLE, desc: "Track competitors and brief you" },
  { name: "RISK FLAGGER", icon: "⚠️", color: NEON_ORANGE, desc: "Spot emerging risks early" },
  { name: "NUTRITION PLANNER", icon: "🥗", color: NEON_GREEN, desc: "Macro-aligned meal plans" },
  { name: "SOP BUILDER", icon: "📋", color: NEON_CYAN, desc: "Document your processes" },
];

// The workflow loop
export const workflowSteps = [
  { num: "01", label: "DEFINE", desc: "Give agents a role, voice, and templates that encode what good looks like", color: NEON_CYAN },
  { num: "02", label: "COLLABORATE", desc: "Work with your agents in teams or DMs — they stay in their lane and produce structured reports", color: NEON_GREEN },
  { num: "03", label: "REFINE", desc: "Edit reports side-by-side with the chat. Your agent reviews changes and suggests improvements", color: NEON_YELLOW },
  { num: "04", label: "LEARN", desc: "Your edits are stored. Next time, agents produce better work. The system gets smarter through use", color: NEON_PINK },
];

// Use cases
export const useCases = [
  { emoji: "📰", title: "Daily briefings", desc: "Political analyst scans the web every morning and delivers a structured briefing before you start work" },
  { emoji: "📋", title: "Project status reports", desc: "Pulls data from Asana, generates a status report, and drafts a meeting agenda — one prompt, two outputs" },
  { emoji: "💰", title: "Automated bookkeeping", desc: "Monitors your email for invoices, creates payment tasks, and keeps your accounts receivable current — without being asked" },
  { emoji: "✍️", title: "CEO updates", desc: "Connects to your calendar and meeting notes, drafts a fortnightly update for leadership in 30 seconds instead of 45 minutes" },
  { emoji: "🥗", title: "Fitness and nutrition", desc: "Builds meal plans and training programs matched to your macros, goals, and schedule — with batch prep instructions" },
  { emoji: "✈️", title: "Trip planning", desc: "You and a partner chat with a travel agent in real time, plan an itinerary together, and save it as a report" },
];
