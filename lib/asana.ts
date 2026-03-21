import { createServiceSupabase } from "./supabase-server";
import { encrypt, decrypt } from "./encryption";

const ASANA_API = "https://app.asana.com/api/1.0";
const ASANA_TOKEN_URL = "https://app.asana.com/-/oauth_token";

// Mutex to prevent concurrent token refreshes for the same workspace
const refreshLocks = new Map<string, Promise<AsanaTokens | null>>();

interface AsanaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

/** Fetch and decrypt Asana tokens for a workspace, refreshing if expired */
export async function getAsanaTokens(workspaceId: string): Promise<AsanaTokens | null> {
  const service = createServiceSupabase();
  const { data } = await service
    .from("integrations")
    .select("access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "asana")
    .single();

  if (!data) return null;

  const expiresAt = new Date(data.token_expires_at);
  const accessToken = decrypt(data.access_token_encrypted);
  const refreshToken = decrypt(data.refresh_token_encrypted);

  // If token expires within 5 minutes, refresh it (with mutex to prevent concurrent refreshes)
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const existing = refreshLocks.get(workspaceId);
    if (existing) return existing;

    const refreshPromise = refreshAsanaToken(workspaceId, refreshToken).finally(() => {
      refreshLocks.delete(workspaceId);
    });
    refreshLocks.set(workspaceId, refreshPromise);
    return refreshPromise;
  }

  return { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt };
}

/** Refresh an expired Asana token */
async function refreshAsanaToken(workspaceId: string, refreshToken: string): Promise<AsanaTokens | null> {
  const res = await fetch(ASANA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ASANA_CLIENT_ID!,
      client_secret: process.env.ASANA_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    console.error("[Asana] Token refresh failed:", res.status);
    return null;
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update stored tokens
  const service = createServiceSupabase();
  await service
    .from("integrations")
    .update({
      access_token_encrypted: encrypt(data.access_token),
      refresh_token_encrypted: encrypt(data.refresh_token || refreshToken),
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("provider", "asana");

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: expiresAt,
  };
}

/** Make an authenticated request to the Asana API with retry on transient errors */
export async function asanaFetch(
  workspaceId: string,
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string; nextPage?: { offset: string; uri: string } | null }> {
  const tokens = await getAsanaTokens(workspaceId);
  if (!tokens) {
    return { ok: false, status: 401, error: "Asana not connected" };
  }

  const url = path.startsWith("http") ? path : `${ASANA_API}${path}`;
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = res.headers.get("Retry-After");
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (attempt + 1);
          console.warn(`[Asana] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return { ok: false, status: 429, error: "Asana rate limit reached. Try again in a moment." };
      }

      if (res.status === 401) {
        return { ok: false, status: 401, error: "Asana authorization expired. Please reconnect in Settings." };
      }

      // Retry on server errors (500, 502, 503)
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.warn(`[Asana] Server error ${res.status}, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = body?.errors?.[0]?.message || `Asana API error (${res.status})`;
        return { ok: false, status: res.status, error: errMsg };
      }

      return { ok: true, status: res.status, data: body.data, nextPage: body.next_page || null };
    } catch (err) {
      // Network error — retry on transient failures
      if (attempt < MAX_RETRIES) {
        console.warn(`[Asana] Network error, retrying (attempt ${attempt + 1}/${MAX_RETRIES}):`, err);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: false, status: 0, error: `Asana request failed: ${err instanceof Error ? err.message : "network error"}` };
    }
  }

  return { ok: false, status: 0, error: "Asana request failed after retries" };
}

/**
 * Fetch all pages of a paginated Asana list endpoint.
 * Follows next_page links until all results are collected.
 */
export async function asanaFetchAll(
  workspaceId: string,
  path: string
): Promise<{ ok: boolean; data?: unknown[]; error?: string }> {
  const allData: unknown[] = [];
  let currentPath = path;
  // Add limit=100 to reduce roundtrips (default is 20)
  if (!currentPath.includes("limit=")) {
    currentPath += (currentPath.includes("?") ? "&" : "?") + "limit=100";
  }

  for (let page = 0; page < 10; page++) { // safety cap at 10 pages (1000 items)
    const result = await asanaFetch(workspaceId, currentPath);
    if (!result.ok) return { ok: false, error: result.error };

    const items = result.data;
    if (Array.isArray(items)) {
      allData.push(...items);
    }

    if (!result.nextPage?.uri) break;
    currentPath = result.nextPage.uri; // Asana returns full URI for next page
  }

  return { ok: true, data: allData };
}

// ─── Asana Operations ───

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  start_on: string | null;
  due_on: string | null;
  /** Datetime due date (ISO 8601) — takes precedence over due_on when present */
  due_at: string | null;
  created_at?: string;
  assignee: { gid: string; name: string; email?: string } | null;
  /** Section memberships — shows which section(s) a task belongs to */
  memberships?: Array<{ section?: { name: string } }>;
  notes?: string;
  custom_fields?: Array<{ name: string; display_value: string | null }>;
  permalink_url?: string;
}

const TASK_OPT_FIELDS = "name,completed,start_on,due_on,due_at,created_at,assignee,assignee.name,assignee.email,memberships.section.name,custom_fields.name,custom_fields.display_value,permalink_url,notes";

export async function listTasks(
  workspaceId: string,
  projectGid: string,
  opts?: { completedSince?: string; assignee?: string }
): Promise<{ ok: boolean; tasks?: AsanaTask[]; error?: string }> {
  // Always use section-based retrieval as primary strategy.
  // The project-level endpoint (GET /projects/{gid}/tasks) does NOT reliably
  // return tasks from all sections — only the default/first section.
  // This has been reported 3 times. Section-based fetch is the only reliable approach.
  console.log(`[Asana] listTasks: using section-based retrieval for project ${projectGid}`);
  const result = await listTasksBySections(workspaceId, projectGid, opts);

  if (!result.ok) {
    // Fallback to project-level endpoint only if section-based retrieval fails entirely
    console.warn(`[Asana] listTasks: section-based retrieval failed, falling back to project-level for ${projectGid}`);
    const params = new URLSearchParams({ opt_fields: TASK_OPT_FIELDS });
    if (opts?.completedSince) params.set("completed_since", opts.completedSince);
    if (opts?.assignee) params.set("assignee", opts.assignee);
    const fallback = await asanaFetchAll(workspaceId, `/projects/${projectGid}/tasks?${params}`);
    if (!fallback.ok) return { ok: false, error: fallback.error };
    return { ok: true, tasks: fallback.data as AsanaTask[] };
  }

  const tasks = result.tasks || [];
  if (tasks.length > 0) {
    console.log(`[Asana] listTasks final: ${tasks.length} task(s), first 5:`, JSON.stringify(tasks.slice(0, 5).map(t => ({
      name: t.name, gid: t.gid, assignee: t.assignee?.name,
      due_on: t.due_on, due_at: t.due_at,
      section: t.memberships?.[0]?.section?.name,
    }))));
  }

  return { ok: true, tasks };
}

/**
 * Alternative task retrieval: fetch sections first, then tasks per section.
 * This catches tasks that the project-level endpoint sometimes misses.
 */
async function listTasksBySections(
  workspaceId: string,
  projectGid: string,
  opts?: { completedSince?: string; assignee?: string }
): Promise<{ ok: boolean; tasks?: AsanaTask[]; error?: string }> {
  // Step 1: Get all sections in the project
  const sectionsResult = await asanaFetchAll(workspaceId, `/projects/${projectGid}/sections?opt_fields=name`);
  if (!sectionsResult.ok) return { ok: false, error: sectionsResult.error };

  const sections = sectionsResult.data as Array<{ gid: string; name: string }>;
  console.log(`[Asana] listTasksBySections: ${sections.length} section(s) in project ${projectGid}: ${sections.map(s => s.name).join(", ")}`);

  // Step 2: Fetch tasks from each section
  const allTasks: AsanaTask[] = [];
  const seenGids = new Set<string>();

  for (const section of sections) {
    const params = new URLSearchParams({ opt_fields: TASK_OPT_FIELDS });
    if (opts?.completedSince) params.set("completed_since", opts.completedSince);
    if (opts?.assignee) params.set("assignee", opts.assignee);

    const result = await asanaFetchAll(workspaceId, `/sections/${section.gid}/tasks?${params}`);
    if (!result.ok) {
      console.error(`[Asana] listTasksBySections: failed for section "${section.name}": ${result.error}`);
      continue;
    }

    const sectionTasks = result.data as AsanaTask[];
    console.log(`[Asana] listTasksBySections: section "${section.name}" → ${sectionTasks.length} task(s)`);

    for (const task of sectionTasks) {
      if (!seenGids.has(task.gid)) {
        seenGids.add(task.gid);
        // Ensure section name is populated even if memberships is missing
        if (!task.memberships || task.memberships.length === 0) {
          task.memberships = [{ section: { name: section.name } }];
        }
        allTasks.push(task);
      }
    }
  }

  return { ok: true, tasks: allTasks };
}

export async function getTask(
  workspaceId: string,
  taskGid: string
): Promise<{ ok: boolean; task?: AsanaTask & { stories?: Array<{ text: string; created_by: { name: string }; created_at: string; type: string }> }; error?: string }> {
  const result = await asanaFetch(
    workspaceId,
    `/tasks/${taskGid}?opt_fields=name,completed,start_on,due_on,due_at,created_at,assignee,assignee.name,assignee.email,notes,custom_fields.name,custom_fields.display_value,permalink_url,subtasks.name,subtasks.completed,tags.name`
  );
  if (!result.ok) return { ok: false, error: result.error };

  // Also fetch comments/stories
  const storiesResult = await asanaFetch(workspaceId, `/tasks/${taskGid}/stories?opt_fields=text,created_by.name,created_at,type`);
  const task = result.data as AsanaTask;

  // Diagnostic: log all date fields to identify the mismatch
  console.log(`[Asana] getTask raw:`, JSON.stringify({
    name: task.name, gid: task.gid, start_on: task.start_on, due_on: task.due_on,
    due_at: task.due_at, created_at: task.created_at,
    completed: task.completed, notes: task.notes?.slice(0, 100),
  }));

  const stories = storiesResult.ok
    ? (storiesResult.data as Array<{ text: string; created_by: { name: string }; created_at: string; type: string }>).filter(s => s.type === "comment")
    : [];

  return { ok: true, task: { ...task, stories } };
}

export async function createTask(
  workspaceId: string,
  data: { project_gid: string; name: string; notes?: string; assignee?: string; start_on?: string; due_on?: string; custom_fields?: Record<string, string> }
): Promise<{ ok: boolean; task?: AsanaTask; error?: string }> {
  const body: Record<string, unknown> = {
    name: data.name,
    projects: [data.project_gid],
  };
  if (data.notes) body.notes = data.notes;
  if (data.assignee) body.assignee = data.assignee;
  if (data.start_on) body.start_on = data.start_on;
  if (data.due_on) body.due_on = data.due_on;
  if (data.custom_fields) body.custom_fields = data.custom_fields;

  const result = await asanaFetch(workspaceId, "/tasks", {
    method: "POST",
    body: JSON.stringify({ data: body }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, task: result.data as AsanaTask };
}

export async function updateTask(
  workspaceId: string,
  taskGid: string,
  data: { name?: string; notes?: string; assignee?: string; start_on?: string; due_on?: string; completed?: boolean; custom_fields?: Record<string, string> }
): Promise<{ ok: boolean; task?: AsanaTask; error?: string }> {
  const result = await asanaFetch(workspaceId, `/tasks/${taskGid}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, task: result.data as AsanaTask };
}

export async function addComment(
  workspaceId: string,
  taskGid: string,
  text: string
): Promise<{ ok: boolean; commentGid?: string; error?: string }> {
  const result = await asanaFetch(workspaceId, `/tasks/${taskGid}/stories`, {
    method: "POST",
    body: JSON.stringify({ data: { text } }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, commentGid: (result.data as { gid: string })?.gid };
}

// ─── Pre-fetch for injecting live task data into system prompts ───

/** Keywords that indicate the user message is Asana-related */
export const ASANA_KEYWORDS = /\b(tasks?|asana|outstanding|overdue|due|status update|what'?s happening|action items?|to[\s-]?dos?|deadlines?|assigned|backlog|sprint|what needs|what'?s on|agenda|checklist|one on one|1:1|briefing|prepare|this week|today|upcoming|project status|working on|progress|report)\b/i;

export interface AsanaPreFetchResult {
  /** Formatted text to inject into system prompt */
  text: string;
  /** Task names for hallucination detection */
  taskNames: string[];
}

/**
 * Pre-fetch all incomplete tasks across an agent's connected Asana projects.
 * Returns formatted text suitable for injecting into a system prompt so the
 * model has live data and doesn't need to hallucinate or make tool calls.
 */
export async function asanaPreFetch(
  workspaceId: string,
  projects: Array<{ gid: string; name: string }>,
): Promise<AsanaPreFetchResult | null> {
  const { effectiveDueDate } = await import("./tool-execution");

  const projectNameMap = new Map(projects.map((p) => [p.gid, p.name]));
  const allTasks: Array<{
    name: string; gid: string; completed: boolean;
    start_on: string | null; due_on: string | null;
    assignee: string | null; section: string | null; project: string;
  }> = [];

  // Fetch projects with concurrency limit to avoid rate limiting
  const BATCH_SIZE = 3;
  const projectResults: Array<Awaited<ReturnType<typeof listTasks>> & { gid: string }> = [];
  for (let i = 0; i < projects.length; i += BATCH_SIZE) {
    const batch = projects.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((proj) => listTasks(workspaceId, proj.gid, { completedSince: "now" }).then((r) => ({ ...r, gid: proj.gid })))
    );
    projectResults.push(...batchResults);
  }
  for (const result of projectResults) {
    if (result.ok && result.tasks) {
      allTasks.push(...result.tasks.map((t) => ({
        name: t.name,
        gid: t.gid,
        completed: t.completed,
        start_on: t.start_on,
        due_on: effectiveDueDate(t),
        assignee: t.assignee ? (t.assignee.name || t.assignee.email || t.assignee.gid) : null,
        section: t.memberships?.[0]?.section?.name || null,
        project: projectNameMap.get(result.gid) || result.gid,
      })));
    }
  }

  const taskNames = allTasks.map((t) => t.name);

  if (allTasks.length === 0) {
    return {
      text: "[System: Live Asana data — No incomplete tasks found across any connected projects.]",
      taskNames,
    };
  }

  // Build a structured summary grouped by project and section
  const byProject = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    if (!byProject.has(t.project)) byProject.set(t.project, []);
    byProject.get(t.project)!.push(t);
  }
  let out = `[System: Live Asana data — ${allTasks.length} incomplete task(s) across ${byProject.size} project(s). Use ONLY this data to answer. Do NOT make up or guess any task information.]\n`;
  for (const [project, tasks] of byProject) {
    out += `\n## ${project} (${tasks.length} tasks)\n`;
    const bySection = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const sec = t.section || "(Default)";
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec)!.push(t);
    }
    for (const [section, secTasks] of bySection) {
      out += `\n### ${section}\n`;
      out += secTasks.map((t) => {
        let dates = "";
        if (t.start_on && t.due_on) dates = ` ${t.start_on} → ${t.due_on}`;
        else if (t.start_on) dates = ` starts ${t.start_on}`;
        else if (t.due_on) dates = ` due ${t.due_on}`;
        return `- ${t.name} (GID: ${t.gid})${t.assignee ? ` [${t.assignee}]` : ""}${dates}${t.completed ? " [DONE]" : ""}`;
      }).join("\n");
    }
  }

  return { text: out, taskNames };
}

/** Fetch all workspaces and their projects for the project selector */
export async function fetchWorkspacesAndProjects(
  workspaceId: string
): Promise<{ ok: boolean; workspaces?: Array<{ gid: string; name: string; projects: Array<{ gid: string; name: string }> }>; error?: string }> {
  // Get Asana workspaces
  const wsResult = await asanaFetch(workspaceId, "/workspaces?opt_fields=name");
  if (!wsResult.ok) return { ok: false, error: wsResult.error };

  const asanaWorkspaces = wsResult.data as Array<{ gid: string; name: string }>;
  const result: Array<{ gid: string; name: string; projects: Array<{ gid: string; name: string }> }> = [];

  for (const ws of asanaWorkspaces) {
    const projResult = await asanaFetch(
      workspaceId,
      `/workspaces/${ws.gid}/projects?opt_fields=name&archived=false`
    );
    result.push({
      gid: ws.gid,
      name: ws.name,
      projects: projResult.ok ? (projResult.data as Array<{ gid: string; name: string }>) : [],
    });
  }

  return { ok: true, workspaces: result };
}
