import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport } from "@/lib/generate-report";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId, weekNumber } = await request.json();
  console.log(`[Report Route] POST generate-weekly-report: plan=${planId}, week=${weekNumber}, user=${user.id}`);

  try {
    await generateWeeklyReport(supabase, user.id, planId, weekNumber);
    console.log(`[Report Route] Successfully generated report for week ${weekNumber}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Report Route] Error generating weekly report:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate weekly report" },
      { status: 500 }
    );
  }
}
