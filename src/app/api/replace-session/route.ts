import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { PlanSession, ReplaceSessionRequest } from "@/lib/types";
import { calculateWeekTotalHours } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: ReplaceSessionRequest = await request.json();
  const { planId, weekNumber, sessionIndex, replacementSession } = body;

  // Verify plan ownership
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Fetch the weekly target
  const { data: weekTarget, error: weekError } = await supabase
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", planId)
    .eq("week_number", weekNumber)
    .single();

  if (weekError || !weekTarget) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  const sessions = [...(weekTarget.sessions as PlanSession[])];
  if (sessionIndex < 0 || sessionIndex >= sessions.length) {
    return NextResponse.json({ error: "Invalid session index" }, { status: 400 });
  }

  const currentSession = sessions[sessionIndex];

  // Build the replacement with original preserved
  const newSession: PlanSession = { ...replacementSession };

  if (replacementSession.isAlternative === undefined || replacementSession.isAlternative) {
    // Replacing with an alternative: preserve the true original
    // If the current session already has an originalSession, keep that deeper original
    newSession.originalSession = currentSession.originalSession || currentSession;
    // Clean the originalSession to avoid nested originals
    if (newSession.originalSession.originalSession) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { originalSession: nested, ...cleanOriginal } = newSession.originalSession;
      newSession.originalSession = cleanOriginal as PlanSession;
    }
    newSession.isAlternative = true;
  } else {
    // Restoring original: remove alternative markers
    delete newSession.originalSession;
    delete newSession.isAlternative;
  }

  sessions[sessionIndex] = newSession;

  // Recalculate total hours
  const totalHours = calculateWeekTotalHours(sessions);

  const { error: updateError } = await supabase
    .from("weekly_targets")
    .update({ sessions, total_hours: totalHours })
    .eq("id", weekTarget.id);

  if (updateError) {
    console.error("Error updating sessions:", updateError);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }

  return NextResponse.json({ success: true, sessions });
}
