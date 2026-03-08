import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse = NextResponse.next({ request });
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users: allow landing, auth, and API routes only
  if (
    !user &&
    request.nextUrl.pathname !== "/" &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/api")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from /auth
  if (user && request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  // Admin route protection: only ADMIN_EMAIL can access /admin
  if (user && request.nextUrl.pathname.startsWith("/admin")) {
    if (user.email !== process.env.ADMIN_EMAIL) {
      const url = request.nextUrl.clone();
      url.pathname = "/chat";
      return NextResponse.redirect(url);
    }
  }

  // Suspension check for authenticated app routes (not landing, auth, API, or admin)
  if (
    user &&
    !request.nextUrl.pathname.startsWith("/api") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/admin") &&
    request.nextUrl.pathname !== "/" &&
    request.nextUrl.pathname !== "/suspended"
  ) {
    // Check user_profiles for suspension - use service role via fetch to Supabase REST API
    try {
      const profileRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=suspended`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
        }
      );
      if (profileRes.ok) {
        const profiles = await profileRes.json();
        if (profiles.length > 0 && profiles[0].suspended === true) {
          const url = request.nextUrl.clone();
          url.pathname = "/suspended";
          return NextResponse.redirect(url);
        }
      }
    } catch {
      // If profile check fails, allow through rather than blocking
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
