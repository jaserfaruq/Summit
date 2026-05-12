/**
 * Verification script for the Summit e2e test foundation.
 *
 * Checks:
 * 1. SUMMIT_TEST_MODE=1 and localhost URL are set
 * 2. All four fixture files load as valid JSON
 * 3. resetDatabase() empties user tables but preserves seed tables
 * 4. createTestUser() creates a user, userExists() confirms
 * 5. deleteTestUser() removes the user, userExists() confirms
 *
 * Run: npx tsx e2e/verify-foundation.ts
 * (requires .env.test.local to be loaded)
 */

import * as fs from "fs";
import * as path from "path";

// Load .env.test.local manually (same approach as playwright.config.ts — no dotenv dep)
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, "..", ".env.test.local"));

// Set test mode
process.env.SUMMIT_TEST_MODE = "1";

import { loadFixture, resolveFixtureName } from "./fixtures/loadFixture";
import { createTestUser, deleteTestUser, userExists } from "./helpers/auth";
import { resetDatabase, verifyTablesEmpty, verifySeedTablesIntact } from "./helpers/db";

const FIXTURE_NAMES = [
  "assess-q-mont-blanc",
  "assess-score-mont-blanc",
  "p1-mont-blanc",
  "p2b-mont-blanc",
];

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("\n=== Summit E2E Foundation Verification ===\n");

  // Step 1: Environment checks
  console.log("Step 1: Environment checks");
  check("SUMMIT_TEST_MODE is '1'", process.env.SUMMIT_TEST_MODE === "1");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isLocal =
    supabaseUrl.startsWith("http://localhost:") ||
    supabaseUrl.startsWith("http://127.0.0.1:");
  check(
    "NEXT_PUBLIC_SUPABASE_URL is local",
    isLocal,
    `Got: ${supabaseUrl}`
  );

  if (!isLocal) {
    console.log(
      "\n  ABORTING: Non-local Supabase URL detected. Cannot proceed.\n"
    );
    process.exit(1);
  }

  check(
    "SUPABASE_SERVICE_ROLE_KEY is set",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Step 2: Fixture loading
  console.log("\nStep 2: Fixture loading");
  for (const name of FIXTURE_NAMES) {
    try {
      const data = loadFixture(name);
      const isObject = typeof data === "object" && data !== null;
      check(`${name}.json loads as valid JSON`, isObject);
    } catch (err) {
      check(
        `${name}.json loads as valid JSON`,
        false,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Step 2b: Verify fixture name resolution works for the 4 happy-path prompts
  const promptPrefixes = [
    "You are an expert mountain athletics coach who assesses the physical demands",
    "You are an expert mountain athletics coach assessing an athlete",
    "You are an expert mountain athletics coach scoring an athlete",
    "You are an expert mountain athletics coach who designs session-level",
  ];
  const expectedNames = [
    "p1-mont-blanc",
    "assess-q-mont-blanc",
    "assess-score-mont-blanc",
    "p2b-mont-blanc",
  ];
  for (let i = 0; i < promptPrefixes.length; i++) {
    const resolved = resolveFixtureName(promptPrefixes[i]);
    check(
      `Prompt prefix resolves to ${expectedNames[i]}`,
      resolved === expectedNames[i],
      resolved ? `Got: ${resolved}` : "Got: null"
    );
  }

  // Step 3: Database reset
  console.log("\nStep 3: Database reset");
  try {
    await resetDatabase();
    check("resetDatabase() completes without error", true);
  } catch (err) {
    check(
      "resetDatabase() completes without error",
      false,
      err instanceof Error ? err.message : String(err)
    );
    console.log("  ABORTING: Cannot verify database state without reset.\n");
    printSummary();
    process.exit(failed > 0 ? 1 : 0);
  }

  // Verify user tables are empty
  try {
    const nonEmpty = await verifyTablesEmpty();
    check(
      "User data tables are empty after reset",
      nonEmpty.length === 0,
      nonEmpty.length > 0
        ? `Non-empty: ${nonEmpty.map((t) => `${t.table}(${t.count})`).join(", ")}`
        : undefined
    );
  } catch (err) {
    check(
      "User data tables are empty after reset",
      false,
      err instanceof Error ? err.message : String(err)
    );
  }

  // Verify seed tables still have data
  try {
    const seedTables = await verifySeedTablesIntact();
    for (const t of seedTables) {
      check(
        `Seed table ${t.table} has data (${t.count} rows)`,
        t.count > 0,
        t.count <= 0 ? `Got ${t.count} rows` : undefined
      );
    }
  } catch (err) {
    check(
      "Seed tables are intact after reset",
      false,
      err instanceof Error ? err.message : String(err)
    );
  }

  // Step 4: User creation
  console.log("\nStep 4: Test user creation");
  let testUserId: string | null = null;
  try {
    const user = await createTestUser();
    testUserId = user.id;
    check("createTestUser() returns a user", !!user.id && !!user.email);
    check("User email matches expected pattern", user.email.includes("@summit-test.local"));
  } catch (err) {
    check(
      "createTestUser() returns a user",
      false,
      err instanceof Error ? err.message : String(err)
    );
  }

  // Verify user exists
  if (testUserId) {
    try {
      const exists = await userExists(testUserId);
      check("userExists() confirms user was created", exists);
    } catch (err) {
      check(
        "userExists() confirms user was created",
        false,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Step 5: User deletion
  console.log("\nStep 5: Test user deletion");
  if (testUserId) {
    try {
      await deleteTestUser(testUserId);
      check("deleteTestUser() completes without error", true);
    } catch (err) {
      check(
        "deleteTestUser() completes without error",
        false,
        err instanceof Error ? err.message : String(err)
      );
    }

    // Verify user is gone
    try {
      const exists = await userExists(testUserId);
      check("User no longer exists after deletion", !exists);
    } catch (err) {
      check(
        "User no longer exists after deletion",
        false,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Summary
  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log(`\n${"=".repeat(45)}`);
  if (failed === 0) {
    console.log(`All foundation checks passed (${passed}/${passed + failed})`);
  } else {
    console.log(`${failed} check(s) FAILED out of ${passed + failed} total`);
  }
  console.log(`${"=".repeat(45)}\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
