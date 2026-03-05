import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
};

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Document Upload API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnThis();
    mockChain.insert.mockReturnThis();
    mockChain.delete.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
  });

  it("rejects unauthenticated uploads", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { POST } = await import("@/app/api/documents/upload/route");

    const formData = new FormData();
    formData.append("file", new File(["content"], "test.txt", { type: "text/plain" }));
    formData.append("agent_id", "agent-1");

    const req = new Request("http://localhost/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects missing file", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await import("@/app/api/documents/upload/route");

    const formData = new FormData();
    formData.append("agent_id", "agent-1");

    const req = new Request("http://localhost/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects unsupported file types", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await import("@/app/api/documents/upload/route");

    const formData = new FormData();
    formData.append(
      "file",
      new File(["content"], "test.exe", { type: "application/x-msdownload" })
    );
    formData.append("agent_id", "agent-1");

    const req = new Request("http://localhost/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unsupported file type");
  });
});

describe("Document List API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.order.mockReturnThis();
  });

  it("rejects unauthenticated requests", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { GET } = await import("@/app/api/agents/documents/route");
    const req = new Request(
      "http://localhost/api/agents/documents?agent_id=123"
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("requires agent_id parameter", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { GET } = await import("@/app/api/agents/documents/route");
    const req = new Request("http://localhost/api/agents/documents");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
