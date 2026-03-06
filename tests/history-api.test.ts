import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a flexible chainable mock that tracks calls
function createMockSupabase() {
  const results: Array<{ data: unknown; error: unknown }> = [];
  let resultIndex = 0;

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const terminal = (key: string) => {
    chain[key] = vi.fn().mockImplementation(() => {
      const r = results[resultIndex] || { data: null, error: null };
      resultIndex++;
      return Promise.resolve(r);
    });
  };

  // All chainable methods return the chain
  for (const m of [
    "select", "insert", "update", "delete",
    "eq", "is", "in", "lt", "ilike", "textSearch",
    "order", "limit",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  // Terminal methods return results
  terminal("single");
  // Override limit to also be terminal when awaited
  chain.limit = vi.fn().mockImplementation(() => {
    const r = results[resultIndex] || { data: null, error: null };
    resultIndex++;
    return {
      ...chain,
      then: (resolve: (v: unknown) => void) => resolve(r),
      // Make it thenable
      [Symbol.toStringTag]: "Promise",
    };
  });

  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn().mockReturnValue(chain),
    _pushResult: (data: unknown, error: unknown = null) => {
      results.push({ data, error });
    },
    _reset: () => {
      resultIndex = 0;
      results.length = 0;
    },
  };

  return mockSupabase;
}

const mockSupabase = createMockSupabase();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("History API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("rejects unauthenticated requests", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { GET } = await import("@/app/api/history/route");
    const req = new Request("http://localhost/api/history");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty list when no conversations exist", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockSupabase._pushResult([]); // conversations query

    const { GET } = await import("@/app/api/history/route");
    const req = new Request("http://localhost/api/history");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.conversations).toEqual([]);
    expect(body.has_more).toBe(false);
  });

  it("rejects delete without id", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { DELETE } = await import("@/app/api/history/route");
    const req = new Request("http://localhost/api/history", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
