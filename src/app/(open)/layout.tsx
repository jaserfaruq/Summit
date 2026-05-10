import { createClient } from "@/lib/supabase-server";
import AppShell from "@/components/AppShell";
import { PlanSwitcherProvider } from "@/lib/plan-switcher-context";
import { DraftPlanProvider } from "@/lib/draft-plan-context";

export default async function OpenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isValidator = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_validator")
      .eq("id", user.id)
      .single();
    isValidator = !!profile?.is_validator;
  }

  return (
    <DraftPlanProvider>
      <PlanSwitcherProvider>
        <AppShell email={user?.email || null} isValidator={isValidator}>
          {children}
        </AppShell>
      </PlanSwitcherProvider>
    </DraftPlanProvider>
  );
}
