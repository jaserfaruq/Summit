import { test, expect } from "@playwright/test";

const DRAFT_OBJECTIVE = {
  objective: {
    name: "Test Mountain", type: "hike", target_date: "2026-09-01",
    distance_miles: 10, elevation_gain_ft: 3000, technical_grade: null,
    target_cardio_score: 50, target_strength_score: 50,
    target_climbing_score: 25, target_flexibility_score: 30,
    current_cardio_score: 0, current_strength_score: 0,
    current_climbing_score: 0, current_flexibility_score: 0,
    taglines: { cardio: "hike strong", strength: "carry heavy", climbing_technical: "scramble safe", flexibility: "move well" },
    relevance_profiles: { cardio: { keyComponents: ["uphill hiking"], irrelevantComponents: [] }, strength: { keyComponents: ["step-ups"], irrelevantComponents: [] }, climbing_technical: { keyComponents: ["scrambling"], irrelevantComponents: [] }, flexibility: { keyComponents: ["hip mobility"], irrelevantComponents: [] } },
    graduation_benchmarks: { cardio: [], strength: [], climbing_technical: [], flexibility: [] },
    climbing_role: null, matched_validated_id: null, tier: "gold",
  },
};

test.describe("Batch 4: Assessment page (guest/draft)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate((d) => localStorage.setItem("summit-draft-plan", JSON.stringify(d)), DRAFT_OBJECTIVE);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
  });

  test("31. Assessment draft page loads with objective name", async ({ page }) => {
    await page.goto("/assessment/draft");
    await expect(page.getByText("Assess for Test Mountain")).toBeVisible({ timeout: 10000 });
  });

  test("32. Assessment shows progress bar with Baseline highlighted", async ({ page }) => {
    await page.goto("/assessment/draft");
    // Progress bar labels — use locator scoped to the progress bar area
    const progressBar = page.locator("text=Baseline >> xpath=..");
    await expect(progressBar.getByText("Baseline", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("span").filter({ hasText: /^Objective-Specific$/ })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Scoring$/ })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Results$/ })).toBeVisible();
  });

  test("33. Assessment shows training days dropdown", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("How many days per week can you train?")).toBeVisible({ timeout: 10000 });
  });

  test("34. Assessment shows Cardio section with mode toggle", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Cardio").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Uphill Push")).toBeVisible();
    await expect(page.getByText("Hike / Trail Run")).toBeVisible();
  });

  test("35. Assessment shows Strength section", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Strength").first()).toBeVisible({ timeout: 10000 });
  });

  test("36. Assessment shows Climbing / Technical section", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Climbing / Technical")).toBeVisible({ timeout: 10000 });
  });

  test("37. Assessment shows Flexibility section", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Flexibility").first()).toBeVisible({ timeout: 10000 });
  });

  test("38. Assessment shows both action buttons at bottom", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Continue to Objective-Specific Questions")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Skip & Build My Plan Now")).toBeVisible();
  });

  test("39. Assessment shows 'or' divider between buttons", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    // The divider has "or" text between the two buttons
    await expect(page.locator("text=or").last()).toBeVisible({ timeout: 10000 });
  });

  test("40. Assessment shows helper text under each button", async ({ page }) => {
    await page.goto("/assessment/draft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/3–5 questions tailored/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/baseline answers only/)).toBeVisible();
  });
});
