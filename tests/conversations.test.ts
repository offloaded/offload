import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

function createChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "insert", "update", "delete",
    "eq", "is", "in", "lt",
    "order", "limit", "single",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

let mockChain = createChain();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Conversations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChain();
    mockSupabase.from.mockReturnValue(mockChain);
  });

  it("rejects unauthenticated requests", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { GET } = await import("@/app/api/conversations/route");
    const req = new Request(
      "http://localhost/api/conversations?agent_id=test"
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("requires agent_id or conversation_id", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { GET } = await import("@/app/api/conversations/route");
    const req = new Request("http://localhost/api/conversations");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty when no conversation exists for agent", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    // No conversation found
    mockChain.single.mockResolvedValueOnce({ data: null, error: null });

    const { GET } = await import("@/app/api/conversations/route");
    const req = new Request(
      "http://localhost/api/conversations?agent_id=agent-1"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.conversation_id).toBeNull();
    expect(body.messages).toEqual([]);
  });

  it("loads specific conversation by conversation_id", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    // Verify conversation belongs to user
    mockChain.single.mockResolvedValueOnce({
      data: { id: "conv-1" },
      error: null,
    });

    // Messages query
    const messages = [
      {
        id: "m1",
        conversation_id: "conv-1",
        role: "user",
        content: "Hello",
        routed_to: null,
        created_at: "2024-01-01T09:00:00Z",
      },
      {
        id: "m2",
        conversation_id: "conv-1",
        role: "assistant",
        content: "Hi there!",
        routed_to: null,
        created_at: "2024-01-01T09:00:05Z",
      },
    ];
    mockChain.limit.mockResolvedValueOnce({
      data: [...messages].reverse(), // API returns desc order
      error: null,
    });

    const { GET } = await import("@/app/api/conversations/route");
    const req = new Request(
      "http://localhost/api/conversations?conversation_id=conv-1"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.conversation_id).toBe("conv-1");
    expect(body.messages).toHaveLength(2);
  });

  it("returns empty for conversation owned by another user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    // Conversation not found for this user
    mockChain.single.mockResolvedValueOnce({ data: null, error: null });

    const { GET } = await import("@/app/api/conversations/route");
    const req = new Request(
      "http://localhost/api/conversations?conversation_id=conv-other"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.conversation_id).toBeNull();
    expect(body.messages).toEqual([]);
  });
});

describe("Chat API - conversation_id behavior", () => {
  it("chat API creates new conversation when no conversation_id is given", async () => {
    // This is a structural test — we verify the route code creates
    // a new conversation (insert) rather than finding an existing one.
    // The actual chat route is tested in chat-api.test.ts for auth/validation.

    const { readFileSync } = await import("fs");
    const routeCode = readFileSync("app/api/chat/route.ts", "utf-8");

    // Verify the route inserts a new conversation when no convId
    expect(routeCode).toContain('.insert({ user_id: user.id, agent_id })');
    // Verify it does NOT try to find an existing conversation
    expect(routeCode).not.toContain('Find existing conversation');
  });

  it("group chat API creates new conversation when no conversation_id is given", async () => {
    const { readFileSync } = await import("fs");
    const routeCode = readFileSync("app/api/chat/group/route.ts", "utf-8");

    expect(routeCode).toContain('.insert({ user_id: user.id, agent_id: null })');
    expect(routeCode).not.toContain('Find existing conversation');
    // Should NOT search for existing conversations
    expect(routeCode).not.toContain('.is("agent_id", null)');
  });
});
