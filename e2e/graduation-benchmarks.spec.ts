import { test, expect } from "@playwright/test";

/**
 * Draft plan seed data for a Gold-tier objective with graduation benchmarks.
 * Seeded into localStorage under "summit-draft-plan" so the plan page renders
 * in guest/draft mode with all graduation benchmark content available.
 */
const DRAFT_WITH_PLAN = {
  objective: {
    name: "Test Peak",
    type: "hike",
    target_date: "2026-09-01",
    distance_miles: 10,
    elevation_gain_ft: 3000,
    technical_grade: null,
    target_cardio_score: 50,
    target_strength_score: 50,
    target_climbing_score: 25,
    target_flexibility_score: 30,
    current_cardio_score: 30,
    current_strength_score: 30,
    current_climbing_score: 15,
    current_flexibility_score: 20,
    taglines: {
      cardio: "test",
      strength: "test",
      climbing_technical: "test",
      flexibility: "test",
    },
    relevance_profiles: {},
    graduation_benchmarks: {
      cardio: [{ exerciseName: "Zone 2 Run", graduationTarget: "10 miles" }],
      strength: [{ exerciseName: "Step-Up", graduationTarget: "30lb" }],
      climbing_technical: [
        { exerciseName: "Scramble", graduationTarget: "Class 3" },
      ],
      flexibility: [
        { exerciseName: "Squat Hold", graduationTarget: "60s" },
      ],
    },
    climbing_role: null,
    matched_validated_id: null,
    tier: "gold",
  },
  assessment: {
    cardio_score: 30,
    strength_score: 30,
    climbing_score: 15,
    flexibility_score: 20,
    standard_answers: {},
    ai_questions: [],
    ai_answers: {},
    freeform_text: null,
    ai_reasoning: null,
    programming_hints: null,
    climbing_role: null,
    adjusted_targets: null,
    gap_analysis: null,
  },
  plan: {
    weeks: [
      {
        weekNumber: 1,
        weekStartDate: "2026-05-10",
        weekType: "regular",
        totalHoursTarget: 6,
        expectedScores: {
          cardio: 35,
          strength: 35,
          climbing_technical: 18,
          flexibility: 23,
        },
        sessions: [],
      },
    ],
    graduationWorkouts: {
      cardio: [{ exerciseName: "Zone 2 Run", graduationTarget: "10 miles" }],
      strength: [{ exerciseName: "Step-Up", graduationTarget: "30lb" }],
      climbing_technical: [
        { exerciseName: "Scramble", graduationTarget: "Class 3" },
      ],
      flexibility: [
        { exerciseName: "Squat Hold", graduationTarget: "60s" },
      ],
    },
    planSummary: {
      philosophy: "Test philosophy text.",
      weeklyStructure: "",
      equipmentNeeded: [],
      keyExercises: [],
    },
    heroImageUrl: null,
    programmingHints: null,
    gapAnalysis: null,
  },
  createdAt: "2026-05-10T00:00:00.000Z",
};

/**
 * Helper: navigate to /plan with the draft plan seeded in localStorage.
 * Clears any previous "plan-visited-*" keys so first-visit auto-expand logic
 * fires for the philosophy section.
 */
async function seedDraftAndNavigate(page: import("@playwright/test").Page) {
  // Go to a page first so we can set localStorage on the correct origin
  await page.goto("/plan");
  await page.evaluate((data) => {
    // Clear any previous visit flags so auto-expand logic fires fresh
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("plan-visited-")) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem("summit-draft-plan", JSON.stringify(data));
  }, DRAFT_WITH_PLAN);
  // Reload so the DraftPlanProvider reads the freshly seeded data
  await page.reload();
  // Wait for the plan page to render (the objective name appears in the header)
  await expect(
    page.getByText("Test Peak", { exact: false })
  ).toBeVisible({ timeout: 15000 });
}

test.describe("Graduation benchmarks section on /plan", () => {
  test("1. Graduation section exists on plan page with draft plan", async ({
    page,
  }) => {
    await seedDraftAndNavigate(page);
    const heading = page.getByText("Graduation Workouts", { exact: false });
    await expect(heading).toBeVisible();
  });

  test("2. Graduation section is collapsed by default on first visit", async ({
    page,
  }) => {
    await seedDraftAndNavigate(page);
    // The heading button should be visible
    await expect(
      page.getByText("Graduation Workouts", { exact: false })
    ).toBeVisible();
    // But the benchmark content (e.g., "Zone 2 Run") should NOT be visible
    // because the section is collapsed by default
    await expect(
      page.getByText("Zone 2 Run", { exact: false })
    ).not.toBeVisible();
  });

  test("3. Graduation section expands when clicked", async ({ page }) => {
    await seedDraftAndNavigate(page);
    // Click the graduation heading/button to expand
    await page
      .getByText("Graduation Workouts", { exact: false })
      .click();
    // Now benchmark content should be visible
    await expect(
      page.getByText("Zone 2 Run", { exact: false })
    ).toBeVisible();
  });

  test("4. Graduation section collapses when clicked again", async ({
    page,
  }) => {
    await seedDraftAndNavigate(page);
    const toggle = page.getByText("Graduation Workouts", { exact: false });
    // Expand
    await toggle.click();
    await expect(
      page.getByText("Zone 2 Run", { exact: false })
    ).toBeVisible();
    // Collapse
    await toggle.click();
    await expect(
      page.getByText("Zone 2 Run", { exact: false })
    ).not.toBeVisible();
  });

  test("5. Expanded graduation shows CARDIO header", async ({ page }) => {
    await seedDraftAndNavigate(page);
    await page
      .getByText("Graduation Workouts", { exact: false })
      .click();
    // Scope to the graduation section to avoid matching score arc labels elsewhere on page
    const graduationSection = page.locator(".border-gold\\/30").first();
    await expect(
      graduationSection.getByRole("heading", { name: "cardio" })
    ).toBeVisible();
  });

  test("6. Expanded graduation shows STRENGTH header", async ({ page }) => {
    await seedDraftAndNavigate(page);
    await page
      .getByText("Graduation Workouts", { exact: false })
      .click();
    const graduationSection = page.locator(".border-gold\\/30").first();
    await expect(
      graduationSection.getByRole("heading", { name: "strength" })
    ).toBeVisible();
  });

  test("7. Expanded graduation shows CLIMBING / TECHNICAL header", async ({
    page,
  }) => {
    await seedDraftAndNavigate(page);
    await page
      .getByText("Graduation Workouts", { exact: false })
      .click();
    // The code does dim.replace("_", " / ") which turns "climbing_technical" into "climbing / technical"
    await expect(
      page.getByText("climbing / technical", { exact: false })
    ).toBeVisible();
  });

  test("8. Expanded graduation shows FLEXIBILITY header", async ({
    page,
  }) => {
    await seedDraftAndNavigate(page);
    await page
      .getByText("Graduation Workouts", { exact: false })
      .click();
    const graduationSection = page.locator(".border-gold\\/30").first();
    await expect(
      graduationSection.getByRole("heading", { name: "flexibility" })
    ).toBeVisible();
  });

  test("9. Expanded graduation shows benchmark exercise names and targets", async ({
    page,
  }) => {
    await seedDraftAndNavigate(page);
    await page
      .getByText("Graduation Workouts", { exact: false })
      .click();
    // Verify each exercise name and its graduation target appear
    await expect(page.getByText("Zone 2 Run")).toBeVisible();
    await expect(page.getByText("10 miles")).toBeVisible();
    await expect(page.getByText("Step-Up")).toBeVisible();
    await expect(page.getByText("30lb")).toBeVisible();
    await expect(page.getByText("Scramble")).toBeVisible();
    await expect(page.getByText("Class 3")).toBeVisible();
    await expect(page.getByText("Squat Hold")).toBeVisible();
    await expect(page.getByText("60s")).toBeVisible();
  });

  test("10. Philosophy section auto-expands on first visit (still works)", async ({
    page,
  }) => {
    await seedDraftAndNavigate(page);
    // Philosophy should auto-expand on first visit (plan-visited-* key cleared)
    // The philosophy content text should be visible without clicking
    await expect(
      page.getByText("Test philosophy text.", { exact: false })
    ).toBeVisible();
    // Meanwhile graduation should still be collapsed
    await expect(
      page.getByText("Zone 2 Run", { exact: false })
    ).not.toBeVisible();
  });
});
