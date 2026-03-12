import { getWorkspaceContext } from "@/lib/workspace";
import { listUserRepos } from "@/lib/github";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const result = await listUserRepos(ctx.workspaceId);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 502 });
  }

  // Return simplified repo list for the picker
  const repos = (result.repos || []).map((r) => ({
    full_name: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    description: r.description,
  }));

  return new Response(JSON.stringify(repos));
}
