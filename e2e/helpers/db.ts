import { createClient } from "@supabase/supabase-js";

/**
 * Safety check: refuse to run test helpers against non-local Supabase.
 * This is non-negotiable — every function must call this before doing anything.
 */
function assertLocalSupabase(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (
    !url.startsWith("http://localhost:") &&
    !url.startsWith("http://127.0.0.1:")
  ) {
    throw new Error(
      `Refusing to run test helpers against non-local Supabase.\n` +
        `NEXT_PUBLIC_SUPABASE_URL = "${url}"\n` +
        `Expected http://localhost:* or http://127.0.0.1:*\n` +
        `Make sure .env.test.local is loaded and points to local Supabase.`
    );
  }
}

/**
 * Create a Supabase admin client using the service role key.
 */
function getAdminClient() {
  assertLocalSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for database operations."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Tables that contain user data and should be truncated between tests.
 * Order matters: truncate children before parents to respect FK constraints.
 */
const USER_DATA_TABLES = [
  "component_feedback",
  "workout_logs",
  "weekly_targets",
  "training_plans",
  "score_history",
  "assessments",
  "objectives",
  "profiles",
] as const;

/**
 * Tables that contain seed/reference data and should NOT be truncated.
 */
const SEED_TABLES = ["validated_objectives", "benchmark_exercises"] as const;

/**
 * Reset the local database to a clean state for e2e testing.
 *
 * - Truncates all user-data tables (in FK-safe order)
 * - Deletes all auth.users via admin API
 * - Preserves seed tables (validated_objectives, benchmark_exercises)
 *
 * SAFETY: Refuses to run against non-local Supabase.
 */
export async function resetDatabase(): Promise<void> {
  assertLocalSupabase();
  const adminClient = getAdminClient();

  // Truncate user data tables using SQL for FK-safe cascade
  // Using a single TRUNCATE with CASCADE handles FK ordering for us
  const tableList = USER_DATA_TABLES.join(", ");
  const { error: truncError } = await adminClient.rpc("exec_sql", {
    sql: `TRUNCATE TABLE ${tableList} CASCADE;`,
  });

  // If the RPC doesn't exist, fall back to deleting row by row
  if (truncError) {
    // Fall back: delete from each table in order (children first)
    for (const table of USER_DATA_TABLES) {
      const { error } = await adminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.warn(`Warning: failed to clear ${table}: ${error.message}`);
      }
    }
  }

  // Also delete all auth.users so profiles trigger doesn't leave orphans
  const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.warn(`Warning: failed to list auth users: ${listError.message}`);
  } else if (users?.users) {
    for (const user of users.users) {
      const { error: delError } = await adminClient.auth.admin.deleteUser(user.id);
      if (delError) {
        console.warn(`Warning: failed to delete auth user ${user.id}: ${delError.message}`);
      }
    }
  }
}

/**
 * Verify that user data tables are empty (for test assertions).
 */
export async function verifyTablesEmpty(): Promise<{ table: string; count: number }[]> {
  assertLocalSupabase();
  const adminClient = getAdminClient();
  const nonEmpty: { table: string; count: number }[] = [];

  for (const table of USER_DATA_TABLES) {
    const { count, error } = await adminClient
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      nonEmpty.push({ table, count: -1 });
    } else if (count && count > 0) {
      nonEmpty.push({ table, count });
    }
  }

  return nonEmpty;
}

/**
 * Verify that seed tables have data (for test assertions).
 */
export async function verifySeedTablesIntact(): Promise<{ table: string; count: number }[]> {
  assertLocalSupabase();
  const adminClient = getAdminClient();
  const results: { table: string; count: number }[] = [];

  for (const table of SEED_TABLES) {
    const { count, error } = await adminClient
      .from(table)
      .select("*", { count: "exact", head: true });
    results.push({
      table,
      count: error ? -1 : (count || 0),
    });
  }

  return results;
}
