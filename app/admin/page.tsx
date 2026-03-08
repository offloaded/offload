import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import AdminDashboard from "./admin-dashboard";

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");
  if (user.email !== process.env.ADMIN_EMAIL) redirect("/chat");

  return <AdminDashboard />;
}
