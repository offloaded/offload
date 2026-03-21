import { createServiceSupabase } from "@/lib/supabase-server";
import { refineAgentKeywords } from "@/lib/routing-keywords";
import { NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Find agents with recent conversations
  const { data: activeAgents, error } = await supabase
    .from("agents")
    .select("id, name")
    .is("deleted_at", null)
    .gte("last_message_at", thirtyDaysAgo);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!activeAgents || activeAgents.length === 0) {
    return NextResponse.json({ refined: 0, skipped: "no active agents" });
  }

  console.log(`[RefineKeywords] Processing ${activeAgents.length} agent(s)`);

  const results = await Promise.allSettled(
    activeAgents.map(async (agent) => {
      const diff = await refineAgentKeywords(agent.id);
      if (diff) {
        const added = diff.after.filter((k) => !diff.before.includes(k));
        const removed = diff.before.filter((k) => !diff.after.includes(k));
        console.log(`[RefineKeywords] ${agent.name}: +${added.length} -${removed.length} keywords`);
        if (added.length > 0) console.log(`  Added: ${added.slice(0, 10).join(", ")}`);
        if (removed.length > 0) console.log(`  Removed: ${removed.slice(0, 10).join(", ")}`);
        return { agent: agent.name, added: added.length, removed: removed.length };
      }
      console.log(`[RefineKeywords] ${agent.name}: no changes (no recent data)`);
      return { agent: agent.name, skipped: true };
    })
  );

  const refined = results.filter(
    (r) => r.status === "fulfilled" && !(r.value as { skipped?: boolean }).skipped
  ).length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[RefineKeywords] Done: ${refined} refined, ${failed} failed`);

  return NextResponse.json({ refined, failed, total: activeAgents.length });
}
