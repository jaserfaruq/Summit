import { PlanSession, SessionEnvironment, MatchResult, MatchType } from "./types";

/**
 * Infers the environment for a session based on keyword matching
 * on session name and exercise descriptions.
 */
export function inferSessionEnvironment(session: PlanSession): SessionEnvironment {
  const searchText = [
    session.name,
    session.objective,
    ...session.training.map((t) => `${t.description} ${t.details}`),
    ...session.warmUp.exercises.map((e) => e.name),
    session.cooldown || "",
  ]
    .join(" ")
    .toLowerCase();

  // 1. Climbing dimension
  if (session.dimension === "climbing_technical") {
    if (/indoor|gym|bouldering\s*gym/.test(searchText)) return "climbing_gym";
    if (/outdoor|crag|multi-pitch|trad|sport\s*climb/.test(searchText)) return "crag";
    return "climbing_gym"; // default for climbing
  }

  // 2. Cardio dimension
  if (session.dimension === "cardio") {
    if (/trail|hike|ruck|outdoor|run(?:ning)?|hill|mountain/.test(searchText)) return "outdoor";
    if (/treadmill|bike|row|stair|elliptical|indoor/.test(searchText)) return "gym";
    return "outdoor"; // default for cardio
  }

  // 3. Strength dimension
  if (session.dimension === "strength") {
    if (/bodyweight\s*only|no\s*equipment|at\s*home/.test(searchText)) return "home";
    return "gym"; // default for strength
  }

  // 4. Flexibility dimension
  return "home"; // default for flexibility
}

/**
 * Finds matches between two users' weekly sessions.
 * Each session appears in at most one match (best match wins).
 */
export function findPartnerMatches(
  userSessions: PlanSession[],
  partnerSessions: PlanSession[]
): MatchResult[] {
  interface CandidateMatch {
    yourIndex: number;
    partnerIndex: number;
    matchType: MatchType;
    matchReason: string;
    priority: number; // higher = better
  }

  const candidates: CandidateMatch[] = [];

  for (let ui = 0; ui < userSessions.length; ui++) {
    const userEnv = inferSessionEnvironment(userSessions[ui]);
    for (let pi = 0; pi < partnerSessions.length; pi++) {
      const partnerEnv = inferSessionEnvironment(partnerSessions[pi]);
      const envMatch = userEnv === partnerEnv;
      const dimMatch = userSessions[ui].dimension === partnerSessions[pi].dimension;

      if (!envMatch && !dimMatch) continue;

      const envLabel = userEnv.replace(/_/g, " ");
      const dimLabel = userSessions[ui].dimension.replace(/_/g, " ");

      let matchType: MatchType;
      let matchReason: string;
      let priority: number;

      if (envMatch && dimMatch) {
        matchType = "both";
        matchReason = `Both doing ${dimLabel} at ${envLabel}`;
        priority = 3;
      } else if (envMatch) {
        matchType = "environment";
        matchReason = `Both at ${envLabel}`;
        priority = 2;
      } else {
        matchType = "dimension";
        matchReason = `Both doing ${dimLabel}`;
        priority = 1;
      }

      candidates.push({
        yourIndex: ui,
        partnerIndex: pi,
        matchType,
        matchReason,
        priority,
      });
    }
  }

  // Sort by priority descending — best matches first
  candidates.sort((a, b) => b.priority - a.priority);

  // Greedy deduplication: each session appears in at most one match
  const usedUser = new Set<number>();
  const usedPartner = new Set<number>();
  const results: MatchResult[] = [];

  for (const c of candidates) {
    if (usedUser.has(c.yourIndex) || usedPartner.has(c.partnerIndex)) continue;
    usedUser.add(c.yourIndex);
    usedPartner.add(c.partnerIndex);

    results.push({
      yourSessionIndex: c.yourIndex,
      yourSessionName: userSessions[c.yourIndex].name,
      partnerSessionIndex: c.partnerIndex,
      partnerSessionName: partnerSessions[c.partnerIndex].name,
      matchType: c.matchType,
      matchReason: c.matchReason,
    });
  }

  return results;
}

/**
 * Generates a human-readable summary string for notifications.
 */
export function generateMatchSummary(
  partnerName: string,
  matches: MatchResult[]
): string {
  if (matches.length === 0) return "";

  if (matches.length === 1) {
    const sessionLabel = matches[0].yourSessionName.split(":")[0].toLowerCase().trim();
    return `${partnerName} also has ${sessionLabel} this week`;
  }

  // Multiple matches — list the dimensions
  const dimSet = new Set(matches.map((m) => {
    const s = m.yourSessionName.split(":")[0].toLowerCase().trim();
    return s;
  }));
  const dims = Array.from(dimSet);

  if (dims.length <= 3) {
    return `${partnerName} has ${matches.length} overlapping sessions this week — ${dims.join(", ")}`;
  }

  return `${partnerName} has ${matches.length} overlapping sessions this week`;
}

/**
 * Determines the strongest match type from a list of matches.
 */
export function strongestMatchType(matches: MatchResult[]): MatchType {
  if (matches.some((m) => m.matchType === "both")) return "both";
  if (matches.some((m) => m.matchType === "environment")) return "environment";
  return "dimension";
}
