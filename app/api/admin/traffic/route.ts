import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function GET() {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceSupabase();

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: views } = await supabase
    .from("page_views")
    .select("*")
    .gte("created_at", weekAgo);

  const { count: waitlistCount } = await supabase
    .from("waitlist")
    .select("id", { count: "exact", head: true });

  // Aggregate by day
  const byDay: Record<string, { views: number; visitors: Set<string> }> = {};
  const referrerCounts: Record<string, number> = {};
  const pageCounts: Record<string, number> = {};
  const allVisitors = new Set<string>();

  for (const v of views || []) {
    const day = new Date(v.created_at).toLocaleDateString("en-US", {
      weekday: "short",
    });

    if (!byDay[day]) byDay[day] = { views: 0, visitors: new Set() };
    byDay[day].views++;
    if (v.visitor_id) {
      byDay[day].visitors.add(v.visitor_id);
      allVisitors.add(v.visitor_id);
    }

    // Referrers
    const source = v.referrer || "Direct";
    referrerCounts[source] = (referrerCounts[source] || 0) + 1;

    // Pages
    if (v.path) {
      pageCounts[v.path] = (pageCounts[v.path] || 0) + 1;
    }
  }

  const totalViews = views?.length || 0;
  const totalUniques = allVisitors.size || Math.round(totalViews * 0.7);

  // Build daily data — last 7 days in order
  const dailyData: { day: string; views: number; uniques: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
    const entry = byDay[dayLabel];
    dailyData.push({
      day: dayLabel,
      views: entry?.views || 0,
      uniques: entry?.visitors.size || 0,
    });
  }

  // Top sources sorted by visits
  const topSources = Object.entries(referrerCounts)
    .map(([source, visits]) => ({
      source,
      visits,
      pct: totalViews > 0 ? Math.round((visits / totalViews) * 100) : 0,
    }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  // Top pages sorted by views
  const topPages = Object.entries(pageCounts)
    .map(([page, pageViews]) => ({ page, views: pageViews }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const conversionRate =
    totalUniques > 0
      ? Math.round(((waitlistCount || 0) / totalUniques) * 10000) / 100
      : 0;

  return NextResponse.json({
    dailyData,
    totalViews,
    totalUniques,
    topSources,
    topPages,
    waitlistCount: waitlistCount || 0,
    conversionRate,
  });
}
