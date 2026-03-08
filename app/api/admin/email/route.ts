import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { emails, type } = body as {
    emails: string[];
    type: "waitlist" | "approved";
  };

  if (!emails?.length || !type) {
    return NextResponse.json(
      { error: "emails and type are required" },
      { status: 400 }
    );
  }

  if (!["waitlist", "approved"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'waitlist' or 'approved'" },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://offloaded.life";

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      if (type === "waitlist") {
        await resend.emails.send({
          from: "Offloaded <hello@offloaded.life>",
          to: email,
          subject: "You're on the list for Offloaded",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #111;">You're on the list!</h2>
              <p style="color: #444; line-height: 1.6;">
                Thanks for signing up for Offloaded. We've added you to the waitlist and will let you know as soon as your spot is ready.
              </p>
              <p style="color: #444; line-height: 1.6;">
                We're rolling out access gradually to make sure everyone has a great experience. Sit tight — we'll be in touch soon.
              </p>
              <p style="color: #888; font-size: 14px; margin-top: 32px;">
                — The Offloaded Team
              </p>
            </div>
          `,
        });
      } else {
        await resend.emails.send({
          from: "Offloaded <hello@offloaded.life>",
          to: email,
          subject: "You're in! Create your account on Offloaded",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #111;">You're in!</h2>
              <p style="color: #444; line-height: 1.6;">
                Great news — your spot on Offloaded is ready. Click the button below to create your account and get started.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}/auth" style="background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Create your account
                </a>
              </div>
              <p style="color: #888; font-size: 14px; margin-top: 32px;">
                — The Offloaded Team
              </p>
            </div>
          `,
        });
      }
      sent++;
    } catch (err) {
      console.error(`[admin/email] Failed to send to ${email}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ sent, failed });
}
