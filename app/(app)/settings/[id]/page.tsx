"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../layout";
import {
  BackIcon,
  TrashIcon,
  FileIcon,
  PlusIcon,
  XIcon,
  GlobeIcon,
} from "@/components/Icons";
import type { Document, SoftSkill } from "@/lib/types";

const PALETTE = [
  "#2C5FF6",
  "#16A34A",
  "#D97706",
  "#9333EA",
  "#DC2626",
  "#0891B2",
  "#4F46E5",
  "#C026D3",
  "#059669",
  "#E11D48",
];

const WORKING_STYLES = [
  { id: "Proactive", description: "Volunteers information, flags issues, asks questions without being asked" },
  { id: "Analytical", description: "Data-driven, structured thinking, evidence-based reasoning" },
  { id: "Collaborative", description: "Builds on others' input, references colleagues, team-oriented" },
];

const COMMUNICATION_STYLES = [
  { id: "Concise", description: "Brief, to the point, no fluff" },
  { id: "Professional", description: "Formal tone, structured responses" },
  { id: "Supportive", description: "Encouraging, warm, acknowledges effort" },
];

interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: "uploading" | "processing" | "ready" | "error";
  errorMessage?: string;
}

export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { agents, refreshAgents } = useApp();
  const isNew = params.id === "new";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existing = !isNew ? agents.find((a) => a.id === params.id) : null;

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [purpose, setPurpose] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [workingStyle, setWorkingStyle] = useState<string[]>([]);
  const [communicationStyle, setCommunicationStyle] = useState<string[]>([]);
  const [voiceSamples, setVoiceSamples] = useState<string[]>([]);
  const [voiceProfile, setVoiceProfile] = useState("");
  const [voiceProfileEdited, setVoiceProfileEdited] = useState(false);
  const [extractingVoice, setExtractingVoice] = useState(false);
  const [softSkills, setSoftSkills] = useState<SoftSkill[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setRole(existing.role ?? "");
      setPurpose(existing.purpose);
      setColor(existing.color);
      setWebSearchEnabled(existing.web_search_enabled ?? false);
      setWorkingStyle(existing.working_style ?? []);
      setCommunicationStyle(existing.communication_style ?? []);
      setVoiceSamples(existing.voice_samples ?? []);
      setVoiceProfile(existing.voice_profile ?? "");
      setSoftSkills(existing.soft_skills ?? []);
    } else if (isNew) {
      setColor(PALETTE[agents.length % PALETTE.length]);
    }
  }, [existing, isNew, agents.length]);

  const loadDocs = useCallback(() => {
    if (!isNew && params.id) {
      fetch(`/api/agents/documents?agent_id=${params.id}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setDocs)
        .catch(() => {});
    }
  }, [isNew, params.id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    const hasProcessing = docs.some((d) => d.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(loadDocs, 3000);
    return () => clearInterval(interval);
  }, [docs, loadDocs]);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/agents", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isNew ? {} : { id: params.id }),
          name: name.trim(),
          role: role.trim() || null,
          purpose: purpose.trim(),
          color,
          web_search_enabled: webSearchEnabled,
          working_style: workingStyle.length > 0 ? workingStyle : null,
          communication_style: communicationStyle.length > 0 ? communicationStyle : null,
          ...(!isNew && (voiceSamples.some((s) => s.trim()) || voiceProfile) ? {
            voice_samples: voiceSamples.filter((s) => s.trim()),
            voice_profile: voiceProfile || null,
          } : {}),
          ...(!isNew ? { soft_skills: softSkills.length > 0 ? softSkills : null } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      await refreshAgents();
      router.push("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/agents?id=${params.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      await refreshAgents();
      router.push("/settings");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete agent"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingStyle = (id: string) => {
    setWorkingStyle((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleCommunicationStyle = (id: string) => {
    setCommunicationStyle((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const uploadSingleFile = async (file: File, uploadId: string) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("agent_id", params.id as string);
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      const doc = await res.json();
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? { ...u, status: doc.status === "ready" ? "ready" : doc.status === "error" ? "error" : "processing" }
            : u
        )
      );
      loadDocs();
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                status: "error" as const,
                errorMessage:
                  err instanceof Error ? err.message : "Upload failed",
              }
            : u
        )
      );
    }
  };

  const uploadFiles = async (files: File[]) => {
    setError("");

    const newUploads: UploadItem[] = files.map((file) => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: file.name,
      fileSize: file.size,
      status: "uploading" as const,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    const concurrency = 3;
    const queue = [...files.map((file, i) => ({ file, uploadId: newUploads[i].id }))];

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        await uploadSingleFile(item.file, item.uploadId);
      }
    });

    await Promise.all(workers);
  };

  const deleteDoc = async (docId: string) => {
    setError("");
    try {
      const res = await fetch(`/api/agents/documents?id=${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    }
  };

  const extractVoice = async () => {
    const validSamples = voiceSamples.filter((s) => s.trim());
    if (validSamples.length === 0 || extractingVoice || isNew) return;
    setExtractingVoice(true);
    setError("");
    try {
      const res = await fetch("/api/agents/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: params.id, samples: validSamples }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Voice extraction failed");
      }
      const data = await res.json();
      setVoiceProfile(data.voice_profile || "");
      setVoiceProfileEdited(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice extraction failed");
    } finally {
      setExtractingVoice(false);
    }
  };

  const addVoiceSample = () => {
    if (voiceSamples.length < 5) {
      setVoiceSamples([...voiceSamples, ""]);
    }
  };

  const updateVoiceSample = (index: number, value: string) => {
    setVoiceSamples(voiceSamples.map((s, i) => (i === index ? value : s)));
  };

  const removeVoiceSample = (index: number) => {
    setVoiceSamples(voiceSamples.filter((_, i) => i !== index));
  };

  const addSoftSkill = () => {
    const trimmed = newSkillName.trim();
    if (!trimmed) return;
    if (softSkills.some((s) => s.skill.toLowerCase() === trimmed.toLowerCase())) return;
    setSoftSkills([...softSkills, { skill: trimmed, confidence: "medium" }]);
    setNewSkillName("");
  };

  const removeSoftSkill = (index: number) => {
    setSoftSkills(softSkills.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      uploadFiles(Array.from(fileList));
      e.target.value = "";
    }
  };

  const dismissUpload = (uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  };

  const hasActiveUploads = uploads.some(
    (u) => u.status === "uploading" || u.status === "processing"
  );

  if (!isNew && !existing && agents.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[15px] text-[var(--color-text-secondary)]">
        Agent not found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0"
      >
        <button
          onClick={() => router.push("/settings")}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
        >
          <BackIcon />
        </button>
        <span className="text-[18px] font-semibold text-[var(--color-text)]">
          {isNew ? "New Agent" : "Edit Agent"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[600px] w-full p-4 md:px-10 md:pt-5 md:pb-8">
          {error && (
            <div className="mb-5 text-[14px] text-[var(--color-red)] bg-[var(--color-red-soft)] px-3.5 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Color picker */}
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Colour
            </label>
            <div className="flex gap-2.5 flex-wrap">
              {PALETTE.map((c) => (
                <div
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full cursor-pointer"
                  style={{
                    background: c,
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex, Jordan, Sam..."
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Role */}
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1">
              Role
            </label>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mb-2">
              A short title shown in the sidebar and agent tags.
            </p>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. EOS Coach, HR Business Partner, Research Analyst..."
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Purpose */}
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Purpose
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="Describe this agent's role and how it should behave..."
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none resize-y leading-relaxed focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Working Style */}
          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1">
              Working Style
            </label>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3">
              How this agent approaches problems.
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {WORKING_STYLES.map((style) => {
                const selected = workingStyle.includes(style.id);
                return (
                  <button
                    key={style.id}
                    onClick={() => toggleWorkingStyle(style.id)}
                    className="py-2 px-3.5 rounded-lg text-[13px] font-medium border cursor-pointer transition-all"
                    style={{
                      background: selected ? "var(--color-accent-soft)" : "transparent",
                      borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
                      color: selected ? "var(--color-accent)" : "var(--color-text-secondary)",
                    }}
                    title={style.description}
                  >
                    {style.id}
                  </button>
                );
              })}
            </div>

            {/* Soft Skills (nested) */}
            {!isNew && (
              <div className="pl-0">
                <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1">
                  Soft skills
                </label>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2.5">
                  Skills the agent develops through use. You can add them manually or ask the agent to assess its own skills.
                </p>

                {softSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {softSkills.map((s, i) => {
                      const opacity = s.confidence === "high" ? 1 : s.confidence === "medium" ? 0.7 : 0.4;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 py-1 px-2.5 rounded-full border border-[var(--color-border)] text-[13px] group"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: "var(--color-accent)", opacity }}
                            title={`Confidence: ${s.confidence}`}
                          />
                          <span className="text-[var(--color-text)]">{s.skill}</span>
                          <button
                            onClick={() => removeSoftSkill(i)}
                            className="bg-transparent border-none cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-red)] p-0 flex text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XIcon />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSoftSkill(); } }}
                    placeholder="Add a skill..."
                    className="flex-1 py-2 px-3 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    onClick={addSoftSkill}
                    disabled={!newSkillName.trim()}
                    className="py-2 px-3 border border-[var(--color-border)] rounded-lg bg-transparent cursor-pointer text-[var(--color-accent)] text-[13px] font-medium disabled:opacity-30 hover:bg-[var(--color-hover)] transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Communication Style */}
          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1">
              Communication Style
            </label>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3">
              How this agent communicates.
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {COMMUNICATION_STYLES.map((style) => {
                const selected = communicationStyle.includes(style.id);
                return (
                  <button
                    key={style.id}
                    onClick={() => toggleCommunicationStyle(style.id)}
                    className="py-2 px-3.5 rounded-lg text-[13px] font-medium border cursor-pointer transition-all"
                    style={{
                      background: selected ? "var(--color-accent-soft)" : "transparent",
                      borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
                      color: selected ? "var(--color-accent)" : "var(--color-text-secondary)",
                    }}
                    title={style.description}
                  >
                    {style.id}
                  </button>
                );
              })}
            </div>

            {/* Tone of Voice (nested) */}
            {!isNew && (
              <div className="pl-0">
                <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1">
                  Voice samples <span className="font-normal">(optional)</span>
                </label>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2.5">
                  Paste examples of how you communicate and the agent will match your style.
                </p>

                {voiceSamples.map((sample, i) => (
                  <div key={i} className="relative mb-2">
                    <textarea
                      value={sample}
                      onChange={(e) => updateVoiceSample(i, e.target.value)}
                      rows={3}
                      placeholder={`Sample ${i + 1} — paste an email, message, or note...`}
                      className="w-full py-3 px-4 pr-9 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none resize-y leading-relaxed focus:border-[var(--color-accent)]"
                    />
                    <button
                      onClick={() => removeVoiceSample(i)}
                      className="absolute top-2 right-2 bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0.5 flex hover:text-[var(--color-red)]"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 mb-3">
                  {voiceSamples.length < 5 && (
                    <button
                      onClick={addVoiceSample}
                      className="py-2 px-4 flex items-center gap-1.5 border border-dashed border-[var(--color-border)] rounded-lg bg-transparent cursor-pointer text-[var(--color-accent)] text-[13px] font-medium hover:bg-[var(--color-hover)] transition-colors"
                    >
                      <PlusIcon /> Add sample
                    </button>
                  )}
                  {voiceSamples.filter((s) => s.trim()).length > 0 && (
                    <button
                      onClick={extractVoice}
                      disabled={extractingVoice}
                      className="py-2 px-4 border border-[var(--color-border)] rounded-lg bg-transparent cursor-pointer text-[13px] font-medium disabled:opacity-50 hover:bg-[var(--color-hover)] transition-colors"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {extractingVoice ? "Analysing..." : voiceProfile ? "Re-analyse" : "Analyse style"}
                    </button>
                  )}
                </div>

                {voiceProfile && (
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--color-text-tertiary)] mb-1.5">
                      Voice profile {voiceProfileEdited && <span className="text-[var(--color-accent)]">(edited)</span>}
                    </label>
                    <textarea
                      value={voiceProfile}
                      onChange={(e) => { setVoiceProfile(e.target.value); setVoiceProfileEdited(true); }}
                      rows={3}
                      className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none resize-y leading-relaxed focus:border-[var(--color-accent)]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Knowledge (Documents) */}
          <div className="mb-7">
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
                Knowledge
              </label>
              {docs.length > 0 && (
                <span className="text-[12px] text-[var(--color-text-tertiary)]">
                  {docs.filter((d) => d.status === "ready").length} of {docs.length} ready
                </span>
              )}
            </div>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mb-2.5">
              Upload documents the agent can reference when responding.
            </p>

            {/* Grid of document tiles */}
            {(uploads.length > 0 || docs.length > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                {/* Active uploads */}
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="relative border border-[var(--color-border)] rounded-lg p-3 flex flex-col gap-1.5"
                  >
                    {(u.status === "ready" || u.status === "error") && (
                      <button
                        onClick={() => dismissUpload(u.id)}
                        className="absolute top-1.5 right-1.5 bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0.5 flex hover:text-[var(--color-text)]"
                      >
                        <XIcon />
                      </button>
                    )}
                    <div className="text-[var(--color-text-tertiary)]">
                      {u.status === "uploading" ? <SpinnerIcon /> : <FileIcon />}
                    </div>
                    <div className="text-[13px] text-[var(--color-text)] truncate pr-4" title={u.fileName}>
                      {u.fileName}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)]">
                      {formatSize(u.fileSize)}
                    </div>
                    <div className="text-[11px]">
                      {u.status === "uploading" && (
                        <span className="text-[var(--color-accent)]">Uploading...</span>
                      )}
                      {u.status === "processing" && (
                        <span className="text-[var(--color-accent)]">Processing...</span>
                      )}
                      {u.status === "ready" && (
                        <span className="text-[var(--color-green)]">Ready</span>
                      )}
                      {u.status === "error" && (
                        <span className="text-[var(--color-red)]">{u.errorMessage || "Error"}</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Existing documents */}
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="relative border border-[var(--color-border)] rounded-lg p-3 flex flex-col gap-1.5"
                  >
                    <button
                      onClick={() => deleteDoc(d.id)}
                      className="absolute top-1.5 right-1.5 bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0.5 flex hover:text-[var(--color-red)]"
                    >
                      <XIcon />
                    </button>
                    <div className="text-[var(--color-text-tertiary)]">
                      <FileIcon />
                    </div>
                    <div className="text-[13px] text-[var(--color-text)] truncate pr-4" title={d.file_name}>
                      {d.file_name}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)]">
                      {formatSize(d.file_size)}
                      {d.status === "ready" && d.chunk_count != null && (
                        <span> &middot; {d.chunk_count} chunks</span>
                      )}
                    </div>
                    <div className="text-[11px]">
                      {d.status === "processing" && (
                        <span className="text-[var(--color-accent)]">Processing...</span>
                      )}
                      {d.status === "error" && (
                        <span className="text-[var(--color-red)]">Error &middot; 0 chunks</span>
                      )}
                      {d.status === "ready" && (
                        <span className="text-[var(--color-green)]">Ready</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {docs.length === 0 && uploads.length === 0 && !isNew && (
              <div className="py-3.5 px-4 text-[14px] text-[var(--color-text-tertiary)] border border-[var(--color-border)] rounded-lg mb-2">
                No documents uploaded yet
              </div>
            )}

            {!isNew && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={hasActiveUploads}
                  className="w-full py-2.5 px-4 flex items-center justify-center gap-2 border border-dashed border-[var(--color-border)] rounded-lg bg-transparent cursor-pointer text-[var(--color-accent)] text-[14px] font-medium disabled:opacity-50 hover:bg-[var(--color-hover)] transition-colors"
                >
                  <PlusIcon />{" "}
                  {hasActiveUploads
                    ? `Uploading ${uploads.filter((u) => u.status === "uploading" || u.status === "processing").length} file(s)...`
                    : "Upload documents"}
                </button>
              </>
            )}
            {isNew && (
              <div className="py-3.5 px-4 text-[14px] text-[var(--color-text-tertiary)] border border-[var(--color-border)] rounded-lg">
                Save the agent first, then upload documents
              </div>
            )}
          </div>

          {/* Web search */}
          {!isNew && (
            <div className="mb-7">
              <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
                Web Search
              </label>
              <button
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                className="w-full flex items-center gap-3 py-3 px-4 border border-[var(--color-border)] rounded-lg bg-transparent cursor-pointer text-left"
              >
                <span className="text-[var(--color-text-tertiary)]">
                  <GlobeIcon />
                </span>
                <span className="flex-1 text-[14px] text-[var(--color-text)]">
                  Allow this agent to search the web
                </span>
                <span
                  className="text-[14px] font-medium"
                  style={{
                    color: webSearchEnabled
                      ? "var(--color-accent)"
                      : "var(--color-text-tertiary)",
                  }}
                >
                  {webSearchEnabled ? "On" : "Off"}
                </span>
              </button>
              <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1.5 px-1">
                Requires a Tavily API key in environment variables
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={!name.trim() || saving}
              className="flex-1 py-3 px-5 border-none rounded-lg text-[15px] font-semibold cursor-pointer disabled:cursor-default transition-colors"
              style={{
                background: name.trim()
                  ? "var(--color-accent)"
                  : "var(--color-active)",
                color: name.trim() ? "#fff" : "var(--color-text-tertiary)",
              }}
            >
              {saving ? "..." : isNew ? "Create Agent" : "Save"}
            </button>
            {!isNew && (
              <button
                onClick={remove}
                disabled={saving}
                className="py-3 px-4 bg-[var(--color-red-soft)] text-[var(--color-red)] border-none rounded-lg cursor-pointer flex items-center"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="28 10"
        opacity="0.6"
      />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
