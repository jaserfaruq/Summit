import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport } from "@/lib/generate-report";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId, weekNumber } = await request.json();

  try {
    await generateWeeklyReport(user.id, planId, weekNumber);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error generating weekly report:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly report" },
      { status: 500 }
    );
  }
}
