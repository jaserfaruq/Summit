import { test, expect } from "@playwright/test";

const DRAFT_OBJECTIVE = {
  objective: {
    name: "Test Peak", type: "hike", target_date: "2026-09-01",
    distance_miles: 10, elevation_gain_ft: 3000, technical_grade: null,
    target_cardio_score: 50, target_strength_score: 50,
    target_climbing_score: 25, target_flexibility_score: 30,
    current_cardio_score: 0, current_strength_score: 0,
    current_climbing_score: 0, current_flexibility_score: 0,
    taglines: { cardio: "t", strength: "t", climbing_technical: "t", flexibility: "t" },
    relevance_profiles: {},
    graduation_benchmarks: { cardio: [], strength: [], climbing_technical: [], flexibility: [] },
    climbing_role: null, matched_validated_id: null, tier: "gold",
  },
};

test.describe("Assessment optional fields copy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      (d) => localStorage.setItem("summit-draft-plan", JSON.stringify(d)),
      DRAFT_OBJECTIVE,
    );
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
  });

  test("1. Optional fields copy is visible on assessment draft page", async ({ page }) => {
    await page.goto("/assessment/draft");
    await expect(
      page.getByText("Answer what you can — all fields are optional. The more you share, the more personalized your plan."),
    ).toBeVisible({ timeout: 10000 });
  });

  test("2. Copy contains 'all fields are optional'", async ({ page }) => {
    await page.goto("/assessment/draft");
    await expect(
      page.getByText("all fields are optional", { exact: false }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("3. Copy contains 'more personalized your plan'", async ({ page }) => {
    await page.goto("/assessment/draft");
    await expect(
      page.getByText("more personalized your plan", { exact: false }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("4. Subtitle 'Answer these baseline questions' is also visible", async ({ page }) => {
    await page.goto("/assessment/draft");
    await expect(
      page.getByText("Answer these baseline questions (~2 minutes)"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("5. Optional copy appears below the subtitle", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");

    const subtitle = page.getByText("Answer these baseline questions (~2 minutes)");
    const optionalCopy = page.getByText("Answer what you can — all fields are optional.");

    await expect(subtitle).toBeVisible({ timeout: 10000 });
    await expect(optionalCopy).toBeVisible();

    // Both live in the header div — optional copy should be positioned below the subtitle
    const subtitleBox = await subtitle.boundingBox();
    const optionalBox = await optionalCopy.boundingBox();
    expect(subtitleBox).toBeTruthy();
    expect(optionalBox).toBeTruthy();
    expect(optionalBox!.y).toBeGreaterThan(subtitleBox!.y);
  });

  test("6. Optional copy is NOT visible outside layer1 phase", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");

    // Confirm we are on layer1 and the copy is visible
    await expect(
      page.getByText("Answer these baseline questions (~2 minutes)"),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Answer what you can — all fields are optional."),
    ).toBeVisible();

    // The URL should still be /assessment/draft (no phase change via URL)
    expect(page.url()).toContain("/assessment/draft");

    // Verify the copy is conditional on phase — the "scoring" and "results"
    // subtitles should NOT be visible while on layer1
    await expect(page.getByText("Analyzing your responses...")).not.toBeVisible();
    await expect(page.getByText("Your assessment results")).not.toBeVisible();
  });

  test("7. Assessment form sections are visible alongside the copy", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");

    // The optional copy is present
    await expect(
      page.getByText("Answer what you can — all fields are optional."),
    ).toBeVisible({ timeout: 10000 });

    // All four dimension sections are rendered alongside it
    await expect(page.getByText("Cardio").first()).toBeVisible();
    await expect(page.getByText("Strength").first()).toBeVisible();
    await expect(page.getByText("Climbing / Technical")).toBeVisible();
    await expect(page.getByText("Flexibility").first()).toBeVisible();
  });

  test("8. The copy does not appear on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("all fields are optional"),
    ).not.toBeVisible();
  });

  test("9. The copy does not appear on the landing page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("all fields are optional"),
    ).not.toBeVisible();
  });

  test("10. Both action buttons are visible below the form with the new copy", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");

    // Optional copy is present
    await expect(
      page.getByText("Answer what you can — all fields are optional."),
    ).toBeVisible({ timeout: 10000 });

    // Both action buttons are still rendered
    await expect(
      page.getByText("Continue to Objective-Specific Questions"),
    ).toBeVisible();
    await expect(
      page.getByText("Skip & Build My Plan Now"),
    ).toBeVisible();
  });
});
