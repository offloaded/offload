import { createServerSupabase } from "@/lib/supabase-server";
import { acceptPendingInvites } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Accept any pending workspace invites for this user
    if (data?.user?.email) {
      try {
        await acceptPendingInvites(data.user.id, data.user.email);
      } catch (err) {
        console.error("[Auth] Failed to accept pending invites:", err);
      }
    }
  }

  return NextResponse.redirect(`${origin}/chat`);
}
