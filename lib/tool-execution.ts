/**
 * Shared tool execution logic for Asana, GitHub, Google Calendar, save_report,
 * read_report, and update_report tool blocks.
 *
 * Used by both the DM chat route (streaming) and team chat route (via
 * generateAgentResponse) to avoid hallucinated tool results.
 */

import { listTasks, getTask, createTask, updateTask, addComment, type AsanaTask } from "./asana";
import { listIssues, getIssue, createIssue, updateIssue, addIssueComment, listLabels } from "./github";
import { listEvents, getEvent, createEvent, updateEvent, type GoogleCalendarEvent } from "./google-calendar";

/**
 * Resolve the effective due date for an Asana task.
 * Prefers `due_at` (datetime) over `due_on` (date-only) when present,
 * because `due_on` can be stale or timezone-shifted when `due_at` is set.
 */
export function effectiveDueDate(task: AsanaTask): string | null {
  if (task.due_at) {
    // Extract date portion from ISO datetime (e.g. "2026-02-27T08:00:00.000Z" → "2026-02-27")
    return task.due_at.slice(0, 10);
  }
  return task.due_on;
}

// ── Types ──────────────────────────────────────────────────────────────

export interface ToolContext {
  workspaceId: string;
  userId: string;
  agentId: string;
  agentName: string;
  conversationId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}

export interface ToolResult {
  tool: string;
  result: string;
  /** For save_report: the saved report data */
  reportData?: { id: string; title: string; content: string };
}

// ── Asana ──────────────────────────────────────────────────────────────

export async function executeAsanaTool(
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  allowedProjects: Array<{ gid: string; name: string }>,
  ctx: ToolContext
): Promise<string> {
  const allowedGids = new Set(allowedProjects.map((p) => p.gid));

  if (action === "asana_list_tasks") {
    if (payload.project_gid && !allowedGids.has(payload.project_gid)) {
      return "Error: You don't have access to that project.";
    }
    const targetGids = payload.project_gid ? [payload.project_gid] : [...allowedGids];
    const projectNameMap = new Map(allowedProjects.map((p) => [p.gid, p.name]));
    const allTasks: Array<{ name: string; gid: string; completed: boolean; start_on: string | null; due_on: string | null; assignee: string | null; section: string | null; project: string }> = [];
    for (const gid of targetGids) {
      const pName = projectNameMap.get(gid) || gid;
      const result = await listTasks(ctx.workspaceId, gid, {
        completedSince: payload.completed_since === "now" ? "now" : undefined,
      });
      if (result.ok && result.tasks) {
        allTasks.push(...result.tasks.map((t) => ({
          name: t.name,
          gid: t.gid,
          completed: t.completed,
          start_on: t.start_on,
          due_on: effectiveDueDate(t),
          assignee: t.assignee ? (t.assignee.name || t.assignee.email || t.assignee.gid) : null,
          section: t.memberships?.[0]?.section?.name || null,
          project: pName,
        })));
      } else if (!result.ok) {
        return `Error: ${result.error}`;
      }
    }
    if (allTasks.length === 0) return "No tasks found.";

    // Group by project for clearer output when querying multiple projects
    if (targetGids.length > 1) {
      const byProject = new Map<string, typeof allTasks>();
      for (const t of allTasks) {
        if (!byProject.has(t.project)) byProject.set(t.project, []);
        byProject.get(t.project)!.push(t);
      }
      let out = `Found ${allTasks.length} task(s) across ${byProject.size} project(s):\n`;
      for (const [project, tasks] of byProject) {
        out += `\n## ${project} (${tasks.length} tasks)\n`;
        out += tasks.map((t) => {
          let dates = "";
          if (t.start_on && t.due_on) dates = ` ${t.start_on} → ${t.due_on}`;
          else if (t.start_on) dates = ` starts ${t.start_on}`;
          else if (t.due_on) dates = ` due ${t.due_on}`;
          return `- ${t.name} (GID: ${t.gid})${t.assignee ? ` [${t.assignee}]` : ""}${dates}${t.section ? ` {${t.section}}` : ""}${t.completed ? " [DONE]" : ""}`;
        }).join("\n");
      }
      return out;
    }

    return `Found ${allTasks.length} task(s):\n${allTasks.map((t) => {
      let dates = "";
      if (t.start_on && t.due_on) dates = ` ${t.start_on} → ${t.due_on}`;
      else if (t.start_on) dates = ` starts ${t.start_on}`;
      else if (t.due_on) dates = ` due ${t.due_on}`;
      return `- ${t.name} (GID: ${t.gid})${t.assignee ? ` [${t.assignee}]` : ""}${dates}${t.section ? ` {${t.section}}` : ""}${t.completed ? " [DONE]" : ""}`;
    }).join("\n")}`;
  }

  if (action === "asana_get_task") {
    const result = await getTask(ctx.workspaceId, payload.task_gid);
    if (result.ok && result.task) {
      const t = result.task;
      const assigneeLabel = t.assignee ? (t.assignee.name || t.assignee.email || t.assignee.gid) : "Unassigned";
      const dueDate = effectiveDueDate(t);
      let out = `Task: ${t.name} (GID: ${t.gid})\nStatus: ${t.completed ? "Complete" : "Incomplete"}\nAssignee: ${assigneeLabel}${t.assignee?.email ? ` (${t.assignee.email})` : ""}\nStart: ${t.start_on || "No start date"}\nDue: ${dueDate || "No due date"}${t.notes ? `\nDescription: ${t.notes}` : ""}${t.permalink_url ? `\nURL: ${t.permalink_url}` : ""}`;
      if (t.stories && t.stories.length > 0) {
        out += `\n\nComments (${t.stories.length}):\n${t.stories.map((s: { created_by?: { name?: string }; created_at: string; text: string }) => `- ${s.created_by?.name || "Unknown"} (${new Date(s.created_at).toLocaleDateString()}): ${s.text}`).join("\n")}`;
      }
      return out;
    }
    return `Error: ${result.error}`;
  }

  if (action === "asana_create_task") {
    if (!allowedGids.has(payload.project_gid)) {
      return "Error: You don't have access to that project.";
    }
    const result = await createTask(ctx.workspaceId, payload);
    if (result.ok && result.task) {
      return `Task created: "${result.task.name}" (GID: ${result.task.gid})${result.task.permalink_url ? `\nURL: ${result.task.permalink_url}` : ""}`;
    }
    return `Error: ${result.error}`;
  }

  if (action === "asana_update_task") {
    const result = await updateTask(ctx.workspaceId, payload.task_gid, payload);
    if (result.ok && result.task) {
      return `Task updated: "${result.task.name}" (GID: ${result.task.gid})`;
    }
    return `Error: ${result.error}`;
  }

  if (action === "asana_add_comment") {
    const result = await addComment(ctx.workspaceId, payload.task_gid, payload.text);
    if (result.ok) {
      return `Comment added (GID: ${result.commentGid})`;
    }
    return `Error: ${result.error}`;
  }

  return `Error: Unknown Asana action: ${action}`;
}

// ── GitHub ─────────────────────────────────────────────────────────────

export async function executeGithubTool(
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  allowedRepos: Array<{ full_name: string; name: string }>,
  ctx: ToolContext
): Promise<string> {
  const allowedSet = new Set(allowedRepos.map((r) => r.full_name));
  const repoFullName = payload.owner && payload.repo ? `${payload.owner}/${payload.repo}` : null;

  if (repoFullName && !allowedSet.has(repoFullName)) {
    return "Error: You don't have access to that repository.";
  }

  if (action === "github_list_issues") {
    const result = await listIssues(ctx.workspaceId, payload.owner, payload.repo, {
      state: payload.state || "open",
      labels: payload.labels,
    });
    if (result.ok && result.issues) {
      return result.issues.length > 0
        ? `Found ${result.issues.length} issue(s):\n${result.issues.map((i) => `- #${i.number}: ${i.title} [${i.state}]${i.assignees?.length ? ` (${i.assignees.map((a) => a.login).join(", ")})` : ""}`).join("\n")}`
        : "No issues found.";
    }
    return `Error: ${result.error}`;
  }

  if (action === "github_get_issue") {
    const result = await getIssue(ctx.workspaceId, payload.owner, payload.repo, payload.issue_number);
    if (result.ok && result.issue) {
      const i = result.issue;
      let out = `Issue #${i.number}: ${i.title}\nState: ${i.state}\nAuthor: ${i.user?.login || "Unknown"}${i.assignees && i.assignees.length > 0 ? `\nAssignees: ${i.assignees.map((a: { login: string }) => a.login).join(", ")}` : ""}${i.labels && i.labels.length > 0 ? `\nLabels: ${i.labels.map((l: { name: string }) => l.name).join(", ")}` : ""}${i.body ? `\nDescription: ${i.body}` : ""}\nURL: ${i.html_url}`;
      if (result.comments && result.comments.length > 0) {
        out += `\n\nComments (${result.comments.length}):\n${result.comments.map((c: { user?: { login?: string }; created_at: string; body: string }) => `- ${c.user?.login || "Unknown"} (${new Date(c.created_at).toLocaleDateString()}): ${c.body}`).join("\n")}`;
      }
      return out;
    }
    return `Error: ${result.error}`;
  }

  if (action === "github_create_issue") {
    const result = await createIssue(ctx.workspaceId, payload.owner, payload.repo, {
      title: payload.title,
      body: payload.body,
      labels: payload.labels,
    });
    if (result.ok && result.issue) {
      return `Issue created: #${result.issue.number} "${result.issue.title}"\nURL: ${result.issue.html_url}`;
    }
    return `Error: ${result.error}`;
  }

  if (action === "github_update_issue") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.body !== undefined) updateData.body = payload.body;
    if (payload.state !== undefined) updateData.state = payload.state;
    if (payload.labels !== undefined) updateData.labels = payload.labels;
    const result = await updateIssue(ctx.workspaceId, payload.owner, payload.repo, payload.issue_number, updateData);
    if (result.ok && result.issue) {
      return `Issue updated: #${result.issue.number} "${result.issue.title}" [${result.issue.state}]`;
    }
    return `Error: ${result.error}`;
  }

  if (action === "github_add_comment") {
    const result = await addIssueComment(ctx.workspaceId, payload.owner, payload.repo, payload.issue_number, payload.body);
    if (result.ok) {
      return `Comment added to issue #${payload.issue_number}`;
    }
    return `Error: ${result.error}`;
  }

  if (action === "github_list_labels") {
    const result = await listLabels(ctx.workspaceId, payload.owner, payload.repo);
    if (result.ok && result.labels) {
      return result.labels.length > 0
        ? `Labels: ${result.labels.map((l) => l.name).join(", ")}`
        : "No labels found.";
    }
    return `Error: ${result.error}`;
  }

  return `Error: Unknown GitHub action: ${action}`;
}

// ── Google Calendar ────────────────────────────────────────────────────

function formatEventTime(event: GoogleCalendarEvent): string {
  if (event.start.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = event.end.dateTime ? new Date(event.end.dateTime) : null;
    const dateStr = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const endTime = end ? end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
    return `${dateStr}, ${startTime}${endTime ? ` - ${endTime}` : ""}`;
  }
  // All-day event
  return `${event.start.date} (all day)`;
}

export async function executeGoogleCalendarTool(
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  allowedCalendars: Array<{ id: string; name: string }>,
  ctx: ToolContext
): Promise<string> {
  const allowedIds = new Set(allowedCalendars.map((c) => c.id));
  const calendarNameMap = new Map(allowedCalendars.map((c) => [c.id, c.name]));

  if (action === "gcal_list_events") {
    const targetIds = payload.calendar_id ? [payload.calendar_id] : [...allowedIds];
    if (payload.calendar_id && !allowedIds.has(payload.calendar_id)) {
      return "Error: You don't have access to that calendar.";
    }

    const allEvents: Array<{ summary: string; id: string; time: string; location: string | null; attendees: string | null; calendar: string }> = [];
    for (const calId of targetIds) {
      const calName = calendarNameMap.get(calId) || calId;
      const result = await listEvents(ctx.workspaceId, calId, {
        timeMin: payload.time_min,
        timeMax: payload.time_max,
        maxResults: payload.max_results,
        query: payload.query,
      });
      if (result.ok && result.events) {
        allEvents.push(...result.events.map((e) => ({
          summary: e.summary || "(No title)",
          id: e.id,
          time: formatEventTime(e),
          location: e.location || null,
          attendees: e.attendees?.map((a) => a.displayName || a.email).join(", ") || null,
          calendar: calName,
        })));
      } else if (!result.ok) {
        return `Error: ${result.error}`;
      }
    }

    if (allEvents.length === 0) return "No events found in the specified time range.";

    // Sort by time string (events are already sorted per-calendar, but merge needs re-sort)
    if (targetIds.length > 1) {
      let out = `Found ${allEvents.length} event(s) across ${targetIds.length} calendar(s):\n`;
      for (const evt of allEvents) {
        out += `\n- ${evt.summary} (ID: ${evt.id})\n  When: ${evt.time}`;
        if (evt.location) out += `\n  Where: ${evt.location}`;
        if (evt.attendees) out += `\n  With: ${evt.attendees}`;
        out += `\n  Calendar: ${evt.calendar}`;
      }
      return out;
    }

    return `Found ${allEvents.length} event(s):\n${allEvents.map((e) => {
      let line = `- ${e.summary} (ID: ${e.id})\n  When: ${e.time}`;
      if (e.location) line += `\n  Where: ${e.location}`;
      if (e.attendees) line += `\n  With: ${e.attendees}`;
      return line;
    }).join("\n")}`;
  }

  if (action === "gcal_get_event") {
    const calId = payload.calendar_id || allowedCalendars[0]?.id;
    if (!calId || !allowedIds.has(calId)) {
      return "Error: You don't have access to that calendar.";
    }
    const result = await getEvent(ctx.workspaceId, calId, payload.event_id);
    if (result.ok && result.event) {
      const e = result.event;
      let out = `Event: ${e.summary || "(No title)"} (ID: ${e.id})\nWhen: ${formatEventTime(e)}\nStatus: ${e.status}`;
      if (e.location) out += `\nLocation: ${e.location}`;
      if (e.description) out += `\nDescription: ${e.description}`;
      if (e.organizer) out += `\nOrganizer: ${e.organizer.displayName || e.organizer.email}`;
      if (e.attendees && e.attendees.length > 0) {
        out += `\nAttendees (${e.attendees.length}):\n${e.attendees.map((a) => `- ${a.displayName || a.email} (${a.responseStatus || "unknown"})`).join("\n")}`;
      }
      if (e.conferenceData?.entryPoints) {
        const videoLink = e.conferenceData.entryPoints.find((ep) => ep.entryPointType === "video");
        if (videoLink) out += `\nVideo call: ${videoLink.uri}`;
      }
      if (e.htmlLink) out += `\nURL: ${e.htmlLink}`;
      return out;
    }
    return `Error: ${result.error}`;
  }

  if (action === "gcal_create_event") {
    const calId = payload.calendar_id || allowedCalendars[0]?.id;
    if (!calId || !allowedIds.has(calId)) {
      return "Error: You don't have access to that calendar.";
    }
    const result = await createEvent(ctx.workspaceId, calId, {
      summary: payload.summary,
      description: payload.description,
      location: payload.location,
      start: payload.start,
      end: payload.end,
      attendees: payload.attendees,
    });
    if (result.ok && result.event) {
      return `Event created: "${result.event.summary}" (ID: ${result.event.id})\nWhen: ${formatEventTime(result.event)}${result.event.htmlLink ? `\nURL: ${result.event.htmlLink}` : ""}`;
    }
    return `Error: ${result.error}`;
  }

  if (action === "gcal_update_event") {
    const calId = payload.calendar_id || allowedCalendars[0]?.id;
    if (!calId || !allowedIds.has(calId)) {
      return "Error: You don't have access to that calendar.";
    }
    const result = await updateEvent(ctx.workspaceId, calId, payload.event_id, {
      summary: payload.summary,
      description: payload.description,
      location: payload.location,
      start: payload.start,
      end: payload.end,
      attendees: payload.attendees,
    });
    if (result.ok && result.event) {
      return `Event updated: "${result.event.summary}" (ID: ${result.event.id})`;
    }
    return `Error: ${result.error}`;
  }

  return `Error: Unknown Google Calendar action: ${action}`;
}

// ── Report tools ──────────────────────────────────────────────────────

export function parseSaveReportBlock(raw: string): { title: string; content: string } | null {
  const titleSepMatch = raw.match(/^title:\s*(.+)\n---\n([\s\S]+)$/i);
  if (titleSepMatch) {
    return { title: titleSepMatch[1].trim(), content: titleSepMatch[2].trim() };
  }
  try {
    const fixedJson = raw.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    const parsed = JSON.parse(fixedJson);
    if (parsed.title && parsed.content) {
      return { title: parsed.title, content: parsed.content.replace(/\\n/g, "\n") };
    }
  } catch { /* not valid JSON */ }
  return null;
}

export async function executeSaveReport(
  raw: string,
  ctx: ToolContext
): Promise<{ id: string; title: string; content: string } | null> {
  const parsed = parseSaveReportBlock(raw);
  if (!parsed) return null;

  // Check if this conversation belongs to a work item with a linked report
  const { data: linkedWorkItem } = await ctx.supabase
    .from("work_items")
    .select("id, report_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("conversation_id", ctx.conversationId)
    .single();

  if (linkedWorkItem?.report_id) {
    // Update the existing linked report
    const { error } = await ctx.supabase.from("reports").update({
      title: parsed.title,
      content: parsed.content,
      agent_id: ctx.agentId,
      source: "agent",
      conversation_id: ctx.conversationId,
      updated_at: new Date().toISOString(),
    }).eq("id", linkedWorkItem.report_id);

    if (error) {
      console.error("[ToolExec] Failed to update linked report:", error.message);
      return null;
    }
    return { id: linkedWorkItem.report_id, title: parsed.title, content: parsed.content };
  }

  // No linked work item — create a new report
  const { data, error } = await ctx.supabase.from("reports").insert({
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    agent_id: ctx.agentId,
    title: parsed.title,
    content: parsed.content,
    source: "agent",
    conversation_id: ctx.conversationId,
  }).select("id").single();

  if (error) {
    console.error("[ToolExec] Failed to save report:", error.message);
    return null;
  }

  return { id: data.id, title: parsed.title, content: parsed.content };
}

export async function executeReadReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  ctx: ToolContext
): Promise<string | null> {
  let reportData = null;
  if (payload.id) {
    const { data } = await ctx.supabase
      .from("reports")
      .select("id, title, display_name, content, agent_id, updated_at")
      .eq("id", payload.id)
      .eq("workspace_id", ctx.workspaceId)
      .single();
    reportData = data;
  } else if (payload.title) {
    const { data } = await ctx.supabase
      .from("reports")
      .select("id, title, display_name, content, agent_id, updated_at")
      .eq("workspace_id", ctx.workspaceId)
      .or(`display_name.ilike.%${payload.title}%,title.ilike.%${payload.title}%`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    reportData = data;
  }

  if (!reportData) return null;

  const displayName = reportData.display_name || reportData.title;
  return `[System: Here is the requested report]\nTitle: ${displayName}\nID: ${reportData.id}\nLast updated: ${reportData.updated_at}\n\nContent:\n${reportData.content}`;
}

export async function executeUpdateReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  ctx: ToolContext
): Promise<string | null> {
  if (!payload.id || !payload.content) return null;

  const { data: existing } = await ctx.supabase
    .from("reports")
    .select("id, title, display_name")
    .eq("id", payload.id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!existing) return `Error: Report not found.`;

  const { error } = await ctx.supabase
    .from("reports")
    .update({
      content: payload.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id);

  if (error) return `Error: ${error.message}`;

  return `Report "${existing.display_name || existing.title}" updated successfully.`;
}
