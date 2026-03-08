import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, source } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase(), source: source || "landing" });

    if (error) {
      // Unique constraint violation — already on the list
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "You're already on the list! We'll be in touch soon." },
          { status: 200 }
        );
      }
      console.error("Waitlist insert error:", error);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "You're on the list. We'll be in touch soon." },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
