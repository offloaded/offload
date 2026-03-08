import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  let query = supabase
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.ilike("email", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const body = await req.json();
  const { ids, status } = body as {
    ids: string[];
    status: "emailed" | "approved";
  };

  if (!ids?.length || !status) {
    return NextResponse.json(
      { error: "ids and status are required" },
      { status: 400 }
    );
  }

  if (!["emailed", "approved"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'emailed' or 'approved'" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("waitlist")
    .update({ status })
    .in("id", ids)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length || 0 });
}
