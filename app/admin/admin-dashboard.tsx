"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const C = {
  bg: "#09090B", bg2: "#111113", surface: "#18181B", surface2: "#1F1F23",
  border: "#27272A", border2: "#3F3F46",
  text: "#FAFAFA", text2: "#A1A1AA", text3: "#71717A",
  accent: "#3B82F6", accent2: "#60A5FA", green: "#22C55E", green2: "#16A34A",
  amber: "#F59E0B", red: "#EF4444", purple: "#A78BFA",
};
const f = "'Outfit', -apple-system, sans-serif";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number) {
  return `$${n.toFixed(2)}`;
}

// ─── Shared Components ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px" }}>
      <div style={{ fontSize: 12, color: C.text3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color || C.text, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ data, maxVal, color }: { data: { day: string; views: number }[]; maxVal?: number; color?: string }) {
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

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null || limit === undefined) {
    return <span style={{ fontSize: 12, color: C.text3 }}>No limit</span>;
  }
  const pct = Math.min((used / limit) * 100, 100);
  const over = used > limit;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, minWidth: 60 }}>
        <div style={{
          height: "100%", borderRadius: 3,
          width: `${pct}%`,
          background: over ? C.red : pct > 80 ? C.amber : C.accent,
        }} />
      </div>
      <span style={{ fontSize: 11, color: C.text3, whiteSpace: "nowrap" }}>
        {formatNumber(used)} / {formatNumber(limit)}
      </span>
      {over && <span style={{ fontSize: 14, lineHeight: 1 }} title="Over limit">&#9888;</span>}
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 40, textAlign: "center", color: C.text3, fontSize: 14 }}>Loading...</div>;
}

// ─── Waitlist Tab ───────────────────────────────────────────────────────────

function WaitlistTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/waitlist?${params}`);
    if (res.ok) setList(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [filter, search]);

  const filtered = list;

  const counts = {
    all: list.length,
    pending: list.filter((i: any) => i.status === "pending").length,
    emailed: list.filter((i: any) => i.status === "emailed").length,
    approved: list.filter((i: any) => i.status === "approved").length,
  };

  // If filtering client-side with the "all" filter, we need all entries for counts
  // But since we fetch with status param, counts when filtered won't be accurate
  // So fetch all for counts when needed
  const [allList, setAllList] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/admin/waitlist").then(r => r.ok ? r.json() : []).then(setAllList);
  }, [list]);

  const allCounts = {
    all: allList.length,
    pending: allList.filter((i: any) => i.status === "pending").length,
    emailed: allList.filter((i: any) => i.status === "emailed").length,
    approved: allList.filter((i: any) => i.status === "approved").length,
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i: any) => i.id)));
  };

  const bulkAction = async (status: string) => {
    const ids = Array.from(selected);
    const emails = filtered.filter((i: any) => selected.has(i.id)).map((i: any) => i.email);

    const patchRes = await fetch("/api/admin/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    });

    if (patchRes.ok) {
      const emailType = status === "approved" ? "approved" : "waitlist";
      await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, type: emailType }),
      });
      setBanner(emailType);
      setSelected(new Set());
      fetchData();
    }
  };

  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: "rgba(245,158,11,0.1)", color: C.amber, label: "Pending" },
    emailed: { bg: "rgba(59,130,246,0.1)", color: C.accent2, label: "Emailed" },
    approved: { bg: "rgba(34,197,94,0.1)", color: C.green, label: "Approved" },
  };

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total signups" value={allCounts.all} />
        <StatCard label="Pending" value={allCounts.pending} color={C.amber} />
        <StatCard label="Emailed" value={allCounts.emailed} color={C.accent2} />
        <StatCard label="Approved" value={allCounts.approved} color={C.green} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails..."
          style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontFamily: f, outline: "none", width: 220 }}
        />
        <div style={{ display: "flex", gap: 2, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {(["all", "pending", "emailed", "approved"] as const).map(f2 => (
            <button key={f2} onClick={() => setFilter(f2)} style={{
              padding: "8px 14px", border: "none", fontSize: 12, fontWeight: 500, fontFamily: f,
              background: filter === f2 ? C.surface2 : "transparent",
              color: filter === f2 ? C.text : C.text3, cursor: "pointer",
              textTransform: "capitalize",
            }}>{f2} ({allCounts[f2]})</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.text2 }}>{selected.size} selected</span>
            <button onClick={() => bulkAction("emailed")} style={{
              padding: "8px 16px", borderRadius: 8, background: C.accent, color: "#fff",
              border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: f,
            }}>Send waitlist email</button>
            <button onClick={() => bulkAction("approved")} style={{
              padding: "8px 16px", borderRadius: 8, background: C.green2, color: "#fff",
              border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: f,
            }}>Approve &amp; send invite</button>
          </div>
        )}
      </div>

      {/* Success banner */}
      {banner && (
        <div style={{
          padding: "14px 20px", borderRadius: 10, marginBottom: 16,
          background: banner === "approved" ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.08)",
          border: `1px solid ${banner === "approved" ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)"}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 14, color: banner === "approved" ? C.green : C.accent2 }}>
            {banner === "approved" ? "Approval emails sent. Users can now sign up." : "Waitlist confirmation emails sent."}
          </span>
          <button onClick={() => setBanner(null)} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", fontSize: 16 }}>&#10005;</button>
        </div>
      )}

      {/* Table */}
      {loading ? <Loading /> : (
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
          {filtered.map((item: any) => {
            const st = statusColors[item.status] || statusColors.pending;
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
                <div style={{ fontSize: 12, color: C.text3 }}>{formatDate(item.date || item.created_at)}</div>
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
      )}
    </div>
  );
}

// ─── Site Traffic Tab ───────────────────────────────────────────────────────

function TrafficTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const res = await fetch("/api/admin/traffic");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  if (loading || !data) return <Loading />;

  const { daily = [], totalViews = 0, totalUniques = 0, conversionRate = "0", bounceRate = "0%", topSources = [], topPages = [] } = data;

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
          <MiniBar data={daily.map((d: any) => ({ day: d.day, views: d.views }))} />
        </div>
        {/* Sources */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Traffic sources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topSources.map((s: any, i: number) => (
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
        {topPages.map((p: any, i: number) => (
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

// ─── Product Metrics Tab ────────────────────────────────────────────────────

function ProductTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const res = await fetch("/api/admin/metrics");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  if (loading || !data) return <Loading />;

  const m = data;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total users" value={m.totalUsers ?? 0} />
        <StatCard label="Active today" value={m.activeToday ?? 0} color={C.green} />
        <StatCard label="Total agents" value={m.totalAgents ?? 0} />
        <StatCard label="Messages sent" value={m.totalMessages ?? 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Documents uploaded" value={m.totalDocs ?? 0} />
        <StatCard label="Scheduled tasks" value={m.totalTasks ?? 0} />
        <StatCard label="Avg response time" value={m.avgResponseTime ?? "-"} color={C.accent2} />
        <StatCard label="API cost today" value={m.apiCostToday ?? "$0.00"} color={C.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Top agents */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Most active agents</div>
          </div>
          {(m.topAgents ?? []).map((a: any, i: number) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 80px 60px",
              padding: "12px 20px", borderBottom: i < (m.topAgents ?? []).length - 1 ? `1px solid ${C.border}` : "none",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: [C.accent, C.green, C.purple, C.amber][i % 4] + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 600, color: [C.accent2, C.green, C.purple, C.amber][i % 4],
                }}>{(a.name || "?").charAt(0)}</div>
                <span style={{ fontSize: 13, color: C.text }}>{a.name}</span>
              </div>
              <div style={{ fontSize: 12, color: C.text2, textAlign: "right" }}>{a.messages} msgs</div>
              <div style={{ fontSize: 12, color: C.text3, textAlign: "right" }}>{a.docs} docs</div>
            </div>
          ))}
          {(!m.topAgents || m.topAgents.length === 0) && (
            <div style={{ padding: 20, textAlign: "center", color: C.text3, fontSize: 13 }}>No agents yet</div>
          )}
        </div>

        {/* Cost breakdown */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 20 }}>API costs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(m.costBreakdown ?? []).map((item: any, i: number) => (
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
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.apiCostMonth ?? "$0.00"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [limitInput, setLimitInput] = useState("");

  async function fetchUsers() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("sort", sort);
    params.set("order", order);
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, [search, sort, order]);

  async function fetchDetail(id: string) {
    setDetailLoading(true);
    const res = await fetch(`/api/admin/users/${id}`);
    if (res.ok) {
      const d = await res.json();
      setDetail(d);
      setLimitInput(d.monthly_token_limit != null ? String(d.monthly_token_limit) : "");
    }
    setDetailLoading(false);
  }

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(col);
      setOrder("desc");
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
    } else {
      setExpandedId(id);
      fetchDetail(id);
    }
  };

  const handleSuspend = async (id: string, suspended: boolean) => {
    await fetch(`/api/admin/users/${id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended }),
    });
    fetchDetail(id);
    fetchUsers();
  };

  const handleSetLimit = async (id: string) => {
    const val = parseInt(limitInput, 10);
    if (isNaN(val) || val <= 0) return;
    await fetch(`/api/admin/users/${id}/limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthly_token_limit: val }),
    });
    fetchDetail(id);
    fetchUsers();
  };

  const handleRemoveLimit = async (id: string) => {
    await fetch(`/api/admin/users/${id}/limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthly_token_limit: null }),
    });
    setLimitInput("");
    fetchDetail(id);
    fetchUsers();
  };

  const sortIcon = (col: string) => {
    if (sort !== col) return "";
    return order === "asc" ? " \u25B2" : " \u25BC";
  };

  const colHeaderStyle = (col: string): React.CSSProperties => ({
    fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em",
    fontWeight: 600, cursor: "pointer", userSelect: "none",
    background: sort === col ? C.surface2 : "transparent",
    padding: "4px 6px", borderRadius: 4,
  });

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
          style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontFamily: f, outline: "none", width: 280 }}
        />
      </div>

      {loading ? <Loading /> : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 90px 90px 60px 70px 80px 70px 120px 80px",
            padding: "10px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center", gap: 4,
          }}>
            <div style={colHeaderStyle("email")} onClick={() => toggleSort("email")}>Email{sortIcon("email")}</div>
            <div style={colHeaderStyle("created_at")} onClick={() => toggleSort("created_at")}>Signed up{sortIcon("created_at")}</div>
            <div style={colHeaderStyle("last_active")} onClick={() => toggleSort("last_active")}>Last active{sortIcon("last_active")}</div>
            <div style={colHeaderStyle("agents")} onClick={() => toggleSort("agents")}>Agents{sortIcon("agents")}</div>
            <div style={colHeaderStyle("messages")} onClick={() => toggleSort("messages")}>Messages{sortIcon("messages")}</div>
            <div style={colHeaderStyle("month_tokens")} onClick={() => toggleSort("month_tokens")}>Tokens{sortIcon("month_tokens")}</div>
            <div style={colHeaderStyle("cost")} onClick={() => toggleSort("cost")}>Cost{sortIcon("cost")}</div>
            <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Usage</div>
            <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Status</div>
          </div>

          {users.map((user: any) => (
            <div key={user.id}>
              {/* User row */}
              <div onClick={() => toggleExpand(user.id)} style={{
                display: "grid", gridTemplateColumns: "1fr 90px 90px 60px 70px 80px 70px 120px 80px",
                padding: "12px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center", gap: 4,
                cursor: "pointer", background: expandedId === user.id ? "rgba(59,130,246,0.05)" : "transparent",
              }}>
                <div style={{ fontSize: 14, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{formatDate(user.created_at)}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{user.last_active ? formatDate(user.last_active) : "-"}</div>
                <div style={{ fontSize: 12, color: C.text2, textAlign: "center" }}>{user.agents ?? 0}</div>
                <div style={{ fontSize: 12, color: C.text2, textAlign: "center" }}>{formatNumber(user.messages ?? 0)}</div>
                <div style={{ fontSize: 12, color: C.text2, textAlign: "center" }}>{formatNumber(user.month_tokens ?? 0)}</div>
                <div style={{ fontSize: 12, color: C.text2, textAlign: "center" }}>{formatCost(user.cost ?? 0)}</div>
                <div>
                  <UsageBar used={user.month_tokens ?? 0} limit={user.monthly_token_limit} />
                </div>
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
                    background: user.suspended ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                    color: user.suspended ? C.red : C.green,
                  }}>{user.suspended ? "Suspended" : "Active"}</span>
                </div>
              </div>

              {/* Expanded detail panel */}
              {expandedId === user.id && (
                <div style={{
                  padding: 24, background: C.bg2, borderBottom: `1px solid ${C.border}`,
                  border: `1px solid ${C.border}`, borderTop: "none",
                }}>
                  {detailLoading ? <Loading /> : detail ? (
                    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
                      {/* Left side */}
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>{detail.email}</div>
                        <div style={{ fontSize: 12, color: C.text3, marginBottom: 20 }}>
                          Joined {formatDate(detail.created_at)}
                          {detail.last_active && ` \u00B7 Last active ${formatDate(detail.last_active)}`}
                        </div>

                        {/* Suspend / Reactivate */}
                        <button onClick={() => handleSuspend(user.id, !detail.suspended)} style={{
                          padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 500,
                          cursor: "pointer", fontFamily: f, marginBottom: 20, width: "100%",
                          background: detail.suspended ? C.green2 : C.red, color: "#fff",
                        }}>{detail.suspended ? "Reactivate user" : "Suspend user"}</button>

                        {/* Usage limit */}
                        <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>Monthly token limit</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <input value={limitInput} onChange={e => setLimitInput(e.target.value)}
                            placeholder={detail.monthly_token_limit != null ? String(detail.monthly_token_limit) : "No limit"}
                            style={{
                              padding: "8px 12px", borderRadius: 8, background: C.surface,
                              border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontFamily: f,
                              outline: "none", flex: 1,
                            }}
                          />
                          <button onClick={() => handleSetLimit(user.id)} style={{
                            padding: "8px 14px", borderRadius: 8, background: C.accent, color: "#fff",
                            border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: f,
                          }}>Set limit</button>
                        </div>
                        {detail.monthly_token_limit != null && (
                          <button onClick={() => handleRemoveLimit(user.id)} style={{
                            padding: "6px 12px", borderRadius: 6, background: "transparent",
                            border: `1px solid ${C.border}`, color: C.text3, fontSize: 12,
                            cursor: "pointer", fontFamily: f,
                          }}>Remove limit</button>
                        )}
                      </div>

                      {/* Right side */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {/* Daily token usage chart */}
                        {detail.dailyTokens && detail.dailyTokens.length > 0 && (
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Token usage (30d)</div>
                            <div style={{ fontSize: 11, color: C.text3, marginBottom: 14 }}>Daily tokens consumed</div>
                            <MiniBar
                              data={detail.dailyTokens.map((d: any) => ({ day: d.day, views: d.tokens }))}
                              color={C.accent}
                            />
                          </div>
                        )}

                        {/* Stats grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Agents</div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{detail.agents ?? 0}</div>
                          </div>
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Documents</div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{detail.documents ?? 0}</div>
                          </div>
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Tasks</div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>
                              {detail.tasks_active ?? 0}
                              <span style={{ fontSize: 11, color: C.text3 }}> / {detail.tasks_paused ?? 0} paused</span>
                            </div>
                          </div>
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Conversations</div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{detail.conversations ?? 0}</div>
                          </div>
                        </div>

                        {/* Agents list */}
                        {detail.agentList && detail.agentList.length > 0 && (
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.text }}>
                              Agents
                            </div>
                            {detail.agentList.map((a: any, i: number) => (
                              <div key={i} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "10px 16px",
                                borderBottom: i < detail.agentList.length - 1 ? `1px solid ${C.border}` : "none",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{
                                    width: 24, height: 24, borderRadius: 6,
                                    background: [C.accent, C.green, C.purple, C.amber][i % 4] + "20",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 11, fontWeight: 600, color: [C.accent2, C.green, C.purple, C.amber][i % 4],
                                  }}>{(a.name || "?").charAt(0)}</div>
                                  <span style={{ fontSize: 13, color: C.text }}>{a.name}</span>
                                </div>
                                <span style={{ fontSize: 12, color: C.text3 }}>{a.messages} msgs</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Cost breakdown */}
                        {detail.dailyCosts && detail.dailyCosts.length > 0 && (
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Cost breakdown (30d)</div>
                            <div style={{ fontSize: 11, color: C.text3, marginBottom: 14 }}>Daily API cost</div>
                            <MiniBar
                              data={detail.dailyCosts.map((d: any) => ({ day: d.day, views: d.cost * 100 }))}
                              color={C.amber}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          {users.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: C.text3, fontSize: 14 }}>No users found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [tab, setTab] = useState("waitlist");
  const tabs = [
    { id: "waitlist", label: "Waitlist" },
    { id: "traffic", label: "Site Traffic" },
    { id: "product", label: "Product Metrics" },
    { id: "users", label: "Users" },
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
        <Link href="/chat" style={{ fontSize: 13, color: C.text3, textDecoration: "none" }}>&larr; Back to app</Link>
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
        {tab === "users" && <UsersTab />}
      </div>
    </div>
  );
}
