/**
 * Regenerate all 15 validated objectives through Prompt 1.
 *
 * This script:
 * 1. Reads benchmark exercises and validated objectives from the seed SQL files
 * 2. Calls Claude with PROMPT_1_SYSTEM for each objective
 * 3. Updates both seed SQL files with the AI-generated fields
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/regenerate-objectives.ts
 *
 * Or set the key in .env.local and run:
 *   npx tsx scripts/regenerate-objectives.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ---------- Load env from .env.local if present ----------
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        const val = trimmed.slice(eqIdx + 1);
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const isDryRun = process.argv.includes("--dry-run");
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!isDryRun && (!apiKey || apiKey === "your-anthropic-api-key")) {
  console.error("ERROR: ANTHROPIC_API_KEY not set.");
  console.error("Run with: ANTHROPIC_API_KEY=sk-... npx tsx scripts/regenerate-objectives.ts");
  console.error("Or use --dry-run to validate parsing without API calls.");
  process.exit(1);
}

// Using curl for API calls (Node.js fetch/SDK may be blocked in sandboxed environments)

// ---------- Prompt 1 system prompt (imported inline to avoid path alias issues) ----------
const PROMPT_1_SYSTEM = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "prompts.ts"),
  "utf-8"
).match(/export const PROMPT_1_SYSTEM = `([\s\S]*?)`;/)?.[1] ?? "";

if (!PROMPT_1_SYSTEM) {
  console.error("ERROR: Could not extract PROMPT_1_SYSTEM from src/lib/prompts.ts");
  process.exit(1);
}

// ---------- Types ----------
interface BenchmarkExercise {
  id: string;
  name: string;
  description: string;
  dimension: string;
  tags: string[];
  equipment_required: string[];
  is_gym_reproducible: boolean;
  measurement_type: string;
  measurement_unit: string;
  difficulty_scale: Record<string, string>;
}

interface ValidatedObjective {
  name: string;
  route: string;
  match_aliases: string;
  type: string;
  difficulty: string;
  description: string;
  summit_elevation_ft: number | null;
  total_gain_ft: number | null;
  distance_miles: number | null;
  duration_days: number | null;
  technical_grade: string | null;
  tags: string[];
  recommended_weeks: number;
  // Fields that will be regenerated:
  target_scores: Record<string, number>;
  taglines: Record<string, string>;
  relevance_profiles: Record<string, unknown>;
  graduation_benchmarks: Record<string, unknown[]>;
}

interface EstimateScoresResponse {
  dimensions: {
    cardio: { tagline: string; targetScore: number };
    strength: { tagline: string; targetScore: number };
    climbing_technical: { tagline: string; targetScore: number };
    flexibility: { tagline: string; targetScore: number };
  };
  relevanceProfiles: Record<string, { summary: string; keyComponents: string[]; irrelevantComponents: string[] }>;
  graduationBenchmarks: Record<string, { exerciseId: string; exerciseName: string; graduationTarget: string; whyThisTarget: string }[]>;
}

// ---------- Parse benchmark exercises from seed SQL ----------
function parseBenchmarkExercises(): BenchmarkExercise[] {
  const seedPath = path.join(__dirname, "..", "supabase", "02_run_seed.sql");
  const sql = fs.readFileSync(seedPath, "utf-8");

  const exercises: BenchmarkExercise[] = [];
  // Match each VALUES tuple for benchmark_exercises
  const regex = /\('(b[^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'(\[.*?\])',\s*'\{([^}]*)\}',\s*(true|false),\s*'([^']+)',\s*'([^']+)',\s*'(\{[^}]+\})'\)/g;

  let match;
  while ((match = regex.exec(sql)) !== null) {
    exercises.push({
      id: match[1],
      name: match[2],
      description: match[3],
      dimension: match[4],
      tags: JSON.parse(match[5]),
      equipment_required: match[6] ? match[6].split(",").map((s: string) => s.trim().replace(/"/g, "")).filter(Boolean) : [],
      is_gym_reproducible: match[7] === "true",
      measurement_type: match[8],
      measurement_unit: match[9],
      difficulty_scale: JSON.parse(match[10].replace(/'/g, '"')),
    });
  }

  return exercises;
}

// ---------- Parse validated objectives from seed SQL ----------
interface RawObjective {
  commentLine: string;
  name: string;
  route: string;
  match_aliases: string;
  type: string;
  difficulty: string;
  description: string;
  summit_elevation_ft: string;
  total_gain_ft: string;
  distance_miles: string;
  duration_days: string;
  technical_grade: string;
  tags: string;
  recommended_weeks: string;
  status: string;
  // Original SQL fragments for the 4 AI-generated fields
  target_scores_sql: string;
  taglines_sql: string;
  relevance_profiles_sql: string;
  graduation_benchmarks_sql: string;
  // Full original INSERT statement for replacement
  fullInsert: string;
}

function parseObjectives(filePath: string): RawObjective[] {
  const sql = fs.readFileSync(filePath, "utf-8");
  const objectives: RawObjective[] = [];

  // Split by INSERT INTO validated_objectives
  const inserts = sql.split(/INSERT INTO validated_objectives[^;]*VALUES\s*/);

  for (let i = 1; i < inserts.length; i++) {
    const block = inserts[i];
    // Find the comment line before this INSERT
    const prevBlock = inserts[i - 1];
    const commentMatch = prevBlock.match(/--\s*\d+\.\s*(.+?)(?:\n|$)/g);
    const commentLine = commentMatch ? commentMatch[commentMatch.length - 1].trim() : `-- ${i}. Unknown`;

    // Extract the VALUES tuple - everything up to the closing ");\n" or end
    const valuesMatch = block.match(/^\s*\(([\s\S]*?)\);\s*$/m);
    if (!valuesMatch) continue;

    // We need to parse the SQL values carefully since they contain nested JSON with commas
    const valuesStr = valuesMatch[1];

    // Parse field by field using a state machine
    const fields = parseSqlValues(valuesStr);
    if (fields.length < 18) {
      console.warn(`  Skipping objective #${i}: only parsed ${fields.length} fields`);
      continue;
    }

    objectives.push({
      commentLine,
      name: unquoteSql(fields[0]),
      route: unquoteSql(fields[1]),
      match_aliases: fields[2], // keep as raw SQL (postgres array)
      type: unquoteSql(fields[3]),
      difficulty: unquoteSql(fields[4]),
      description: unquoteSql(fields[5]),
      summit_elevation_ft: fields[6].trim(),
      total_gain_ft: fields[7].trim(),
      distance_miles: fields[8].trim(),
      duration_days: fields[9].trim(),
      technical_grade: unquoteSql(fields[10]),
      tags: fields[11].trim(),
      target_scores_sql: fields[12].trim(),
      taglines_sql: fields[13].trim(),
      relevance_profiles_sql: fields[14].trim(),
      graduation_benchmarks_sql: fields[15].trim(),
      recommended_weeks: fields[16].trim(),
      status: unquoteSql(fields[17]),
      fullInsert: `INSERT INTO validated_objectives (name, route, match_aliases, type, difficulty, description, summit_elevation_ft, total_gain_ft, distance_miles, duration_days, technical_grade, tags, target_scores, taglines, relevance_profiles, graduation_benchmarks, recommended_weeks, status) VALUES\n(${valuesStr});`,
    });
  }

  return objectives;
}

function parseSqlValues(str: string): string[] {
  const fields: string[] = [];
  let current = "";
  let depth = 0; // tracks nested quotes
  let inSingleQuote = false;
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    if (inSingleQuote) {
      if (ch === "'" && str[i + 1] === "'") {
        // Escaped single quote
        current += "''";
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
        current += ch;
        i++;
        continue;
      }
      current += ch;
      i++;
    } else {
      if (ch === "'") {
        inSingleQuote = true;
        current += ch;
        i++;
      } else if (ch === "(" || ch === "{") {
        depth++;
        current += ch;
        i++;
      } else if (ch === ")" || ch === "}") {
        depth--;
        current += ch;
        i++;
      } else if (ch === "," && depth === 0) {
        fields.push(current);
        current = "";
        i++;
      } else if (ch === "\n") {
        current += ch;
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }

  if (current.trim()) {
    fields.push(current);
  }

  return fields;
}

function unquoteSql(s: string): string {
  const trimmed = s.trim();
  if (trimmed === "null") return "";
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

// ---------- Call Claude via curl (Node.js networking may be restricted) ----------
function callClaudeSync(systemPrompt: string, userMessage: string, retries = 3): string {
  const requestBody = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });

  // Write request body to a temp file to avoid shell escaping issues
  const tmpFile = path.join("/tmp", `claude-req-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, requestBody);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = execSync(
        `curl -s --max-time 300 https://api.anthropic.com/v1/messages ` +
        `-H "x-api-key: ${apiKey}" ` +
        `-H "anthropic-version: 2023-06-01" ` +
        `-H "content-type: application/json" ` +
        `-d @${tmpFile}`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 310000 }
      ).toString();

      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}

      const data = JSON.parse(result);
      if (data.error) {
        throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
      if (!textBlock?.text) {
        throw new Error("No text response from Claude");
      }
      return textBlock.text;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (attempt < retries && (errMsg.includes("timeout") || errMsg.includes("timed out") || errMsg.includes("ECONNRESET") || errMsg.includes("529") || errMsg.includes("overloaded"))) {
        const delay = Math.pow(2, attempt) * 2000;
        console.log(`    Retry ${attempt}/${retries} after ${delay / 1000}s...`);
        const start = Date.now();
        while (Date.now() - start < delay) { /* busy wait for sync */ }
        continue;
      }
      try { fs.unlinkSync(tmpFile); } catch {}
      throw err;
    }
  }
  throw new Error("All retries exhausted");
}

function parseClaudeJSON<T>(text: string): T {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

// ---------- Build user message for an objective ----------
function buildUserMessage(obj: RawObjective, benchmarks: BenchmarkExercise[]): string {
  const tags = obj.tags.startsWith("'") ? JSON.parse(unquoteSql(obj.tags)) : JSON.parse(obj.tags);

  return `Objective: ${obj.name}. Route: ${obj.route}. Type: ${obj.type}. Season: N/A. Duration: ${obj.duration_days} day(s). Summit elevation: ${obj.summit_elevation_ft === "null" ? "N/A" : obj.summit_elevation_ft + " ft"}. Total gain: ${obj.total_gain_ft === "null" ? "N/A" : obj.total_gain_ft + " ft"}. Distance: ${obj.distance_miles === "null" ? "N/A" : obj.distance_miles + " miles"}. Technical grade: ${obj.technical_grade || "N/A"}. Additional details: ${obj.description}. Pack weight: N/A. Tags: ${JSON.stringify(tags)}.

Available benchmark exercises: ${JSON.stringify(benchmarks)}`;
}

// ---------- Format JSON for SQL ----------
function jsonToSql(obj: unknown): string {
  const json = JSON.stringify(obj);
  // Escape single quotes for SQL
  return "'" + json.replace(/'/g, "''") + "'";
}

// ---------- Build updated INSERT statement ----------
function buildInsert(obj: RawObjective, result: EstimateScoresResponse): string {
  const targetScores = {
    cardio: result.dimensions.cardio.targetScore,
    strength: result.dimensions.strength.targetScore,
    climbing_technical: result.dimensions.climbing_technical.targetScore,
    flexibility: result.dimensions.flexibility.targetScore,
  };

  const taglines = {
    cardio: result.dimensions.cardio.tagline,
    strength: result.dimensions.strength.tagline,
    climbing_technical: result.dimensions.climbing_technical.tagline,
    flexibility: result.dimensions.flexibility.tagline,
  };

  const elevFt = obj.summit_elevation_ft.trim() === "null" ? "null" : obj.summit_elevation_ft.trim();
  const gainFt = obj.total_gain_ft.trim() === "null" ? "null" : obj.total_gain_ft.trim();
  const distMi = obj.distance_miles.trim() === "null" ? "null" : obj.distance_miles.trim();
  const durDays = obj.duration_days.trim() === "null" ? "null" : obj.duration_days.trim();
  const techGrade = obj.technical_grade ? `'${obj.technical_grade}'` : "null";

  return `INSERT INTO validated_objectives (name, route, match_aliases, type, difficulty, description, summit_elevation_ft, total_gain_ft, distance_miles, duration_days, technical_grade, tags, target_scores, taglines, relevance_profiles, graduation_benchmarks, recommended_weeks, status) VALUES
('${obj.name.replace(/'/g, "''")}', '${obj.route.replace(/'/g, "''")}', ${obj.match_aliases}, '${obj.type}', '${obj.difficulty}', '${obj.description.replace(/'/g, "''")}', ${elevFt}, ${gainFt}, ${distMi}, ${durDays}, ${techGrade}, ${obj.tags},
${jsonToSql(targetScores)},
${jsonToSql(taglines)},
${jsonToSql(result.relevanceProfiles)},
${jsonToSql(result.graduationBenchmarks)},
${obj.recommended_weeks}, '${obj.status}');`;
}

// ---------- Main ----------
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=== Summit Planner: Regenerating Validated Objectives ===");
  if (DRY_RUN) console.log("(DRY RUN — no API calls, just validating parsing)\n");
  else console.log("");

  // Parse benchmarks
  const benchmarks = parseBenchmarkExercises();
  console.log(`Parsed ${benchmarks.length} benchmark exercises from seed SQL`);

  // Parse objectives from 03_run_objectives.sql (primary source)
  const objectivesPath = path.join(__dirname, "..", "supabase", "03_run_objectives.sql");
  const objectives = parseObjectives(objectivesPath);
  console.log(`Parsed ${objectives.length} validated objectives\n`);

  if (objectives.length === 0) {
    console.error("ERROR: No objectives parsed. Check the SQL format.");
    process.exit(1);
  }

  // Process each objective
  const results: { name: string; insert: string; success: boolean; error?: string }[] = [];

  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i];
    console.log(`[${i + 1}/${objectives.length}] Processing: ${obj.name} (${obj.route})...`);

    try {
      const userMessage = buildUserMessage(obj, benchmarks);

      if (DRY_RUN) {
        console.log(`  ✓ Parsed OK (${obj.type}, ${obj.difficulty}, ${obj.recommended_weeks} weeks)`);
        results.push({ name: obj.name, insert: obj.fullInsert, success: true });
        continue;
      }

      const responseText = callClaudeSync(PROMPT_1_SYSTEM, userMessage);
      const parsed = parseClaudeJSON<EstimateScoresResponse>(responseText);

      // Validate response has all dimensions
      const dims = ["cardio", "strength", "climbing_technical", "flexibility"];
      for (const dim of dims) {
        if (!parsed.dimensions[dim as keyof typeof parsed.dimensions]) {
          throw new Error(`Missing dimension: ${dim}`);
        }
        if (!parsed.relevanceProfiles[dim]) {
          throw new Error(`Missing relevance profile: ${dim}`);
        }
        if (!parsed.graduationBenchmarks[dim]) {
          throw new Error(`Missing graduation benchmarks: ${dim}`);
        }
      }

      const insert = buildInsert(obj, parsed);
      results.push({ name: obj.name, insert, success: true });

      // Log summary
      const scores = parsed.dimensions;
      console.log(`  ✓ Scores: C=${scores.cardio.targetScore} S=${scores.strength.targetScore} CT=${scores.climbing_technical.targetScore} F=${scores.flexibility.targetScore}`);
      const benchCounts = dims.map(d => `${d}:${parsed.graduationBenchmarks[d]?.length || 0}`).join(" ");
      console.log(`  ✓ Benchmarks: ${benchCounts}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ FAILED: ${errMsg}`);
      results.push({ name: obj.name, insert: "", success: false, error: errMsg });
    }
  }

  // Summary
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  console.log(`\n=== Results: ${succeeded.length} succeeded, ${failed.length} failed ===`);

  if (failed.length > 0) {
    console.log("\nFailed objectives:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  if (succeeded.length === 0) {
    console.error("\nNo objectives were successfully regenerated. Aborting SQL update.");
    process.exit(1);
  }

  // Write updated SQL files
  console.log("\n--- Writing updated SQL files ---");

  // Build 03_run_objectives.sql
  const objectivesHeader = `-- =============================================
-- SUMMIT PLANNER: VALIDATED OBJECTIVES (15)
-- Run this THIRD in Supabase SQL Editor
-- =============================================\n`;

  let objectivesSql = objectivesHeader;
  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i];
    const result = results.find(r => r.name === obj.name);
    objectivesSql += `\n${obj.commentLine}\n`;
    if (result?.success) {
      objectivesSql += result.insert + "\n";
    } else {
      // Keep original if regeneration failed
      objectivesSql += obj.fullInsert + "\n";
      console.log(`  Keeping original for ${obj.name} (regeneration failed)`);
    }
  }

  fs.writeFileSync(objectivesPath, objectivesSql);
  console.log(`  ✓ Updated ${objectivesPath}`);

  // Build seed.sql (benchmark exercises + objectives)
  const seedPath = path.join(__dirname, "..", "supabase", "seed.sql");
  const seedSql = fs.readFileSync(seedPath, "utf-8");

  // Split seed.sql at the validated objectives section
  const objectivesHeaderMatch = seedSql.match(/-- =+\n-- VALIDATED OBJECTIVES[^\n]*\n-- =+/);
  if (!objectivesHeaderMatch) {
    console.error("  ✗ Could not find VALIDATED OBJECTIVES section in seed.sql");
  } else {
    const headerIdx = seedSql.indexOf(objectivesHeaderMatch[0]);
    const benchmarkSection = seedSql.slice(0, headerIdx);

    let seedObjectivesSql = objectivesHeaderMatch[0] + "\n";
    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i];
      const result = results.find(r => r.name === obj.name);
      seedObjectivesSql += `\n${obj.commentLine}\n`;
      if (result?.success) {
        seedObjectivesSql += result.insert + "\n";
      } else {
        seedObjectivesSql += obj.fullInsert + "\n";
      }
    }

    fs.writeFileSync(seedPath, benchmarkSection + seedObjectivesSql);
    console.log(`  ✓ Updated ${seedPath}`);
  }

  console.log("\nDone! Review the updated SQL files before committing.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
