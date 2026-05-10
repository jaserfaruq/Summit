import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("1. Renders hero content, CTA, and login link", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.locator("header")).toContainText("Summit");

    // Hero copy
    await expect(page.locator("h1")).toContainText("Train for");
    await expect(page.locator("main")).toContainText("AI-generated plans");

    // CTA button (not a link — it's a button that opens the modal)
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });

    // Login link exists
    const loginLinks = page.getByRole("link", { name: "Log In" });
    await expect(loginLinks.first()).toBeVisible();
  });

  test("2. Shows 'Resume planning' CTA when draft exists in localStorage", async ({ page }) => {
    await page.goto("/");

    // Seed a draft objective into localStorage
    await page.evaluate(() => {
      const draft = {
        objective: {
          name: "Test Peak",
          type: "hike",
          target_date: "2026-09-01",
          target_cardio_score: 50,
          target_strength_score: 50,
          target_climbing_score: 25,
          target_flexibility_score: 30,
          current_cardio_score: 0,
          current_strength_score: 0,
          current_climbing_score: 0,
          current_flexibility_score: 0,
          taglines: {},
          relevance_profiles: {},
          graduation_benchmarks: { cardio: [], strength: [], climbing_technical: [], flexibility: [] },
          climbing_role: null,
          matched_validated_id: null,
          tier: "bronze",
        },
      };
      localStorage.setItem("summit-draft-plan", JSON.stringify(draft));
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should show resume button instead of "Plan your summit"
    const resume = page.getByRole("link", { name: /Resume planning for Test Peak/ });
    await expect(resume).toBeVisible({ timeout: 10000 });

    // "Plan your summit" button should NOT be visible
    const planButton = page.getByRole("button", { name: "Plan your summit" });
    await expect(planButton).not.toBeVisible();

    // Clean up
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
  });
});

test.describe("ObjectiveModal flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("3. Modal opens with choose-mode step showing Search and Manual options", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();

    // Modal should show the two options
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Search by Name")).toBeVisible();
    await expect(page.getByText("Manual Entry")).toBeVisible();
  });

  test("4. Search mode shows input field and search button", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();

    // Navigate to search step
    await page.getByText("Search by Name").click();

    // Search input and button should appear
    const searchInput = page.getByPlaceholder(/Mont Blanc|Half Dome|Rainier/);
    await expect(searchInput).toBeVisible();

    const searchButton = page.getByRole("button", { name: "Search" });
    await expect(searchButton).toBeVisible();

    // Back button should exist
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  });

  test("5. Manual entry mode shows form fields for objective details", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();

    // Navigate to manual form
    await page.getByText("Manual Entry").click();

    // Form fields should be visible
    const nameInput = page.getByPlaceholder(/Mont Blanc|Half Dome/);
    await expect(nameInput).toBeVisible();

    // Type dropdown
    const typeSelect = page.locator("select").first();
    await expect(typeSelect).toBeVisible();

    // Target date
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // Find & Save button (disabled until required fields filled)
    const saveButton = page.getByRole("button", { name: /Find & Save/i });
    await expect(saveButton).toBeVisible();
  });

  test("6. Modal closes when clicking close/X without navigating away", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();

    // Modal should be open
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });

    // Click the close button (× or overlay)
    const closeButton = page.getByRole("button", { name: "×" }).or(
      page.locator("button:has-text('×')")
    );
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    } else {
      // Click the backdrop overlay to close
      await page.locator("[class*='fixed inset-0']").first().click({ position: { x: 10, y: 10 } });
    }

    // Modal should be gone, still on landing page
    await expect(page.getByText("New Objective")).not.toBeVisible({ timeout: 3000 });
    expect(page.url()).toMatch(/\/$/);
  });
});

test.describe("Auth-guarded pages redirect correctly", () => {
  test("7. /dashboard redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("8. /progress redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/progress");
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Login and Signup pages", () => {
  test("9. Login page shows email/password form and signup link", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Form fields
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    // Submit button
    const loginButton = page.getByRole("button", { name: /Log In/i });
    await expect(loginButton).toBeVisible();

    // Link to signup
    const signupLink = page.getByRole("link", { name: /Sign Up/i });
    await expect(signupLink).toBeVisible();
  });

  test("10. Signup page shows email/password form and login link", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");

    // Form fields
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    // Submit button
    const signupButton = page.getByRole("button", { name: /Sign Up/i });
    await expect(signupButton).toBeVisible();

    // Link to login
    const loginLink = page.getByRole("link", { name: /Log In/i });
    await expect(loginLink).toBeVisible();
  });
});
