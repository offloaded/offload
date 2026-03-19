import { getWorkspaceContext } from "@/lib/workspace";
import { fetchCalendarsForPicker } from "@/lib/google-calendar";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const result = await fetchCalendarsForPicker(ctx.workspaceId);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 500 });
  }

  return new Response(JSON.stringify(result.calendars || []));
}
