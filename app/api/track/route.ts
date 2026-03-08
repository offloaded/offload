import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path, referrer, visitor_id } = body as {
      path: string;
      referrer?: string;
      visitor_id?: string;
    };

    if (!path) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();

    const { error } = await supabase.from("page_views").insert({
      path,
      referrer: referrer || null,
      visitor_id: visitor_id || null,
    });

    if (error) {
      console.error("[track] Failed to insert page view:", error);
      return NextResponse.json(
        { error: "Failed to track" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
