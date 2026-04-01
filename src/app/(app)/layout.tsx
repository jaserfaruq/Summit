import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { PlanSwitcherProvider } from "@/lib/plan-switcher-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_validator")
    .eq("id", user.id)
    .single();

  return (
    <PlanSwitcherProvider>
      <AppShell email={user.email || ""} isValidator={profile?.is_validator}>
        {children}
      </AppShell>
    </PlanSwitcherProvider>
  );
}
