import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { MatchObjectiveRequest, MatchObjectiveResponse, ValidatedObjective, SearchMatch } from "@/lib/types";

function computeMatchScore(vo: ValidatedObjective, normalizedName: string, normalizedRoute: string): { score: number; isGold: boolean; reason: string } {
  // Check for gold-tier alias match
  const aliasMatch = vo.match_aliases.some((alias) => {
    const na = alias.toLowerCase().trim();
    return (
      na === normalizedName ||
      na === `${normalizedName} ${normalizedRoute}` ||
      normalizedName.includes(na) ||
      na.includes(normalizedName)
    );
  });

  if (aliasMatch) {
    return { score: 100, isGold: true, reason: `Exact match: ${vo.name} — ${vo.route}` };
  }

  // Compute fuzzy similarity score for silver matches
  let score = 0;
  const voNameLower = vo.name.toLowerCase();
  const voRouteLower = vo.route.toLowerCase();
  const voDesc = (vo.description || "").toLowerCase();

  // Word overlap with objective name
  const inputWords = normalizedName.split(/\s+/).filter(w => w.length > 2);
  const nameWords = voNameLower.split(/\s+/);
  const routeWords = voRouteLower.split(/\s+/);
  const allTargetWords = [...nameWords, ...routeWords];

  for (const word of inputWords) {
    if (allTargetWords.some(tw => tw.includes(word) || word.includes(tw))) {
      score += 20;
    }
    if (voDesc.includes(word)) {
      score += 5;
    }
  }

  // Partial substring match
  if (voNameLower.includes(normalizedName) || normalizedName.includes(voNameLower)) {
    score += 30;
  }

  // Tag overlap with input name words
  const voTags = (vo.tags as string[]).map(t => t.toLowerCase());
  for (const word of inputWords) {
    if (voTags.some(tag => tag.includes(word) || word.includes(tag))) {
      score += 10;
    }
  }

  const reason = score > 0
    ? `Similar objective: ${vo.name} — ${vo.route}`
    : `Reference objective: ${vo.name}`;

  return { score, isGold: false, reason };
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

  // Search mode: return 3 closest matches
  if (mode === "search") {
    const scored = allVOs.map(vo => {
      const { score, isGold, reason } = computeMatchScore(vo, normalizedName, normalizedRoute);
      return { vo, score, isGold, reason };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top 3 with score > 0
    const topMatches = scored.filter(s => s.score > 0).slice(0, 3);

    // If we have fewer than 3, pad with highest-scoring remaining by type match
    if (topMatches.length < 3) {
      const remaining = scored
        .filter(s => s.score === 0 && !topMatches.some(tm => tm.vo.id === s.vo.id))
        .sort((a, b) => {
          // Prefer same type
          const aTypeMatch = a.vo.type === type ? 1 : 0;
          const bTypeMatch = b.vo.type === type ? 1 : 0;
          return bTypeMatch - aTypeMatch;
        });
      while (topMatches.length < 3 && remaining.length > 0) {
        topMatches.push(remaining.shift()!);
      }
    }

    const matches: SearchMatch[] = topMatches.map(m => ({
      validatedObjective: m.vo,
      tier: m.isGold ? "gold" as const : "silver" as const,
      matchReason: m.reason,
    }));

    const response: MatchObjectiveResponse = {
      tier: matches[0]?.tier || "bronze",
      matches,
      anchors: [],
    };
    return NextResponse.json(response);
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
