import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { MatchObjectiveRequest, MatchObjectiveResponse, ValidatedObjective, SearchMatch } from "@/lib/types";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_SEARCH_SYSTEM } from "@/lib/prompts";
import { findSeedMatch } from "@/lib/seed-data";

export const maxDuration = 30;

/**
 * Server-side alias matching: check seed data before hitting Claude.
 * Returns the matching seed entry or null.
 */
function findAliasMatch(name: string, route?: string) {
  return findSeedMatch(name, route);
}

/**
 * Overlay authoritative seed data onto a validated objective from the DB.
 * This ensures graduation_benchmarks, target_scores, and taglines are never stale.
 */
function withSeedData(vo: ValidatedObjective): ValidatedObjective {
  const seed = findSeedMatch(vo.name);
  if (!seed) return vo;
  return {
    ...vo,
    target_scores: seed.target_scores,
    taglines: seed.taglines,
    graduation_benchmarks: seed.graduation_benchmarks,
  };
}

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

  // Search mode: pre-match aliases first, then ask Claude for remaining suggestions
  if (mode === "search") {
    // Step 1: Check seed data for a direct alias match before calling Claude
    const preMatch = findAliasMatch(name, route || undefined);
    const preMatchedVO = preMatch
      ? allVOs.find((vo) =>
          vo.match_aliases.some((alias) => {
            const a = alias.toLowerCase().trim();
            const n = name.toLowerCase().trim();
            return a === n || n.includes(a) || a.includes(n);
          })
        )
      : null;

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
      const response = await callClaude(PROMPT_SEARCH_SYSTEM, userMessage, 2048, "sonnet");
      console.log("AI search raw response:", response.substring(0, 500));
      const parsed = parseClaudeJSON<{ suggestions: SearchSuggestion[] }>(response);
      console.log("Parsed suggestions count:", parsed.suggestions?.length, JSON.stringify(parsed.suggestions?.map(s => s.name)));

      const matches: SearchMatch[] = [];

      // If we pre-matched, add that as the first gold result
      if (preMatchedVO) {
        matches.push({
          validatedObjective: withSeedData(preMatchedVO),
          tier: "gold" as const,
          matchReason: "Direct match from validated library",
        });
      }

      // Add Claude suggestions, deduplicating against pre-match
      for (const suggestion of parsed.suggestions.slice(0, 3)) {
        const matchedVO = suggestion.validated && suggestion.validatedId
          ? allVOs.find(vo => vo.id === suggestion.validatedId)
          : null;

        // Skip if this duplicates the pre-match
        if (matchedVO && preMatchedVO && matchedVO.id === preMatchedVO.id) continue;

        if (matchedVO) {
          matches.push({
            validatedObjective: withSeedData(matchedVO),
            tier: "gold" as const,
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
            tier: "silver" as const,
            matchReason: suggestion.matchReason,
          });
        }

        if (matches.length >= 3) break;
      }

      const response2: MatchObjectiveResponse = {
        tier: matches[0]?.tier || "bronze",
        matches,
        anchors: [],
      };
      return NextResponse.json(response2);
    } catch (err) {
      console.error("AI search failed:", err);
      // Fallback: if Claude fails but we have a pre-match, still return it
      if (preMatchedVO) {
        return NextResponse.json({
          tier: "gold" as const,
          matches: [{
            validatedObjective: withSeedData(preMatchedVO),
            tier: "gold" as const,
            matchReason: "Direct match from validated library",
          }],
          anchors: [],
        });
      }
      return NextResponse.json({
        tier: "bronze" as const,
        matches: [],
        anchors: [],
      });
    }
  }

  // Manual mode: check seed data first, then DB aliases
  const seedMatch = findAliasMatch(name, route || undefined);

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
    // Overlay seed data to ensure benchmarks are never stale
    const response: MatchObjectiveResponse = {
      tier: "gold",
      validatedObjective: withSeedData(exactMatch),
      anchors: [],
    };
    return NextResponse.json(response);
  }

  // Seed matched but no DB match (shouldn't happen, but handle gracefully)
  if (seedMatch) {
    // Find closest VO by name
    const closestVO = allVOs.find((vo) =>
      vo.name.toLowerCase().includes(seedMatch.name.toLowerCase()) ||
      seedMatch.name.toLowerCase().includes(vo.name.toLowerCase())
    );
    if (closestVO) {
      const response: MatchObjectiveResponse = {
        tier: "gold",
        validatedObjective: withSeedData(closestVO),
        anchors: [],
      };
      return NextResponse.json(response);
    }
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
