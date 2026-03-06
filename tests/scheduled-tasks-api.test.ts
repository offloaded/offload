import { describe, it, expect, vi, beforeEach } from "vitest";

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
    "eq", "is", "in", "lt", "lte",
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

vi.mock("@/lib/cron", () => ({
  getNextRun: vi.fn(() => new Date("2024-01-09T09:00:00Z")),
}));

describe("Scheduled Tasks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChain();
    mockSupabase.from.mockReturnValue(mockChain);
  });

  it("rejects unauthenticated requests", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { GET } = await import("@/app/api/scheduled-tasks/route");
    const req = new Request("http://localhost/api/scheduled-tasks?agent_id=test");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("requires fields for POST", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await import("@/app/api/scheduled-tasks/route");
    const req = new Request("http://localhost/api/scheduled-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "a1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("requires task ID for DELETE", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { DELETE } = await import("@/app/api/scheduled-tasks/route");
    const req = new Request("http://localhost/api/scheduled-tasks", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
