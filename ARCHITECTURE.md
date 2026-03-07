# Offload Architecture

Multi-agent AI assistant platform. Users create agents with personalities, knowledge bases, and soft skills. Agents respond in direct messages and self-select into group conversations.

Built with Next.js 16, Supabase (Postgres + Auth + Storage), Claude (Anthropic), and OpenAI embeddings.

---

## System Overview

```
User
  |
  |-- Direct Message --> /api/chat --> Claude Sonnet (streaming SSE)
  |                                      |-- RAG retrieval (if docs)
  |                                      |-- Web search (if enabled)
  |                                      |-- skills_update detection
  |                                      |-- schedule_request detection
  |                                      |-- group_message_request --> cross-post to group
  |
  |-- Group Message ---> /api/chat/group --> Evaluate phase (parallel Haiku)
  |                                           |-- Respond phase (sequential Sonnet + SSE)
  |                                           |-- Follow-up detection (up to 2 rounds)
  |
  |-- Scheduled Task --> /api/cron/run-tasks --> Claude Sonnet
  |                        (external cron)       |-- Save to DM or group
  |                                              |-- Trigger group orchestration
  |
  |-- Document Upload -> /api/documents/upload --> Extract text
                           |                        |-- Chunk (600 tokens, 100 overlap)
                           |                        |-- Embed (OpenAI text-embedding-3-small)
                           |                        |-- Store vectors in document_chunks
                           |
                           +-- /api/documents/process (async processing trigger)
```

---

## API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/agents` | GET, POST, PUT, DELETE | Agent CRUD. PUT handles personality traits, voice, soft skills |
| `/api/agents/documents` | GET, DELETE | List/delete documents for an agent |
| `/api/agents/voice` | POST | Extract voice profile from writing samples via Haiku |
| `/api/chat` | POST | 1-on-1 agent chat. SSE streaming. RAG + web search + schedule detection |
| `/api/chat/group` | POST | Group chat. Agent self-selection, staggered responses, follow-ups |
| `/api/conversations` | GET | Load conversation messages with pagination. Supports `after` param for polling |
| `/api/conversations/mark-read` | POST | Mark conversation as read (updates `last_read_at`) |
| `/api/documents/upload` | POST | Upload file to Supabase Storage, trigger processing |
| `/api/documents/process` | POST | Process uploaded document: extract, chunk, embed |
| `/api/scheduled-tasks` | GET, POST, PUT, DELETE | Scheduled task CRUD |
| `/api/cron/run-tasks` | POST | Execute due tasks. Authenticated via `CRON_SECRET` bearer token |
| `/api/unread-counts` | GET | Unread message counts per chat (calls `get_unread_counts` RPC) |
| `/api/activity` | GET | Activity log entries for the user |
| `/api/activity/latest` | GET | Most recent activity per agent |
| `/api/history` | GET | Conversation history listing |

---

## Database Schema

### agents
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK -> auth.users | RLS enforced |
| name | text | |
| role | text | Short title (e.g. "EOS Coach") — shown in sidebar |
| purpose | text | Free-text role description |
| color | text | Hex color for UI |
| web_search_enabled | boolean | Enables Tavily search |
| working_style | jsonb | Array of style tags: "Proactive", "Analytical", "Collaborative" |
| communication_style | jsonb | Array of style tags: "Concise", "Professional", "Supportive" |
| voice_samples | jsonb | Array of writing sample strings |
| voice_profile | text | LLM-extracted communication style description |
| soft_skills | jsonb | Array of {skill, confidence, note} objects |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### documents
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| agent_id | uuid FK -> agents | Cascade delete |
| file_name | text | |
| file_size | bigint | |
| storage_path | text | Path in Supabase Storage |
| status | text | "processing", "ready", "error" |
| created_at | timestamptz | |

### document_chunks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| document_id | uuid FK -> documents | Cascade delete |
| content | text | Chunk text |
| embedding | vector(1536) | OpenAI embedding |
| chunk_index | integer | Position in document |
| metadata | jsonb | {document_date, section_heading} |

### conversations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK -> auth.users | RLS enforced |
| agent_id | uuid FK -> agents | NULL = group chat |
| last_read_at | timestamptz | For unread tracking |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### messages
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| conversation_id | uuid FK -> conversations | Cascade delete |
| role | text | "user" or "assistant" |
| content | text | Plain text. Group: `[AgentName] text` format |
| routed_to | uuid FK -> agents | Optional routing target |
| created_at | timestamptz | |

### scheduled_tasks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK -> auth.users | RLS enforced |
| agent_id | uuid FK -> agents | Cascade delete |
| instruction | text | What the agent should do |
| cron | text | Cron expression (nullable for one-off) |
| timezone | text | IANA timezone |
| recurring | boolean | true = repeating, false = one-off |
| destination | text | "dm" or "group" |
| enabled | boolean | |
| last_run_at | timestamptz | |
| next_run_at | timestamptz | When to run next |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### activity_log
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK -> auth.users | |
| agent_id | uuid FK -> agents | Nullable |
| type | text | Event type (web_search, task_completed, etc.) |
| description | text | Human-readable description |
| metadata | jsonb | Extra context |
| created_at | timestamptz | |

All tables have Row Level Security (RLS) policies enforcing `auth.uid() = user_id` ownership.

---

## Core Flows

### Direct Message Flow
**Files:** `app/api/chat/route.ts`, `lib/anthropic.ts`, `lib/rag.ts`

1. Authenticate user, load agent, verify ownership
2. Find or create conversation (reuses most recent for agent)
3. Save user message to DB
4. Load conversation history (up to 50 messages)
5. RAG retrieval if agent has documents (topK scales with doc count: 5-25)
6. Web search via Tavily if enabled on agent
7. Build system prompt: purpose + personality + voice + skills + RAG context + web results + schedule/feature detection instructions
8. Stream response from Claude Sonnet via SSE
9. Post-stream: detect structured blocks (`schedule_request`, `feature_request`, `group_message_request`, `skills_update`)
10. Clean response (strip XML tags, structured blocks), save to DB
11. Forward detected blocks as SSE events to client

### Group Chat Pipeline
**Files:** `app/api/chat/group/route.ts`, `lib/group-orchestration.ts`

**Phase 1 — Classification:**
- `classifyIntent()`: casual / knowledge / action / search
- `detectMessageAddressing()`: team-wide patterns ("everyone", "what are your...") and @mentions
- Team-wide + casual = upgrade to knowledge intent

**Phase 2 — Smart History:**
- `buildSmartHistory()`: Fetch 30 messages, run topic boundary detection via Haiku
- If new topic detected: trim to messages from new topic onward
- Always keep at least 5 messages

**Phase 3 — Agent Selection:**

*Casual shortcut* (intent=casual, no mentions):
- Score agents by word overlap with message
- Top 2 respond via Haiku (fast, no RAG)

*Full pipeline*:
- If team-wide: all agents respond (skip evaluation)
- Otherwise: parallel Haiku evaluation per agent — each decides respond/skip with urgency and weight
- Evaluation considers: initiative trait, whether agent already spoke, relevance to role
- Mentioned agents always respond at high urgency

**Phase 4 — Response Generation (sequential, staggered):**
- For each responding agent (ordered by urgency):
  - Send `agent_typing` SSE event
  - Generate response via Sonnet (with RAG, personality, voice, skills)
  - Enforce minimum delay (high: 3-5s, medium: 4-8s, low: 8-14s)
  - Send `agent_text` SSE event
  - Accumulate prior responses so later agents don't repeat

**Phase 5 — Follow-up Detection:**
- `detectFollowUpTriggers()`: scan responses for questions (`?`)
- Specific patterns: `@Name`, `Name, what...`, `how about Name`, role-based ("governance perspective")
- Ambiguous patterns: "how about you", "any thoughts", "what do you think"
- Specific targets can be re-engaged; ambiguous only targets agents who haven't responded
- Up to 2 follow-up rounds within the same SSE stream

**Phase 6 — Save:**
- Combined response saved as single DB message (`[Agent1] text\n[Agent2] text`)
- Follow-up rounds saved as separate messages

### Document Processing (RAG)
**Files:** `app/api/documents/upload/route.ts`, `app/api/documents/process/route.ts`, `lib/rag.ts`

1. **Upload**: Validate file type (PDF, DOCX, XLSX, TXT, CSV, MD), max 20MB. Store in Supabase Storage at `{userId}/{agentId}/{timestamp}_{filename}`. Create document record with status "processing".
2. **Extract**: PDF via `unpdf`, DOCX via `mammoth`, XLSX via `xlsx`, plain text via UTF-8.
3. **Chunk**: 600-token chunks with 100-token overlap. Smart boundaries at paragraph/sentence breaks. Extract metadata (document dates, section headings).
4. **Embed**: OpenAI `text-embedding-3-small` (1536 dimensions). Batch of 100 chunks per API call.
5. **Store**: Insert chunks with embeddings into `document_chunks`.

**Retrieval** (`retrieveContext`):
1. Query expansion via Haiku: generate 3-5 search variations
2. Parallel vector search across all variations + full-text search
3. Merge results, deduplicate by chunk ID
4. Return top K chunks sorted by similarity

### Scheduled Task Execution
**Files:** `app/api/cron/run-tasks/route.ts`, `lib/cron.ts`

1. External cron service calls `/api/cron/run-tasks` with `CRON_SECRET` bearer token
2. Uses Supabase service role key (bypasses RLS)
3. Query: all enabled tasks where `next_run_at <= now()`
4. For each task:
   - Load agent config
   - Find or create conversation (DM or group)
   - Optionally retrieve RAG context and web search results
   - Generate response via Claude Sonnet
   - Save as assistant message
   - If group destination: trigger `runGroupOrchestration()` for other agents to react
   - Update `next_run_at` (recurring) or disable (one-off)

### Style System
**File:** `lib/anthropic.ts`

Selectable style tags replace the old personality slider system. Each tag maps to a system prompt instruction:

**Working Style** (how the agent approaches problems):
- **Proactive**: Take initiative, flag issues, suggest next steps, ask clarifying questions
- **Analytical**: Data-driven, structured thinking, evidence-based reasoning
- **Collaborative**: Build on others' input, reference colleagues, team-oriented

**Communication Style** (how the agent communicates):
- **Concise**: Brief, to the point, prioritise clarity over completeness
- **Professional**: Formal, structured tone, proper terminology
- **Supportive**: Encouraging, warm, acknowledges effort and progress

Multiple tags can be selected per category. Universal rule appended: never repeat a point already made. Only re-engage if @mentioned, asked directly, or have genuinely new information.

### Voice Profile
**Files:** `app/api/agents/voice/route.ts`, `lib/anthropic.ts`

User pastes 3-5 writing samples. Haiku analyzes and extracts a communication style profile (tone, sentence structure, vocabulary, patterns). Profile injected into system prompt: "Communicate in this style: [profile]."

### Soft Skills
**Files:** `app/api/chat/route.ts`, `lib/anthropic.ts`

Agents can self-assess skills via `skills_update` JSON blocks in chat responses. Skills merge with existing (matched by name). Injected into system prompt as strengths to lean into. Users can also manually add/edit/remove skills in settings.

---

## Client Architecture

### Streaming State (`lib/inflight.ts`)
In-memory pub/sub system per chat. Manages:
- `streaming`: whether a response is in progress
- `streamText`: accumulated DM response text
- `streamMessages`: accumulated group chat agent responses
- `typingAgentName`/`typingAgentColor`: current typing indicator
- `scheduleRequest`, `featureRequest`, `groupMessageRequest`: detected structured blocks

Subscribers get snapshots on every state change via `subscribe(chatId, listener)`.

### Message Cache (`lib/chat-cache.ts`)
Client-side memory cache per chat. Stores conversation ID, messages array, and pagination state. Functions: `getCached()`, `setCache()`, `updateMessages()`, `pollNewMessages()`.

Polling: every 12 seconds when not streaming, fetches messages newer than last known timestamp. Multi-agent responses from polling are split and staggered on the frontend (3-8s random gaps between agents).

### Components
- **`ChatView.tsx`**: 1-on-1 chat. Subscribes to inflight state, renders streaming text, handles schedule/feature request modals.
- **`GroupChatView.tsx`**: Group chat. Parses `[AgentName] text` format into per-agent message bubbles. Shows per-agent typing indicators. Staggered polling display.
- **`Sidebar.tsx`**: Navigation. Lists agents and group chat. Shows unread badges.

---

## Authentication

**Middleware** (`middleware.ts`):
- Creates Supabase SSR client with cookie handling
- Unauthenticated users redirected to `/` (except `/api` and `/auth`)
- Authenticated users on `/auth` redirected to `/chat`

**API routes**: Each creates a server Supabase client via `createServerSupabase()` and calls `supabase.auth.getUser()`.

**Cron route**: Authenticates via `Authorization: Bearer {CRON_SECRET}` header. Uses service role key to bypass RLS.

---

## Environment Variables

| Variable | Used by |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron route only |
| `ANTHROPIC_API_KEY` | All Claude calls |
| `OPENAI_API_KEY` | Embeddings (RAG) |
| `TAVILY_API_KEY` | Web search |
| `CRON_SECRET` | Cron route authentication |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (SSR cookies) |
| Storage | Supabase Storage |
| LLM | Claude Sonnet 4.5 (responses), Claude Haiku 4.5 (evaluation, topic detection, voice extraction) |
| Embeddings | OpenAI text-embedding-3-small |
| Web Search | Tavily API |
| Doc Parsing | unpdf, mammoth, xlsx |
| Styling | Tailwind CSS 4 |
| Testing | Vitest + Testing Library |
