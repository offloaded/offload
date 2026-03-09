import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { getNextRun } from "@/lib/cron";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { agent_id, instruction, cron, run_at, timezone, recurring, destination } = body;

  if (!agent_id || !instruction?.trim()) {
    return NextResponse.json(
      { error: "agent_id and instruction are required" },
      { status: 400 }
    );
  }

  const isRecurring = recurring !== false;

  // Recurring tasks need a cron; one-off tasks need run_at (or fallback to cron)
  if (isRecurring && !cron?.trim()) {
    return NextResponse.json(
      { error: "cron is required for recurring tasks" },
      { status: 400 }
    );
  }
  if (!isRecurring && !run_at && !cron?.trim()) {
    return NextResponse.json(
      { error: "run_at is required for one-off tasks" },
      { status: 400 }
    );
  }

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agent_id)
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Calculate next run time and the cron to store (null for one-off with run_at)
  let nextRun: string;
  let cronToStore: string | null = null;

  if (isRecurring) {
    try {
      nextRun = getNextRun(cron.trim(), new Date()).toISOString();
      cronToStore = cron.trim();
    } catch {
      return NextResponse.json(
        { error: "Invalid cron expression" },
        { status: 400 }
      );
    }
  } else if (run_at) {
    const runDate = new Date(run_at);
    if (isNaN(runDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid run_at datetime" },
        { status: 400 }
      );
    }
    nextRun = runDate.toISOString();
    cronToStore = null;
  } else {
    // Fallback: one-off but cron was provided (backward compat)
    try {
      nextRun = getNextRun(cron.trim(), new Date()).toISOString();
      cronToStore = cron.trim();
    } catch {
      return NextResponse.json(
        { error: "Invalid cron expression" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("scheduled_tasks")
    .insert({
      user_id: user.id,
      agent_id,
      instruction: instruction.trim(),
      cron: cronToStore,
      timezone: timezone || "UTC",
      recurring: isRecurring,
      destination: destination || "dm",
      next_run_at: nextRun,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, instruction, cron, timezone, enabled } = body;

  if (!id) {
    return NextResponse.json({ error: "Task ID required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (instruction !== undefined) updates.instruction = instruction.trim();
  if (cron !== undefined) {
    updates.cron = cron.trim();
    try {
      updates.next_run_at = getNextRun(cron, new Date()).toISOString();
    } catch {
      return NextResponse.json(
        { error: "Invalid cron expression" },
        { status: 400 }
      );
    }
  }
  if (timezone !== undefined) updates.timezone = timezone;
  if (enabled !== undefined) {
    updates.enabled = enabled;
    if (enabled && !updates.next_run_at) {
      // Re-enable: recalculate next run
      const { data: existing } = await supabase
        .from("scheduled_tasks")
        .select("cron")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (existing) {
        try {
          updates.next_run_at = getNextRun(
            (cron as string) || existing.cron,
            new Date()
          ).toISOString();
        } catch {
          // ignore
        }
      }
    }
  }

  const { data, error } = await supabase
    .from("scheduled_tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Task ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("scheduled_tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
