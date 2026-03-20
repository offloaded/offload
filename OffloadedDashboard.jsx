import { useState } from "react";

const workItems = [
  { icon: "email", title: "Q1 Planning brief — from Karlee", meta: "Strategy Agent · via email · 12 min ago", badge: "New", badgeType: "new" },
  { icon: "report", title: "Weekly directorate comms — March 20", meta: "Comms Agent · report · running 4 min", badge: "Running", badgeType: "running" },
  { icon: "email", title: "Fuel security risk briefing request", meta: "Risk Agent · via email · 1 hr ago", badge: "Running", badgeType: "running" },
  { icon: "report", title: "Holiday parks occupancy summary", meta: "Ops Agent · report · completed 9:14am", badge: "Done", badgeType: "done" },
  { icon: "sched", title: "Daily political briefing — The Public Briefing", meta: "Briefing Agent · scheduled · due 7:00am", badge: "Overdue", badgeType: "overdue" },
];

const agents = [
  { initials: "SA", name: "Strategy Agent", status: "Working on Q1 Planning brief", avatarBg: "#EEEDFE", avatarColor: "#3C3489", active: true },
  { initials: "CA", name: "Comms Agent", status: "Drafting directorate comms", avatarBg: "#E1F5EE", avatarColor: "#085041", active: true },
  { initials: "RA", name: "Risk Agent", status: "Fuel security analysis", avatarBg: "#FAECE7", avatarColor: "#712B13", active: true },
  { initials: "OA", name: "Ops Agent", status: "Idle", avatarBg: "#E6F1FB", avatarColor: "#0C447C", active: false },
];

const scheduled = [
  { time: "12:00pm", name: "Permit pipeline report", agent: "Ops Agent" },
  { time: "3:00pm", name: "Community sentiment summary", agent: "Comms Agent" },
  { time: "Tomorrow", name: "Weekly parks occupancy", agent: "Ops Agent" },
];

const feedEvents = [
  { dot: "#1D9E75", text: "Email received from Karlee — routed to ", bold: "Strategy Agent", text2: " as Q1 Planning brief", time: "9:48am" },
  { dot: "#185FA5", bold: "Strategy Agent", text2: " started work on Q1 Planning brief", time: "9:49am" },
  { dot: "#185FA5", bold: "Comms Agent", text2: " started Weekly directorate comms", time: "9:52am" },
  { dot: "#534AB7", bold: "Ops Agent", text2: " generated document — Parks Occupancy Mar 20.docx ready to download", time: "9:14am" },
  { dot: "#1D9E75", bold: "Ops Agent", text2: " completed Holiday parks occupancy summary", time: "9:14am" },
  { dot: "#1D9E75", text: "Email received from CEO — routed to ", bold: "Risk Agent", text2: " as Fuel security briefing", time: "8:57am" },
  { dot: "#BA7517", bold: "Briefing Agent", text2: " — Daily political briefing missed scheduled run at 7:00am", time: "7:00am" },
  { dot: "#1D9E75", bold: "Risk Agent", text2: " completed Strait of Hormuz scenario analysis — 3 scenarios modelled", time: "Yesterday 5:43pm" },
];

const iconStyles = {
  email: { bg: "#E1F5EE", color: "#0F6E56", symbol: "✉" },
  report: { bg: "#E6F1FB", color: "#185FA5", symbol: "▤" },
  sched: { bg: "#FAEEDA", color: "#854F0B", symbol: "◷" },
};

const badgeStyles = {
  new: { bg: "#E1F5EE", color: "#085041" },
  running: { bg: "#E6F1FB", color: "#0C447C" },
  done: { bg: "#EAF3DE", color: "#3B6D11" },
  overdue: { bg: "#FAEEDA", color: "#854F0B" },
};

const themes = {
  light: {
    pageBg: "#F1EFE8",
    cardBg: "#FFFFFF",
    cardBorder: "#C8C6BE",
    cardHeadBg: "#F5F4EF",
    textPrimary: "#1A1917",
    textSecondary: "#5F5E5A",
    textTertiary: "#8F8E8A",
    rowBorder: "#E4E2DC",
    idleDot: "#C8C6BE",
    toggleBg: "#E4E2DC",
    toggleKnob: "#FFFFFF",
  },
  dark: {
    pageBg: "#1A1917",
    cardBg: "#242320",
    cardBorder: "#3A3835",
    cardHeadBg: "#2C2A27",
    textPrimary: "#F0EEE8",
    textSecondary: "#9A9890",
    textTertiary: "#6A6864",
    rowBorder: "#2E2C29",
    idleDot: "#3A3835",
    toggleBg: "#3A3835",
    toggleKnob: "#9A9890",
  },
};

function MetricCard({ label, value, sub, subColor, t }) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: t.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: t.textPrimary }}>{value}</div>
      <div style={{ fontSize: 11, marginTop: 4, color: subColor || t.textTertiary }}>{sub}</div>
    </div>
  );
}

function WorkItemRow({ icon, title, meta, badge, badgeType, t }) {
  const ic = iconStyles[icon];
  const bd = badgeStyles[badgeType];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${t.rowBorder}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>
        {ic.symbol}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{meta}</div>
      </div>
      <div style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 500, flexShrink: 0, background: bd.bg, color: bd.color }}>{badge}</div>
    </div>
  );
}

function AgentRow({ initials, name, status, avatarBg, avatarColor, active, t, isLast }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: isLast ? "none" : `1px solid ${t.rowBorder}` }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg, color: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{name}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{status}</div>
      </div>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#1D9E75" : t.idleDot, flexShrink: 0 }} />
    </div>
  );
}

function SchedRow({ time, name, agent, t, isLast }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: isLast ? "none" : `1px solid ${t.rowBorder}`, alignItems: "flex-start" }}>
      <div style={{ fontSize: 11, color: t.textSecondary, minWidth: 54, flexShrink: 0, paddingTop: 1 }}>{time}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{name}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{agent}</div>
      </div>
    </div>
  );
}

function FeedRow({ dot, text, bold, text2, time, t, isLast }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: isLast ? "none" : `1px solid ${t.rowBorder}`, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14, paddingTop: 5 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        {!isLast && <div style={{ width: 1, flex: 1, background: t.rowBorder, marginTop: 4, minHeight: 16 }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.5 }}>
          {text}<strong style={{ fontWeight: 500 }}>{bold}</strong>{text2}
        </div>
        <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 3 }}>{time}</div>
      </div>
    </div>
  );
}

function Card({ children, t, style }) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHead({ title, link, t }) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.cardBorder}`, background: t.cardHeadBg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: t.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      {link && <span style={{ fontSize: 12, color: t.textTertiary, cursor: "pointer" }}>{link}</span>}
    </div>
  );
}

export default function Dashboard() {
  const [isDark, setIsDark] = useState(false);
  const t = isDark ? themes.dark : themes.light;

  return (
    <div style={{ background: t.pageBg, padding: 24, minHeight: "100vh", fontFamily: "var(--font-sans, system-ui, sans-serif)", transition: "background 0.2s" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 500, color: t.textPrimary }}>Good morning, Nick</div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 3 }}>Friday, 20 March 2026 — 4 agents active, 2 items need attention</div>
        </div>
        <div
          onClick={() => setIsDark(!isDark)}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
        >
          <span style={{ fontSize: 12, color: t.textSecondary, minWidth: 32 }}>{isDark ? "Dark" : "Light"}</span>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: t.toggleBg, position: "relative", transition: "background 0.2s" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: t.toggleKnob, position: "absolute", top: 3, left: 3, transition: "transform 0.2s", transform: isDark ? "translateX(16px)" : "translateX(0)" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
        <MetricCard label="Active work items" value={7} sub="↑ 3 since yesterday" subColor="#1D9E75" t={t} />
        <MetricCard label="Completed today" value={4} sub="across 3 agents" t={t} />
        <MetricCard label="Scheduled today" value={3} sub="1 overdue" subColor="#BA7517" t={t} />
        <MetricCard label="Emails ingested" value={2} sub="new work items created" t={t} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)", gap: 16, marginBottom: 16 }}>

        <Card t={t}>
          <CardHead title="Work items" link="View all →" t={t} />
          {workItems.map((w, i) => (
            <WorkItemRow key={i} {...w} t={t} />
          ))}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card t={t}>
            <CardHead title="Agent activity" t={t} />
            {agents.map((a, i) => (
              <AgentRow key={i} {...a} t={t} isLast={i === agents.length - 1} />
            ))}
          </Card>

          <Card t={t}>
            <CardHead title="Upcoming scheduled" link="View all →" t={t} />
            {scheduled.map((s, i) => (
              <SchedRow key={i} {...s} t={t} isLast={i === scheduled.length - 1} />
            ))}
          </Card>
        </div>

      </div>

      <Card t={t}>
        <CardHead title="Activity feed" link="View full history →" t={t} />
        {feedEvents.map((e, i) => (
          <FeedRow key={i} {...e} t={t} isLast={i === feedEvents.length - 1} />
        ))}
      </Card>

    </div>
  );
}
