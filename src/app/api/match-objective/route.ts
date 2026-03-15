import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { MatchObjectiveRequest, MatchObjectiveResponse, ValidatedObjective } from "@/lib/types";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: MatchObjectiveRequest = await request.json();
  const { name, route, type } = body;

  // Normalize input
  const normalizedName = name.toLowerCase().trim();
  const normalizedRoute = route?.toLowerCase().trim() || "";

  // Fetch all validated objectives
  const { data: validatedObjectives, error } = await supabase
    .from("validated_objectives")
    .select("*")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check for exact match via match_aliases
  const exactMatch = (validatedObjectives as ValidatedObjective[])?.find((vo) =>
    vo.match_aliases.some((alias) => {
      const normalizedAlias = alias.toLowerCase().trim();
      return (
        normalizedAlias === normalizedName ||
        normalizedAlias === `${normalizedName} ${normalizedRoute}` ||
        normalizedName.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedName)
      );
    })
  );

  if (exactMatch) {
    const response: MatchObjectiveResponse = {
      tier: "gold",
      validatedObjective: exactMatch,
      anchors: [],
    };
    return NextResponse.json(response);
  }

  // Find similar objectives (Silver tier)
  const anchors = (validatedObjectives as ValidatedObjective[])?.filter((vo) => {
    if (vo.type !== type) return false;
    // Check for overlapping tags
    const inputTags = [normalizedName, type];
    const voTags = (vo.tags as string[]).map((t) => t.toLowerCase());
    return inputTags.some((tag) => voTags.some((vt) => vt.includes(tag) || tag.includes(vt)));
  }) || [];

  if (anchors.length > 0) {
    const response: MatchObjectiveResponse = {
      tier: "silver",
      anchors: anchors.slice(0, 3),
    };
    return NextResponse.json(response);
  }

  // Bronze tier — no matches
  const response: MatchObjectiveResponse = {
    tier: "bronze",
    anchors: [],
  };
  return NextResponse.json(response);
}
