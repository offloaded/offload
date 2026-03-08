import { createServerSupabase } from "@/lib/supabase-server";

export async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return { authorized: false, user: null } as const;
  }
  return { authorized: true, user } as const;
}
