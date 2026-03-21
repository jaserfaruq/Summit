import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { MatchObjectiveRequest, MatchObjectiveResponse, ValidatedObjective, SearchMatch } from "@/lib/types";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_SEARCH_SYSTEM } from "@/lib/prompts";

interface SearchSuggestion {
  name: string;
  route: string;
  type: string;
  description: string;
  difficulty: string;
  total_gain_ft: number | null;
  distance_miles: number | null;
  summit_elevation_ft: number | null;
  technical_grade: string | null;
  validated: boolean;
  validatedId: string | null;
  matchReason: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: MatchObjectiveRequest & { mode?: "search" | "manual" } = await request.json();
  const { name, route, type, mode } = body;

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

  const allVOs = (validatedObjectives as ValidatedObjective[]) || [];

  // Search mode: use Claude to suggest 3 closely related objectives
  if (mode === "search") {
    const voSummaries = allVOs.map(vo => ({
      id: vo.id,
      name: vo.name,
      route: vo.route,
      type: vo.type,
      match_aliases: vo.match_aliases,
    }));

    const userMessage = `Search query: "${name}"

Validated objectives in our library:
${JSON.stringify(voSummaries, null, 2)}

Suggest 3 closely related routes/objectives for this search. Prioritize validated objectives when they match, but also suggest real routes not in our library if they're geographically relevant.`;

    try {
      const response = await callClaude(PROMPT_SEARCH_SYSTEM, userMessage, 2048);
      const parsed = parseClaudeJSON<{ suggestions: SearchSuggestion[] }>(response);

      const matches: SearchMatch[] = parsed.suggestions.slice(0, 3).map(suggestion => {
        // First try Claude's validated flag + ID
        let matchedVO = suggestion.validated && suggestion.validatedId
          ? allVOs.find(vo => vo.id === suggestion.validatedId)
          : null;

        // Fallback: server-side alias match by name/route regardless of what Claude said
        // This catches cases where Claude returns wrong UUID or validated: false for a real match
        if (!matchedVO) {
          const suggestionName = suggestion.name.toLowerCase().trim();
          const suggestionRoute = suggestion.route?.toLowerCase().trim() || "";
          matchedVO = allVOs.find(vo =>
            vo.match_aliases.some(alias => {
              const a = alias.toLowerCase().trim();
              return (
                a === suggestionName ||
                a === `${suggestionName} ${suggestionRoute}`.trim() ||
                suggestionName.includes(a) ||
                a.includes(suggestionName)
              );
            })
          ) || null;
        }

        if (matchedVO) {
          return {
            validatedObjective: matchedVO,
            tier: "gold" as const,
            matchReason: suggestion.matchReason,
          };
        }

        return {
          suggestedObjective: {
            name: suggestion.name,
            route: suggestion.route,
            type: suggestion.type as ValidatedObjective["type"],
            description: suggestion.description,
            difficulty: suggestion.difficulty,
            total_gain_ft: suggestion.total_gain_ft,
            distance_miles: suggestion.distance_miles,
            summit_elevation_ft: suggestion.summit_elevation_ft,
            technical_grade: suggestion.technical_grade,
          },
          tier: "silver" as const,
          matchReason: suggestion.matchReason,
        };
      });

      const response2: MatchObjectiveResponse = {
        tier: matches[0]?.tier || "bronze",
        matches,
        anchors: [],
      };
      return NextResponse.json(response2);
    } catch {
      // Fallback to basic matching if Claude fails
      return NextResponse.json({
        tier: "bronze" as const,
        matches: [],
        anchors: [],
      });
    }
  }

  // Manual mode (original behavior): check for exact match first
  const exactMatch = allVOs.find((vo) =>
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
  const anchors = allVOs.filter((vo) => {
    if (vo.type !== type) return false;
    const inputTags = [normalizedName, type];
    const voTags = (vo.tags as string[]).map((t) => t.toLowerCase());
    return inputTags.some((tag) => voTags.some((vt) => vt.includes(tag) || tag.includes(vt)));
  });

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
