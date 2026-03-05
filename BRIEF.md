# Offload — Project Brief for Claude Code

## What is this

Offload is a web app where a user creates a team of AI agents, each with a name, purpose, and document knowledge base. The user talks to a single **Operations Manager** interface, which routes requests to the right specialist agent. Users can also talk directly to individual agents.

Think of it as: you're the business owner, these are your remote workers, and you chat with them like you would on Slack.

## Design reference

The file `prototype.jsx` in this repo is the complete UI prototype built in React. Use it as the **visual and interaction reference** — the light/white colour palette, Inter font, layout structure, sidebar navigation, chat interface, settings/agent-builder, and dashboard should all match this design. The prototype is fully functional as a static demo but has no backend — your job is to make it real.

## Tech stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: Supabase (Auth, Postgres, pgvector, Storage)
- **AI**: Anthropic Claude API (claude-sonnet-4-5-20250929) for chat + embeddings via Voyage AI or OpenAI embeddings
- **Styling**: Tailwind CSS (migrate from inline styles in prototype)
- **Deployment**: Target is a staging server on a Digital Ocean droplet (Node.js, self-hosted)

## Data model

### Users
Standard Supabase auth. Each user has their own set of agents.

### Agents
```
agents
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── name (text) — e.g. "HR Advisor", "Marketing Lead"
├── purpose (text) — the agent's purpose statement, used as system prompt context
├── color (text) — hex colour for UI
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

### Documents
```
documents
├── id (uuid, PK)
├── agent_id (uuid, FK → agents)
├── file_name (text)
├── file_size (bigint)
├── storage_path (text) — path in Supabase Storage
├── status (text) — 'processing' | 'ready' | 'error'
├── created_at (timestamptz)
```

### Document chunks (for RAG)
```
document_chunks
├── id (uuid, PK)
├── document_id (uuid, FK → documents)
├── content (text) — the chunk text
├── embedding (vector(1536)) — for similarity search
├── chunk_index (integer)
├── metadata (jsonb) — page number, section, etc.
```

### Conversations
```
conversations
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── agent_id (uuid, FK → agents, nullable) — null = Operations Manager
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

### Messages
```
messages
├── id (uuid, PK)
├── conversation_id (uuid, FK → conversations)
├── role (text) — 'user' | 'assistant'
├── content (text)
├── routed_to (uuid, FK → agents, nullable) — which agent handled this (for Ops Manager)
├── created_at (timestamptz)
```

## Core features (build in this order)

### Phase 1: Auth + Agent CRUD
- Supabase auth (email/password is fine for MVP)
- Create, edit, delete agents (name, purpose, colour)
- Agent list in sidebar, dynamic from database
- Dashboard showing agent cards

### Phase 2: Direct agent chat
- Chat interface per agent
- Messages sent to Claude API with agent's purpose as system prompt
- Message history persisted in database
- Streaming responses (use Anthropic SDK streaming)

### Phase 3: Document upload + RAG
- File upload to Supabase Storage (PDF, DOCX, TXT, XLSX)
- Document processing pipeline: extract text → chunk → embed → store in pgvector
- Chat retrieves relevant chunks via similarity search and includes them in context
- Show document list per agent in settings

### Phase 4: Operations Manager
- Single chat interface that routes to agents
- Routing logic: send user message + list of agents (name + purpose) to Claude, ask it to pick the right agent, then send the actual query to that agent with its RAG context
- Show routing indicator in UI (the "Routing to HR Advisor..." animation)
- Tag responses with which agent handled them

## Operations Manager routing prompt

The routing works as a two-step LLM call:

**Step 1 — Route:**
```
You are an operations manager. The user has these agents on their team:

{for each agent: name, purpose}

Based on the user's message, decide which agent should handle this. Respond with JSON only:
{"agent_id": "...", "agent_name": "..."}

If no agent is a good fit, respond with:
{"agent_id": null, "agent_name": null}
```

**Step 2 — Respond:**
Send the user's message to the selected agent's chat (with its system prompt + RAG context).

## Agent system prompt template

```
You are {agent.name}.

Your purpose: {agent.purpose}

You have access to the following documents in your knowledge base:
{list of document names}

When answering questions, reference the relevant documents from your knowledge base. If you don't have enough information in your documents to answer confidently, say so.

Be concise, professional, and helpful. You are a remote team member — communicate like a competent colleague, not an AI assistant.
```

## RAG pipeline

1. **Upload**: File goes to Supabase Storage, document record created with status 'processing'
2. **Extract**: Pull text from file (use `pdf-parse` for PDFs, `mammoth` for DOCX, raw for TXT)
3. **Chunk**: Split into ~500 token chunks with ~50 token overlap
4. **Embed**: Generate embeddings using Voyage AI or OpenAI embeddings API
5. **Store**: Insert chunks + embeddings into document_chunks table
6. **Update**: Set document status to 'ready'

**Retrieval at query time:**
1. Embed the user's query
2. Similarity search against document_chunks for that agent (top 5 chunks)
3. Include retrieved chunks in the system prompt as context

## File structure

```
offload/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (redirect to /chat)
│   ├── auth/
│   │   └── page.tsx (login/signup)
│   ├── chat/
│   │   └── page.tsx (Operations Manager)
│   ├── agent/
│   │   └── [id]/
│   │       └── page.tsx (Direct agent chat)
│   ├── settings/
│   │   ├── page.tsx (Agent list)
│   │   └── [id]/
│   │       └── page.tsx (Agent editor)
│   ├── dashboard/
│   │   └── page.tsx
│   └── api/
│       ├── chat/
│       │   └── route.ts (Chat endpoint — streaming)
│       ├── route/
│       │   └── route.ts (Ops Manager routing)
│       ├── agents/
│       │   └── route.ts (CRUD)
│       └── documents/
│           ├── upload/
│           │   └── route.ts
│           └── process/
│               └── route.ts (Chunking + embedding)
├── components/
│   ├── Sidebar.tsx
│   ├── ChatView.tsx
│   ├── AgentTag.tsx
│   ├── MessageBubble.tsx
│   └── ...
├── lib/
│   ├── supabase.ts (client)
│   ├── anthropic.ts (API client)
│   ├── rag.ts (chunking, embedding, retrieval)
│   └── routing.ts (Ops Manager routing logic)
├── prototype.jsx (design reference — DO NOT modify)
├── .env.local
└── package.json
```

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY= (if using OpenAI embeddings)
```

## Key UX details from the prototype

- **Sidebar**: "Offload" wordmark at top, Dashboard / Operations Manager / Settings as main nav, then "Your team" section listing agents dynamically with colour dots
- **Chat**: Messages in bubbles — user messages right-aligned with grey background, agent messages left-aligned with white background and border. Typing indicator with 3 bouncing dots. Input bar at bottom with send button that changes to agent colour.
- **Operations Manager**: Shows "Routing to {agent}..." with arrow icon before response. Response tagged with coloured pill showing which agent handled it.
- **Settings**: List of agent cards, tap to edit. Editor has colour picker (10 preset colours), name input, purpose textarea, document list with upload button. Delete button (red) on existing agents.
- **Colour palette**: #FAFAFA background, #FFFFFF surfaces, #E8E8EC borders, #1A1A1A text, #2C5FF6 accent
- **Font**: Inter, weights 300-600
- **Mobile**: Burger menu → slide-out drawer from left. No bottom tab bar.
