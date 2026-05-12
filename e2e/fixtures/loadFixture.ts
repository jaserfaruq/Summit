import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "prompts");

/**
 * Load a JSON fixture from e2e/fixtures/prompts/<name>.json.
 * Used by claude.ts in test mode (SUMMIT_TEST_MODE=1) to return
 * deterministic AI responses without making real API calls.
 *
 * Throws a loud error if the fixture is missing — never silently
 * falls through to a real Claude call.
 */
export function loadFixture<T>(name: string): T {
  const filePath = path.join(FIXTURES_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[SUMMIT_TEST_MODE] Fixture not found: ${filePath}\n` +
        `Test mode is ON but no fixture exists for "${name}". ` +
        `This would fall through to a real Claude API call, which is not allowed in test mode.\n` +
        `Create the fixture at: e2e/fixtures/prompts/${name}.json`
    );
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Map from prompt system text (first ~80 chars) to fixture name.
 * This lets claude.ts identify which fixture to load based on
 * the system prompt being used.
 */
const PROMPT_FIXTURE_MAP: Record<string, string> = {
  // P1: estimate-scores (PROMPT_1_SYSTEM)
  "You are an expert mountain athletics coach who assesses the physical demands":
    "p1-mont-blanc",
  // ASSESS-Q: generate-assessment-questions (PROMPT_ASSESS_Q_SYSTEM)
  "You are an expert mountain athletics coach assessing an athlete":
    "assess-q-mont-blanc",
  // ASSESS-SCORE: score-assessment (PROMPT_ASSESS_SCORE_SYSTEM)
  "You are an expert mountain athletics coach scoring an athlete":
    "assess-score-mont-blanc",
  // P2B: generate-week-sessions (PROMPT_2B_SYSTEM)
  "You are an expert mountain athletics coach who designs session-level":
    "p2b-mont-blanc",
  // PHILOSOPHY: generate-plan philosophy (PROMPT_PHILOSOPHY_SYSTEM)
  "You are an expert mountain athletics coach writing a brief training philosophy":
    "philosophy-mont-blanc",
  // SEARCH: match-objective search mode (PROMPT_SEARCH_SYSTEM)
  "You are an expert mountaineering and outdoor athletics guide":
    "search-mont-blanc",
  // 3B: complete-week relevance evaluation (PROMPT_3B_SYSTEM)
  "You are evaluating whether an athlete":
    "3b-mont-blanc",
  // REPORT: weekly report (PROMPT_REPORT_SYSTEM)
  "You are a mountain athletics coach writing a weekly training report":
    "report-mont-blanc",
  // P6: alternatives (PROMPT_6_SYSTEM)
  "You are an expert mountain athletics coach generating alternative":
    "alternatives-mont-blanc",
  // RESCALE: difficulty adjustment (PROMPT_RESCALE_BENCHMARKS_SYSTEM)
  "You are an expert mountain athletics coach rescaling graduation benchmarks":
    "rescale-mont-blanc",
  // P5: find routes (PROMPT_5_SYSTEM)
  "Find 3":
    "find-routes-mont-blanc",
};

/**
 * Resolve a fixture name from a system prompt string.
 * Matches by checking if the system prompt starts with a known prefix.
 * Returns null if no match (caller should throw).
 */
export function resolveFixtureName(systemPrompt: string): string | null {
  for (const [prefix, fixtureName] of Object.entries(PROMPT_FIXTURE_MAP)) {
    if (systemPrompt.startsWith(prefix)) {
      return fixtureName;
    }
  }
  return null;
}
