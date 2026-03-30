import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_5_SYSTEM } from "@/lib/prompts";
import { FindRoutesRequest, RouteRecommendation } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: FindRoutesRequest = await request.json();
  const { location, targetDistance, targetElevation, preferences } = body;

  const userMessage = `Location: ${location}
Target distance: ${targetDistance} miles
Target elevation gain: ${targetElevation} ft
Preferences: ${preferences || "none"}`;

  try {
    const responseText = await callClaude(PROMPT_5_SYSTEM, userMessage, 2048, "haiku");
    const parsed = parseClaudeJSON<{ routes: RouteRecommendation[] }>(responseText);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error finding routes:", error);
    return NextResponse.json(
      { error: "Failed to find routes" },
      { status: 500 }
    );
  }
}
