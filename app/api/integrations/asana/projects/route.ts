import { getWorkspaceContext } from "@/lib/workspace";
import { fetchWorkspacesAndProjects } from "@/lib/asana";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const result = await fetchWorkspacesAndProjects(ctx.workspaceId);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 502 });
  }

  return new Response(JSON.stringify(result.workspaces));
}
