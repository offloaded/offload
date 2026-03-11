import { createServerSupabase } from "@/lib/supabase-server";
import LandingPage from "./landing";

export default async function Home() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  return <LandingPage isAuthenticated={!!user} />;
}
