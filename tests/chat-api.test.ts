import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock Anthropic
const mockStream = {
  [Symbol.asyncIterator]: vi.fn(),
};

vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: vi.fn(() => ({
    messages: {
      stream: vi.fn(() => mockStream),
    },
  })),
  buildSystemPrompt: vi.fn(
    (agent: { name: string; purpose: string }) =>
      `You are ${agent.name}. ${agent.purpose}`
  ),
}));

describe("Chat API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnThis();
    mockChain.insert.mockReturnThis();
    mockChain.update.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
    mockChain.limit.mockReturnThis();
  });

  it("rejects unauthenticated requests", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { POST } = await import("@/app/api/chat/route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "123", message: "hi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects requests without agent_id", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await import("@/app/api/chat/route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects requests without message", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await import("@/app/api/chat/route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "123", message: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent agent", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const { POST } = await import("@/app/api/chat/route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "nonexistent", message: "hi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
