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
 * Only works against local Supabase.
 */
function getAdminClient() {
  assertLocalSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for test user management."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Create a test user via the Supabase admin API with email pre-confirmed.
 * Returns credentials that Playwright can use to sign in.
 */
export async function createTestUser(
  email?: string,
  password?: string
): Promise<TestUser> {
  assertLocalSupabase();
  const adminClient = getAdminClient();

  const testEmail = email || `test-${Date.now()}@summit-test.local`;
  const testPassword = password || "TestPassword123!";

  const { data, error } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }
  if (!data.user) {
    throw new Error("Failed to create test user: no user returned");
  }

  return {
    id: data.user.id,
    email: testEmail,
    password: testPassword,
  };
}

/**
 * Delete a test user via the Supabase admin API.
 * Cascading deletes in the DB schema will clean up related data.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  assertLocalSupabase();
  const adminClient = getAdminClient();

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete test user ${userId}: ${error.message}`);
  }
}

/**
 * Check if a user exists via the admin API.
 */
export async function userExists(userId: string): Promise<boolean> {
  assertLocalSupabase();
  const adminClient = getAdminClient();

  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error) return false;
  return !!data.user;
}
