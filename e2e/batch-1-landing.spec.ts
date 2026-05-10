import { test, expect } from "@playwright/test";

test.describe("Batch 1: Landing page & navigation", () => {
  test("1. Landing page renders Summit header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toContainText("Summit");
  });

  test("2. Landing page renders hero headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Train for");
    await expect(page.locator("h1")).toContainText("the summit");
  });

  test("3. Landing page renders description text", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toContainText("AI-generated plans");
    await expect(page.locator("main")).toContainText("Half Dome, Mont Blanc, Denali");
  });

  test("4. Landing page shows 'Plan your summit' button when no draft", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
  });

  test("5. Landing page shows Login link", async ({ page }) => {
    await page.goto("/");
    const loginLinks = page.getByRole("link", { name: "Log In" });
    await expect(loginLinks.first()).toBeVisible();
  });

  test("6. Landing page Login link navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for hydration so the CTA section is rendered
    await page.getByRole("button", { name: "Plan your summit" }).waitFor({ timeout: 10000 });

    // Click the login link in the CTA section (second one, first is in header)
    const loginLinks = page.getByRole("link", { name: "Log In" });
    await loginLinks.last().click();
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("7. Landing page shows resume CTA when draft exists", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("summit-draft-plan", JSON.stringify({
        objective: {
          name: "Mock Peak", type: "hike", target_date: "2026-09-01",
          target_cardio_score: 50, target_strength_score: 50,
          target_climbing_score: 25, target_flexibility_score: 30,
          current_cardio_score: 0, current_strength_score: 0,
          current_climbing_score: 0, current_flexibility_score: 0,
          taglines: {}, relevance_profiles: {},
          graduation_benchmarks: { cardio: [], strength: [], climbing_technical: [], flexibility: [] },
          climbing_role: null, matched_validated_id: null, tier: "bronze",
        },
      }));
    });
    await page.reload();
    await expect(page.getByRole("link", { name: /Resume planning for Mock Peak/ })).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
  });

  test("8. Resume CTA links to /assessment/draft", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("summit-draft-plan", JSON.stringify({
        objective: {
          name: "Mock Peak", type: "hike", target_date: "2026-09-01",
          target_cardio_score: 50, target_strength_score: 50,
          target_climbing_score: 25, target_flexibility_score: 30,
          current_cardio_score: 0, current_strength_score: 0,
          current_climbing_score: 0, current_flexibility_score: 0,
          taglines: {}, relevance_profiles: {},
          graduation_benchmarks: { cardio: [], strength: [], climbing_technical: [], flexibility: [] },
          climbing_role: null, matched_validated_id: null, tier: "bronze",
        },
      }));
    });
    await page.reload();
    const resume = page.getByRole("link", { name: /Resume planning/ });
    await expect(resume).toBeVisible({ timeout: 10000 });
    const href = await resume.getAttribute("href");
    expect(href).toBe("/assessment/draft");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
  });

  test("9. No /calendar links on landing page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.getByRole("button", { name: "Plan your summit" }).waitFor({ timeout: 10000 });
    const calendarLinks = page.locator('a[href*="/calendar"]');
    expect(await calendarLinks.count()).toBe(0);
  });

  test("10. /calendar returns 404", async ({ page }) => {
    const response = await page.goto("/calendar");
    expect(response?.status()).toBe(404);
  });
});
