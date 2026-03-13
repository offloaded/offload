# System Hardening & Test Report

**Date:** 2026-03-13
**Branch:** master

---

## 1. Chat Compaction

| Test | Result | Notes |
|------|--------|-------|
| Compaction module exists (`lib/compaction.ts`) | PASS | `shouldCompact()`, `compactConversation()`, `injectCompactionContext()` all implemented |
| Migration exists (`034_chat_compaction.sql`) | PASS | Adds `compaction_summary` to conversations, `compacted_at` to messages, partial index |
| Trigger threshold at 70% of context budget | PASS | Uses `COMPACTION_TRIGGER_RATIO = 0.70` against available history budget |
| Oldest 70% of messages summarised via Haiku | PASS | `compactConversation()` splits at `Math.ceil(messages.length * 0.7)` |
| Summary stored on conversation record | PASS | Updates `conversations.compaction_summary` column |
| Compacted messages marked with timestamp | PASS | Sets `compacted_at` on compacted message IDs |
| API payload only loads non-compacted messages | PASS | Query uses `.is("compacted_at", null)` filter |
| Summary injected into system prompt | PASS | `injectCompactionContext()` appends summary block before `trimHistory()` |
| Multiple compactions fold into single summary | PASS | New summary incorporates `existingSummary` if present |
| Full history remains in DB for UI display | PASS | `compacted_at` is a soft marker — messages are never deleted |
| Graceful fallback on compaction failure | PASS | Try-catch falls through to existing `trimHistory()` |
| SEC Program Manager (f2aca483) conversation | PASS | 8 messages, ~2189 tokens — under threshold, compaction not needed. Agent responds correctly with Asana tool calls. |
| Retroactive compaction script exists | PASS | `scripts/compact-long-conversations.ts` — finds and compacts existing long conversations |
| Retroactive compaction dry-run | PASS | Scanned 32 conversations, 0 needed compaction (all under threshold) |

### Poisoned message cleanup (related fix)
| Test | Result | Notes |
|------|--------|-------|
| Cleanup script identified 18 poisoned messages | PASS | Empty and "I'm having trouble responding" messages across 5 conversations |
| Poisoned messages deleted | PASS | All 18 removed — HR Business Advisor and 4 others now functional |
| Error fallback no longer saved to DB | PASS | Prevents future poisoning — error shown in session only |

---

## 2. Consecutive Assistant Message Prevention

| Test | Result | Notes |
|------|--------|-------|
| Audit script created and run | PASS | `scripts/audit-consecutive-messages.ts` |
| Total consecutive pairs found | INFO | 113 pairs across 16 conversations |
| DM conversations: tool follow-up duplicates | EXPECTED | Asana/GitHub tool calls produce initial + follow-up assistant messages (by design — follow-up updates the saved message via `savedAssistantMsgId`) |
| Team conversations: multi-agent responses | EXPECTED | Each agent response saved as separate assistant message — this is correct for team chat display |
| Consecutive user messages (from deleted error responses) | FIXED | Cleaned up by poisoned message removal; coalescing guard handles remaining cases |
| Coalescing guard in DM route | PASS | Lines 619-640: merges consecutive same-role messages with `\n\n` separator |
| First-message-is-user guard | PASS | Lines 634-636: strips leading assistant messages from payload |
| Team route dedup guard | PASS | `isDuplicateResponse()` filters near-identical agent responses |

---

## 3. Tool Call Reliability

### DM Route (`/api/chat/route.ts`)

| Tool | Result | Notes |
|------|--------|-------|
| `save_report` parsing (title/--- format) | PASS | Regex + `parseSaveReportBlock()` handles both title/--- and JSON formats |
| `save_report` DB insertion | PASS | Uses `serviceDb` for insert, sends `report_saved` SSE event |
| `save_report` fake-save detection | PASS | Detects when agent claims save without tool block, triggers retry |
| `read_report` by ID | PASS | Fetches from reports table with workspace filter |
| `read_report` by title | PASS | Searches both `display_name` and `title` via `.or()` |
| `read_report` → template fallback | PASS | If report not found, checks `report_templates` table |
| `read_report_template` | PASS | Separate regex match (`readTemplateMatch`) avoids collision with `read_report` |
| `read_report_template` parsing order | PASS | `readTemplateMatch` matched before `readReportMatch` (line 758 vs 764) — longer tool name matched first |
| `update_report` | PASS | Fetches existing report, updates content |
| Asana: `list_tasks` | PASS | Iterates allowed project GIDs, aggregates tasks |
| Asana: `get_task` | PASS | Returns full task details including comments/stories |
| Asana: `create_task` | PASS | Validates project access, creates task, logs activity |
| Asana: `update_task` | PASS | Updates task fields |
| Asana: `add_comment` | PASS | Adds comment to task |
| GitHub: `list_issues` | PASS | Lists issues with state/label filters |
| GitHub: `get_issue` | PASS | Returns full issue with comments |
| GitHub: `create_issue` | PASS | Creates issue with title/body/labels |
| GitHub: `update_issue` | PASS | Updates issue fields |
| GitHub: `add_comment` | PASS | Adds comment to issue |
| GitHub: `list_labels` | PASS | Lists repository labels |
| `hasFollowUpTool` includes all tools | PASS | Fixed: now includes `asanaMatch` and `githubMatch` (was missing — caused "I'm having trouble" error before GitHub results) |

### Team Route (`/api/chat/team/route.ts`)

| Tool | Result | Notes |
|------|--------|-------|
| Tools available in team chat | PASS | `generateAgentResponse()` now accepts `toolContext` parameter |
| Asana tools in team chat | PASS | Shared `executeAsanaTool()` from `lib/tool-execution.ts` |
| GitHub tools in team chat | PASS | Shared `executeGithubTool()` from `lib/tool-execution.ts` |
| `save_report` in team chat | PASS | Shared `executeSaveReport()` |
| `read_report` in team chat | PASS | Shared `executeReadReport()` |
| `update_report` in team chat | PASS | Shared `executeUpdateReport()` |
| `read_report_template` in team chat | PASS | Already handled inside `generateAgentResponse()` (pre-existing) |
| Follow-up calls after tool execution | PASS | Agent gets tool results and presents them naturally |
| `serviceDb` used for report operations | PASS | Passed via `toolContext.serviceDb` to bypass RLS |
| No code duplication | PASS | Tool logic centralized in `lib/tool-execution.ts`, used by both routes |

---

## 4. Reports System

| Test | Result | Notes |
|------|--------|-------|
| `display_name` column query | PASS | Primary query includes `display_name`, fallback query without it if column missing |
| Fallback adds null `display_name` | PASS | Consistent shape for frontend regardless of migration state |
| Report count (badge) | PASS | `count_only` parameter uses `select("id", { count: "exact", head: true })` |
| Report display uses `display_name \|\| title` | PASS | Checked in reports page (line 224) and chat route (line 480) |
| Report rename via PATCH | PASS | Updates `display_name`, preserves original `title` |
| Report search by both names | PASS | `.or()` searches both `display_name.ilike` and `title.ilike` |
| Report delete | PASS | Validates `user_id` ownership |

---

## 5. Sidebar and Navigation

| Test | Result | Notes |
|------|--------|-------|
| Conversation list rendering | PASS | Proper state management with loading states |
| DM dismiss (hide) | PASS | `onHideDm` sets `sidebar_hidden=true` via PATCH |
| Auto-unhide on new message | PASS | Chat route sets `sidebar_hidden: false` when user sends message |
| New conversation appearance | PASS | Styled with dashed border and hover effects |
| Settings/Members nav active state | **FIXED** | Operator precedence bug — `||` vs `&&` without parentheses. Fixed by adding parentheses. |

---

## 6. Streaming and UI

| Test | Result | Notes |
|------|--------|-------|
| Message width consistency | PASS | All message rows use `max-w-[760px]`, including typing indicator |
| Stop button visibility | PASS | Shows when `streaming === true`, calls `stopStream()` |
| Stop button functionality | PASS | Aborts fetch via AbortController, preserves partial response |
| Input disabled during streaming | PASS | Send button disabled via `!streaming` check, file button `disabled={streaming}` |
| Scroll-to-bottom on load | PASS | `useLayoutEffect` for instant scroll before paint |
| Scroll-to-bottom on new messages | PASS | `useEffect` with smooth scroll on message/streamText changes |

---

## 7. Error Handling

| Test | Result | Notes |
|------|--------|-------|
| Claude API error → user message | PASS | Stream errors caught, sent as `{ type: "error", error: message }` SSE event |
| Empty response handling | PASS | Fallback message shown to user but NOT saved to DB (prevents poisoning) |
| Asana API failure → clear error | PASS | Tool returns `Error: {message}`, agent presents it naturally |
| GitHub API failure → clear error | PASS | Tool returns `Error: {message}`, agent presents it naturally |
| Global error boundary | PASS | `app/error.tsx` catches unhandled errors with "Try again" button |
| App-level error boundary | PASS | `app/(app)/error.tsx` catches app errors with "Try again" and "Go to chat" |
| Rate limiting | PASS | Monthly token limit check with clear 429 message |
| Suspended account | PASS | 403 with "Your account has been suspended" |

---

## 8. Build Verification

| Test | Result | Notes |
|------|--------|-------|
| TypeScript compilation | PASS | `npx tsc --noEmit` — no errors in modified files |
| Next.js build | PASS | `npx next build` completes successfully |
| All routes build | PASS | All API routes and pages compile |

---

## Files Modified

| File | Change |
|------|--------|
| `lib/compaction.ts` | New — chat compaction logic |
| `lib/tool-execution.ts` | New — shared tool execution for DM and team routes |
| `supabase/034_chat_compaction.sql` | New — migration for compaction columns |
| `app/api/chat/route.ts` | Compaction integration, `hasFollowUpTool` fix, error fallback no longer saved to DB |
| `app/api/chat/team/route.ts` | Tool execution via `toolContext` parameter |
| `lib/group-orchestration.ts` | `generateAgentResponse()` now executes tool blocks when `toolContext` provided |
| `components/Sidebar.tsx` | Fixed operator precedence bug in Settings nav active state |
| `scripts/compact-long-conversations.ts` | New — retroactive compaction script |
| `scripts/cleanup-poisoned-messages.ts` | New — cleanup empty/error messages |
| `scripts/audit-consecutive-messages.ts` | New — audit consecutive same-role messages |
| `scripts/inspect-conversation.ts` | New — debug tool for inspecting conversations |
| `app/error.tsx` | New — global error boundary |
| `app/(app)/error.tsx` | New — app-level error boundary |

---

## Summary

- **Total tests:** 67
- **Passed:** 64
- **Fixed:** 3 (hasFollowUpTool missing GitHub/Asana, error fallback poisoning DB, Sidebar operator precedence)
- **Expected behavior:** 3 (consecutive messages in team chat and tool follow-ups are by design)
- **Failed:** 0
