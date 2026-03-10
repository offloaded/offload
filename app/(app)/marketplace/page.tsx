"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "../layout";
import { SearchIcon, BackIcon, XIcon, FileIcon } from "@/components/Icons";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "All",
  "Business Advisory",
  "Coaching & Training",
  "Operations",
  "Research & Analysis",
  "Health & Fitness",
  "Legal & Compliance",
  "Finance",
  "Marketing",
  "Custom",
];

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "alpha", label: "Alphabetical" },
];

interface ListingCard {
  id: string;
  type: "agent" | "team";
  name: string;
  description: string;
  category: string;
  adoption_count: number;
  publisher_name: string;
  agents?: { name: string; role: string | null }[];
  agent_count?: number;
  document_count?: number;
  created_at: string;
}

interface ListingDetail {
  id: string;
  type: "agent" | "team";
  name: string;
  description: string;
  category: string;
  adoption_count: number;
  publisher_name: string;
  created_at: string;
  agents: { name: string; role: string | null; purpose: string; document_count: number }[];
  documents: { file_name: string; file_size: number }[];
  team_expectations: Record<string, { expectation: string }[]>;
}

export default function MarketplacePage() {
  const { openDrawer, refreshAgents, refreshTeams } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<"team" | "agent">("agent");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [adoptResult, setAdoptResult] = useState<{ type: string; message: string; team_id?: string; agent_id?: string } | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: tab, sort });
    if (category !== "All") params.set("category", category);
    if (search.trim()) params.set("q", search.trim());

    try {
      const res = await fetch(`/api/marketplace?${params}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab, category, search, sort]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setDetail(null);
    setAdoptResult(null);
    try {
      const res = await fetch(`/api/marketplace/${id}`);
      if (res.ok) {
        setDetail(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setAdoptResult(null);
  };

  const adopt = async () => {
    if (!selectedId || adopting) return;
    setAdopting(true);
    try {
      const res = await fetch("/api/marketplace/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Adoption failed");
      }
      const result = await res.json();
      setAdoptResult(result);
      await Promise.all([refreshAgents(), refreshTeams()]);
    } catch (err) {
      setAdoptResult({ type: "error", message: err instanceof Error ? err.message : "Failed to adopt" });
    } finally {
      setAdopting(false);
    }
  };

  const goToAdopted = () => {
    if (!adoptResult) return;
    if (adoptResult.team_id) {
      router.push(`/team/${adoptResult.team_id}`);
    } else if (adoptResult.agent_id) {
      router.push(`/agent/${adoptResult.agent_id}`);
    }
    closeDetail();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-4 md:border-b-0">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
          >
            <BackIcon />
          </button>
          <span className="text-[18px] font-semibold text-[var(--color-text)]">
            Marketplace
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setTab("agent")}
            className="py-2 px-4 rounded-lg text-[14px] font-medium border-none cursor-pointer transition-colors"
            style={{
              background: tab === "agent" ? "var(--color-accent)" : "var(--color-active)",
              color: tab === "agent" ? "#fff" : "var(--color-text-secondary)",
            }}
          >
            Agents
          </button>
          <button
            disabled
            className="py-2 px-4 rounded-lg text-[14px] font-medium border-none transition-colors flex items-center gap-1.5"
            style={{
              background: "var(--color-active)",
              color: "var(--color-text-tertiary)",
              cursor: "not-allowed",
              opacity: 0.6,
            }}
          >
            Teams
            <span className="text-[10px] font-semibold bg-[var(--color-border)] rounded-full px-1.5 py-0.5 leading-none">
              Soon
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-2 items-center mb-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-input-bg)]">
            <span className="text-[var(--color-text-tertiary)]"><SearchIcon /></span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search marketplace..."
              className="flex-1 border-none bg-transparent text-[14px] text-[var(--color-text)] outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="bg-transparent border-none cursor-pointer text-[var(--color-text-tertiary)] p-0 flex">
                <XIcon />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="py-2.5 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[13px] text-[var(--color-text)] outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="py-1.5 px-3 rounded-full text-[12px] font-medium border cursor-pointer transition-colors whitespace-nowrap shrink-0"
              style={{
                background: category === c ? "var(--color-accent-soft)" : "transparent",
                borderColor: category === c ? "var(--color-accent)" : "var(--color-border)",
                color: category === c ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Listings grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-10">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-[15px] text-[var(--color-text-tertiary)]">Loading...</span>
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="text-[15px] text-[var(--color-text-secondary)] mb-1">No listings found</div>
              <div className="text-[13px] text-[var(--color-text-tertiary)]">
                {search ? "Try a different search term" : "Be the first to publish!"}
              </div>
            </div>
          </div>
        )}

        {!loading && listings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {listings.map((l) => (
              <button
                key={l.id}
                onClick={() => openDetail(l.id)}
                className="text-left border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface)] cursor-pointer transition-all hover:border-[var(--color-accent)] hover:shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-[15px] font-semibold text-[var(--color-text)] leading-tight">
                    {l.name}
                  </div>
                  <span className="text-[11px] font-medium text-[var(--color-accent)] bg-[var(--color-accent-soft)] rounded-full px-2 py-0.5 shrink-0 ml-2">
                    {l.category}
                  </span>
                </div>
                <div className="text-[13px] text-[var(--color-text-secondary)] mb-3 leading-relaxed" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {l.description}
                </div>
                {l.type === "team" && l.agents && (
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {l.agents.slice(0, 5).map((a, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-active)] rounded-md px-1.5 py-0.5"
                      >
                        {a.name}{a.role ? ` · ${a.role}` : ""}
                      </span>
                    ))}
                    {l.agents.length > 5 && (
                      <span className="text-[11px] text-[var(--color-text-tertiary)] px-1">+{l.agents.length - 5} more</span>
                    )}
                  </div>
                )}
                {l.type === "agent" && l.document_count !== undefined && l.document_count > 0 && (
                  <div className="text-[11px] text-[var(--color-text-tertiary)] mb-2.5">
                    Grounded in {l.document_count} document{l.document_count !== 1 ? "s" : ""}
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
                  <span>by {l.publisher_name}</span>
                  <span>
                    {l.type === "team" && l.agent_count !== undefined ? `${l.agent_count} agents · ` : ""}
                    {l.adoption_count} adopted
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail overlay */}
      {selectedId && (
        <>
          <div
            onClick={closeDetail}
            className="fixed inset-0 z-[100] bg-black/20"
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 md:p-8 pointer-events-none">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl w-full max-w-[640px] max-h-[85vh] flex flex-col pointer-events-auto overflow-hidden">
              {/* Detail header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
                <div className="text-[17px] font-semibold text-[var(--color-text)]">
                  {detail?.name || "Loading..."}
                </div>
                <button onClick={closeDetail} className="bg-transparent border-none cursor-pointer text-[var(--color-text-tertiary)] p-1 flex hover:text-[var(--color-text)]">
                  <XIcon />
                </button>
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {loadingDetail && (
                  <div className="py-8 text-center text-[14px] text-[var(--color-text-tertiary)]">Loading details...</div>
                )}

                {detail && !adoptResult && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[12px] font-medium text-[var(--color-accent)] bg-[var(--color-accent-soft)] rounded-full px-2.5 py-0.5">
                        {detail.category}
                      </span>
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">
                        by {detail.publisher_name}
                      </span>
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">
                        {detail.adoption_count} adopted
                      </span>
                    </div>

                    <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-5">
                      {detail.description}
                    </p>

                    {/* Agents in this listing */}
                    {detail.agents.length > 0 && (
                      <div className="mb-5">
                        <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
                          {detail.type === "team" ? "Team Agents" : "Agent"}
                        </div>
                        <div className="flex flex-col gap-2">
                          {detail.agents.map((a, i) => (
                            <div key={i} className="border border-[var(--color-border)] rounded-lg p-3">
                              <div className="text-[14px] font-medium text-[var(--color-text)] mb-0.5">
                                {a.name}
                                {a.role && <span className="text-[12px] text-[var(--color-text-tertiary)] font-normal ml-1.5">{a.role}</span>}
                              </div>
                              <div className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                                {a.purpose}
                              </div>
                              {a.document_count > 0 && (
                                <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1.5">
                                  {a.document_count} document{a.document_count !== 1 ? "s" : ""} in knowledge base
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team Expectations */}
                    {Object.keys(detail.team_expectations).length > 0 && (
                      <div className="mb-5">
                        <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
                          Team Expectations
                        </div>
                        {Object.entries(detail.team_expectations).map(([agentName, exps]) => (
                          <div key={agentName} className="mb-2">
                            <div className="text-[12px] font-medium text-[var(--color-text-tertiary)] mb-1">{agentName}</div>
                            {(exps as { expectation: string }[]).map((e, i) => (
                              <div key={i} className="text-[13px] text-[var(--color-text-secondary)] pl-3 mb-0.5">{e.expectation}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Knowledge base documents */}
                    {detail.documents.length > 0 && (
                      <div className="mb-5">
                        <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
                          Knowledge Base ({detail.documents.length} document{detail.documents.length !== 1 ? "s" : ""})
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {detail.documents.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 py-1.5 px-2.5 border border-[var(--color-border)] rounded-lg">
                              <span className="text-[var(--color-text-tertiary)] shrink-0"><FileIcon /></span>
                              <span className="text-[12px] text-[var(--color-text)] truncate">{d.file_name}</span>
                              <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0">{formatSize(d.file_size)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Adoption result */}
                {adoptResult && (
                  <div className="py-6 text-center">
                    {adoptResult.type === "error" ? (
                      <div className="text-[14px] text-[var(--color-red)]">{adoptResult.message}</div>
                    ) : (
                      <>
                        <div className="text-[24px] mb-3">
                          {adoptResult.type === "team" ? "🎉" : "✨"}
                        </div>
                        <div className="text-[15px] font-medium text-[var(--color-text)] mb-2">
                          {detail?.type === "team" ? "Team added!" : "Agent added!"}
                        </div>
                        <div className="text-[13px] text-[var(--color-text-secondary)] mb-5 px-4">
                          {adoptResult.message}
                        </div>
                        <button
                          onClick={goToAdopted}
                          className="py-2.5 px-5 border-none rounded-lg text-[14px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white"
                        >
                          {adoptResult.team_id ? "Go to channel" : "Open chat"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Detail footer */}
              {detail && !adoptResult && (
                <div className="px-5 py-4 border-t border-[var(--color-border)] shrink-0">
                  <button
                    onClick={adopt}
                    disabled={adopting}
                    className="w-full py-3 border-none rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-60 transition-colors bg-[var(--color-accent)] text-white"
                  >
                    {adopting
                      ? "Setting up..."
                      : detail.type === "team"
                        ? "Use this team"
                        : "Add to workspace"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
