import { useState } from "react";

const C = {
  bg: "#09090B", bg2: "#111113", surface: "#18181B", surface2: "#1F1F23",
  border: "#27272A", border2: "#3F3F46",
  text: "#FAFAFA", text2: "#A1A1AA", text3: "#71717A",
  accent: "#3B82F6", accent2: "#60A5FA", green: "#22C55E", green2: "#16A34A",
  amber: "#F59E0B", red: "#EF4444", purple: "#A78BFA",
};
const f = `'Outfit', -apple-system, sans-serif`;

// Mock data
const waitlistData = [
  { id: 1, email: "sarah.chen@gmail.com", date: "2026-03-07T14:22:00", status: "pending", source: "hero" },
  { id: 2, email: "mike.ross@outlook.com", date: "2026-03-07T13:15:00", status: "pending", source: "footer" },
  { id: 3, email: "j.williams@company.co", date: "2026-03-07T11:44:00", status: "approved", source: "hero" },
  { id: 4, email: "anna.kovacs@startup.io", date: "2026-03-07T10:30:00", status: "pending", source: "hero" },
  { id: 5, email: "tom.bradley@fitness.com.au", date: "2026-03-07T09:12:00", status: "pending", source: "twitter" },
  { id: 6, email: "lisa.nguyen@consultancy.com", date: "2026-03-06T22:45:00", status: "approved", source: "hero" },
  { id: 7, email: "david.park@techfirm.co", date: "2026-03-06T20:18:00", status: "pending", source: "footer" },
  { id: 8, email: "emma.thompson@agency.com.au", date: "2026-03-06T18:33:00", status: "emailed", source: "hero" },
  { id: 9, email: "r.martinez@smallbiz.com", date: "2026-03-06T16:05:00", status: "pending", source: "hero" },
  { id: 10, email: "kate.oconnor@eos.com.au", date: "2026-03-06T14:50:00", status: "approved", source: "twitter" },
  { id: 11, email: "ben.foster@design.co", date: "2026-03-06T12:20:00", status: "pending", source: "hero" },
  { id: 12, email: "maya.singh@health.io", date: "2026-03-06T10:00:00", status: "emailed", source: "footer" },
];

const trafficData = [
  { day: "Mon", views: 45, uniques: 32 },
  { day: "Tue", views: 78, uniques: 55 },
  { day: "Wed", views: 134, uniques: 89 },
  { day: "Thu", views: 267, uniques: 178 },
  { day: "Fri", views: 423, uniques: 290 },
  { day: "Sat", views: 389, uniques: 265 },
  { day: "Sun", views: 312, uniques: 210 },
];

const productMetrics = {
  totalUsers: 3,
  activeToday: 2,
  totalAgents: 14,
  totalMessages: 847,
  totalDocs: 73,
  totalTasks: 12,
  avgResponseTime: "2.3s",
  apiCostToday: "$4.82",
  apiCostMonth: "$67.40",
  topAgents: [
    { name: "Council Decisions Advisor", messages: 234, docs: 60 },
    { name: "HR Business Advisor", messages: 189, docs: 5 },
    { name: "Scrum Master", messages: 156, docs: 2 },
    { name: "Government Analyst", messages: 134, docs: 4 },
  ],
};

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px" }}>
      <div style={{ fontSize: 12, color: C.text3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color || C.text, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ data, maxVal, color }) {
  const max = maxVal || Math.max(...data.map(d => d.views));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: "100%", background: color || C.accent, borderRadius: 3,
            height: `${(d.views / max) * 50}px`, opacity: 0.8, minHeight: 2,
          }} />
          <span style={{ fontSize: 10, color: C.text3 }}>{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function WaitlistTab() {
  const [list, setList] = useState(waitlistData);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState("all");
  const [emailModal, setEmailModal] = useState(null); // null | "waitlist" | "approved"
  const [search, setSearch] = useState("");

  const filtered = list.filter(item => {
    if (filter !== "all" && item.status !== filter) return false;
    if (search && !item.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: list.length,
    pending: list.filter(i => i.status === "pending").length,
    emailed: list.filter(i => i.status === "emailed").length,
    approved: list.filter(i => i.status === "approved").length,
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const bulkAction = (status) => {
    setList(prev => prev.map(i => selected.has(i.id) ? { ...i, status } : i));
    setSelected(new Set());
  };

  const formatDate = (d) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now - date;
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  const statusColors = {
    pending: { bg: "rgba(245,158,11,0.1)", color: C.amber, label: "Pending" },
    emailed: { bg: "rgba(59,130,246,0.1)", color: C.accent2, label: "Emailed" },
    approved: { bg: "rgba(34,197,94,0.1)", color: C.green, label: "Approved" },
  };

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total signups" value={counts.all} />
        <StatCard label="Pending" value={counts.pending} color={C.amber} />
        <StatCard label="Emailed" value={counts.emailed} color={C.accent2} />
        <StatCard label="Approved" value={counts.approved} color={C.green} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails..."
          style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontFamily: f, outline: "none", width: 220 }}
        />
        <div style={{ display: "flex", gap: 2, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {["all", "pending", "emailed", "approved"].map(f2 => (
            <button key={f2} onClick={() => setFilter(f2)} style={{
              padding: "8px 14px", border: "none", fontSize: 12, fontWeight: 500, fontFamily: f,
              background: filter === f2 ? C.surface2 : "transparent",
              color: filter === f2 ? C.text : C.text3, cursor: "pointer",
              textTransform: "capitalize",
            }}>{f2} ({counts[f2]})</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.text2 }}>{selected.size} selected</span>
            <button onClick={() => { bulkAction("emailed"); setEmailModal("waitlist"); }} style={{
              padding: "8px 16px", borderRadius: 8, background: C.accent, color: "#fff",
              border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: f,
            }}>Send waitlist email</button>
            <button onClick={() => { bulkAction("approved"); setEmailModal("approved"); }} style={{
              padding: "8px 16px", borderRadius: 8, background: C.green2, color: "#fff",
              border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: f,
            }}>Approve & send invite</button>
          </div>
        )}
      </div>

      {/* Email sent confirmation */}
      {emailModal && (
        <div style={{
          padding: "14px 20px", borderRadius: 10, marginBottom: 16,
          background: emailModal === "approved" ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.08)",
          border: `1px solid ${emailModal === "approved" ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)"}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 14, color: emailModal === "approved" ? C.green : C.accent2 }}>
            {emailModal === "approved" ? "Approval emails sent. Users can now sign up." : "Waitlist confirmation emails sent."}
          </span>
          <button onClick={() => setEmailModal(null)} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 80px",
          padding: "10px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center",
        }}>
          <div>
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
              onChange={selectAll} style={{ cursor: "pointer" }} />
          </div>
          <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Email</div>
          <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Source</div>
          <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Signed up</div>
          <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Status</div>
        </div>
        {filtered.map(item => {
          const st = statusColors[item.status];
          return (
            <div key={item.id} style={{
              display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 80px",
              padding: "12px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center",
              background: selected.has(item.id) ? "rgba(59,130,246,0.05)" : "transparent",
            }}>
              <div>
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} style={{ cursor: "pointer" }} />
              </div>
              <div style={{ fontSize: 14, color: C.text }}>{item.email}</div>
              <div style={{ fontSize: 12, color: C.text3 }}>{item.source}</div>
              <div style={{ fontSize: 12, color: C.text3 }}>{formatDate(item.date)}</div>
              <div>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
                  background: st.bg, color: st.color,
                }}>{st.label}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: C.text3, fontSize: 14 }}>No results found</div>
        )}
      </div>
    </div>
  );
}

function TrafficTab() {
  const totalViews = trafficData.reduce((a, b) => a + b.views, 0);
  const totalUniques = trafficData.reduce((a, b) => a + b.uniques, 0);
  const conversionRate = ((waitlistData.length / totalUniques) * 100).toFixed(1);
  const avgTime = "1m 42s";
  const bounceRate = "34%";
  const topSources = [
    { source: "Direct / typed URL", visits: 340, pct: "41%" },
    { source: "Twitter / X", visits: 265, pct: "32%" },
    { source: "Google Search", visits: 142, pct: "17%" },
    { source: "LinkedIn", visits: 58, pct: "7%" },
    { source: "Other", visits: 24, pct: "3%" },
  ];
  const topPages = [
    { page: "/ (landing)", views: 1420, avgTime: "1m 52s" },
    { page: "/#features", views: 680, avgTime: "45s" },
    { page: "/#teams", views: 520, avgTime: "38s" },
    { page: "/#waitlist", views: 445, avgTime: "1m 10s" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Views (7d)" value={totalViews.toLocaleString()} />
        <StatCard label="Unique visitors" value={totalUniques.toLocaleString()} />
        <StatCard label="Waitlist conversion" value={`${conversionRate}%`} color={C.green} />
        <StatCard label="Bounce rate" value={bounceRate} color={C.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {/* Traffic chart */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Page views</div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 20 }}>Last 7 days</div>
          <MiniBar data={trafficData} />
        </div>
        {/* Sources */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Traffic sources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topSources.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text }}>{s.source}</div>
                </div>
                <div style={{ fontSize: 13, color: C.text2, width: 50, textAlign: "right" }}>{s.visits}</div>
                <div style={{ fontSize: 12, color: C.text3, width: 40, textAlign: "right" }}>{s.pct}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top pages */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Top pages</div>
        </div>
        {topPages.map((p, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 100px 100px",
            padding: "12px 20px", borderBottom: i < topPages.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <div style={{ fontSize: 14, color: C.text }}>{p.page}</div>
            <div style={{ fontSize: 13, color: C.text2, textAlign: "right" }}>{p.views} views</div>
            <div style={{ fontSize: 13, color: C.text3, textAlign: "right" }}>{p.avgTime}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductTab() {
  const m = productMetrics;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total users" value={m.totalUsers} />
        <StatCard label="Active today" value={m.activeToday} color={C.green} />
        <StatCard label="Total agents" value={m.totalAgents} />
        <StatCard label="Messages sent" value={m.totalMessages} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Documents uploaded" value={m.totalDocs} />
        <StatCard label="Scheduled tasks" value={m.totalTasks} />
        <StatCard label="Avg response time" value={m.avgResponseTime} color={C.accent2} />
        <StatCard label="API cost today" value={m.apiCostToday} color={C.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Top agents */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Most active agents</div>
          </div>
          {m.topAgents.map((a, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 80px 60px",
              padding: "12px 20px", borderBottom: i < m.topAgents.length - 1 ? `1px solid ${C.border}` : "none",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: [C.accent, C.green, C.purple, C.amber][i] + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 600, color: [C.accent2, C.green, C.purple, C.amber][i],
                }}>{a.name.charAt(0)}</div>
                <span style={{ fontSize: 13, color: C.text }}>{a.name}</span>
              </div>
              <div style={{ fontSize: 12, color: C.text2, textAlign: "right" }}>{a.messages} msgs</div>
              <div style={{ fontSize: 12, color: C.text3, textAlign: "right" }}>{a.docs} docs</div>
            </div>
          ))}
        </div>

        {/* Cost breakdown */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 20 }}>API costs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Claude API (chat)", cost: "$52.30", pct: 78 },
              { label: "Embeddings", cost: "$8.20", pct: 12 },
              { label: "Tavily (search)", cost: "$4.90", pct: 7 },
              { label: "Other", cost: "$2.00", pct: 3 },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.text2 }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: C.text }}>{item.cost}</span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                  <div style={{
                    height: "100%", borderRadius: 2, width: `${item.pct}%`,
                    background: i === 0 ? C.accent : i === 1 ? C.green : i === 2 ? C.amber : C.text3,
                  }} />
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Month total</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.apiCostMonth}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("waitlist");
  const tabs = [
    { id: "waitlist", label: "Waitlist" },
    { id: "traffic", label: "Site Traffic" },
    { id: "product", label: "Product Metrics" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: f }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*, *::before, *::after { box-sizing: border-box; } body { margin: 0; }`}</style>

      {/* Header */}
      <div style={{
        padding: "16px 32px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.bg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>offloaded</span>
          <span style={{ fontSize: 12, color: C.text3, background: C.surface, padding: "3px 10px", borderRadius: 20, border: `1px solid ${C.border}` }}>admin</span>
        </div>
        <a href="/" style={{ fontSize: 13, color: C.text3, textDecoration: "none" }}>← Back to app</a>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 28, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden", width: "fit-content" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 20px", border: "none", fontSize: 14, fontWeight: 500, fontFamily: f,
              background: tab === t.id ? C.surface2 : "transparent",
              color: tab === t.id ? C.text : C.text3, cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "waitlist" && <WaitlistTab />}
        {tab === "traffic" && <TrafficTab />}
        {tab === "product" && <ProductTab />}
      </div>
    </div>
  );
}
