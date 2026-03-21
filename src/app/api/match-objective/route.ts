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

/**
 * Server-side alias match against validated objectives.
 * Checks the query against all match_aliases using substring matching.
 */
function findAliasMatch(
  query: string,
  allVOs: ValidatedObjective[],
  excludeIds?: Set<string>
): ValidatedObjective | null {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return null;
  return allVOs.find((vo) => {
    if (excludeIds?.has(vo.id)) return false;
    return vo.match_aliases.some((alias) => {
      const a = alias.toLowerCase().trim();
      return a === normalized || normalized.includes(a) || a.includes(normalized);
    });
  }) || null;
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

  // Search mode: pre-match aliases FIRST, then use Claude for additional suggestions
  if (mode === "search") {
    // Pre-search: check raw query against aliases before calling Claude
    const preMatch = findAliasMatch(normalizedName, allVOs);

    const matches: SearchMatch[] = [];
    const includedIds = new Set<string>();

    // Add pre-matched Gold result first
    if (preMatch) {
      matches.push({
        validatedObjective: preMatch,
        tier: "gold",
        matchReason: "Direct match from our validated library",
      });
      includedIds.add(preMatch.id);
    }

    // Call Claude for additional suggestions
    const suggestionCount = preMatch ? 2 : 3;
    const voSummaries = allVOs.map(vo => ({
      id: vo.id,
      name: vo.name,
      route: vo.route,
      type: vo.type,
      match_aliases: vo.match_aliases,
    }));

    const excludeClause = preMatch
      ? `\n\nDo NOT suggest "${preMatch.name} (${preMatch.route})" — it has already been matched. Suggest ${suggestionCount} other related objectives instead.`
      : "";

    const userMessage = `Search query: "${name}"

Validated objectives in our library:
${JSON.stringify(voSummaries, null, 2)}

Suggest ${suggestionCount} closely related routes/objectives for this search.${excludeClause} Prioritize validated objectives when they match, but also suggest real routes not in our library if they're geographically relevant.`;

    try {
      const response = await callClaude(PROMPT_SEARCH_SYSTEM, userMessage, 2048);
      const parsed = parseClaudeJSON<{ suggestions: SearchSuggestion[] }>(response);

      for (const suggestion of parsed.suggestions.slice(0, suggestionCount)) {
        // Try Claude's validated flag + ID first
        let matchedVO = suggestion.validated && suggestion.validatedId
          ? allVOs.find(vo => vo.id === suggestion.validatedId)
          : null;

        // Fallback: server-side alias match on suggestion name
        if (!matchedVO) {
          matchedVO = findAliasMatch(suggestion.name, allVOs, includedIds)
            || findAliasMatch(`${suggestion.name} ${suggestion.route || ""}`.trim(), allVOs, includedIds);
        }

        // Skip if already included via pre-match
        if (matchedVO && includedIds.has(matchedVO.id)) continue;

        if (matchedVO) {
          includedIds.add(matchedVO.id);
          matches.push({
            validatedObjective: matchedVO,
            tier: "gold",
            matchReason: suggestion.matchReason,
          });
        } else {
          matches.push({
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
            tier: "silver",
            matchReason: suggestion.matchReason,
          });
        }
      }
    } catch {
      // Claude failed — if we have a pre-match, still return it
      if (matches.length === 0) {
        return NextResponse.json({
          tier: "bronze" as const,
          matches: [],
          anchors: [],
        });
      }
    }

    return NextResponse.json({
      tier: matches[0]?.tier || "bronze",
      matches,
      anchors: [],
    } as MatchObjectiveResponse);
  }

  // Manual mode: check for exact alias match first
  const exactMatch = findAliasMatch(normalizedName, allVOs)
    || findAliasMatch(`${normalizedName} ${normalizedRoute}`, allVOs);

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
