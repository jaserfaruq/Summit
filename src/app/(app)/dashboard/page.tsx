import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <DashboardClient />;
}
