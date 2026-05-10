import { test, expect } from "@playwright/test";

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
      cardio: "t",
      strength: "t",
      climbing_technical: "t",
      flexibility: "t",
    },
    relevance_profiles: {},
    graduation_benchmarks: {
      cardio: [],
      strength: [],
      climbing_technical: [],
      flexibility: [],
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
      cardio: [],
      strength: [],
      climbing_technical: [],
      flexibility: [],
    },
    planSummary: {
      philosophy:
        "Short test philosophy for Test Peak. Priorities: Cardio and Climbing.",
      weeklyStructure: "5 days per week, progressive overload.",
      equipmentNeeded: [],
      keyExercises: [],
    },
    heroImageUrl: null,
    programmingHints: null,
    gapAnalysis: null,
  },
  createdAt: "2026-05-10T00:00:00.000Z",
};

test.describe("Plan philosophy section", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page first so we can set localStorage
    await page.goto("/");
    // Seed the draft plan and clear any prior visit flag so auto-expand fires
    await page.evaluate((draft) => {
      localStorage.setItem("summit-draft-plan", JSON.stringify(draft));
      // Clear any plan-visited key so the philosophy auto-expands
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("plan-visited-")) {
          localStorage.removeItem(key);
        }
      }
    }, DRAFT_WITH_PLAN);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("summit-draft-plan");
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("plan-visited-")) {
          localStorage.removeItem(key);
        }
      }
    });
  });

  test("1. Plan philosophy section exists on plan page with draft", async ({
    page,
  }) => {
    await page.goto("/plan");
    const philosophySection = page.getByText("Plan Philosophy");
    await expect(philosophySection).toBeVisible({ timeout: 15000 });
  });

  test('2. Philosophy section header shows "PLAN PHILOSOPHY"', async ({
    page,
  }) => {
    await page.goto("/plan");
    // The header is rendered as uppercase via CSS (tracking-wider + uppercase class)
    // but the actual text content is "Plan Philosophy"
    const header = page.locator("h3", { hasText: "Plan Philosophy" });
    await expect(header).toBeVisible({ timeout: 15000 });
    // Verify the uppercase styling class is applied
    await expect(header).toHaveClass(/uppercase/);
  });

  test("3. Philosophy text is visible (auto-expanded on first visit)", async ({
    page,
  }) => {
    await page.goto("/plan");
    // Wait for the philosophy section to appear
    await expect(
      page.locator("h3", { hasText: "Plan Philosophy" })
    ).toBeVisible({ timeout: 15000 });
    // The philosophy text should be visible without needing to click
    const philosophyText = page.getByText(
      "Short test philosophy for Test Peak"
    );
    await expect(philosophyText).toBeVisible({ timeout: 5000 });
  });

  test("4. Philosophy content contains the seeded text", async ({ page }) => {
    await page.goto("/plan");
    await expect(
      page.locator("h3", { hasText: "Plan Philosophy" })
    ).toBeVisible({ timeout: 15000 });
    // Check the full philosophy text is present
    await expect(
      page.getByText("Priorities: Cardio and Climbing.")
    ).toBeVisible({ timeout: 5000 });
    // Also verify the weekly structure text is shown inside the philosophy section
    await expect(
      page.getByText("5 days per week, progressive overload.")
    ).toBeVisible({ timeout: 5000 });
  });

  test("5. Philosophy can be collapsed by clicking the header", async ({
    page,
  }) => {
    await page.goto("/plan");
    const header = page.locator("h3", { hasText: "Plan Philosophy" });
    await expect(header).toBeVisible({ timeout: 15000 });
    // Philosophy should be auto-expanded — verify text is visible
    const philosophyText = page.getByText(
      "Short test philosophy for Test Peak"
    );
    await expect(philosophyText).toBeVisible({ timeout: 5000 });
    // Click the parent button to collapse
    const toggleButton = page.locator("button", {
      has: page.locator("h3", { hasText: "Plan Philosophy" }),
    });
    await toggleButton.click();
    // Philosophy text should now be hidden
    await expect(philosophyText).not.toBeVisible({ timeout: 3000 });
  });

  test("6. Philosophy can be re-expanded by clicking again", async ({
    page,
  }) => {
    await page.goto("/plan");
    const toggleButton = page.locator("button", {
      has: page.locator("h3", { hasText: "Plan Philosophy" }),
    });
    await expect(toggleButton).toBeVisible({ timeout: 15000 });
    const philosophyText = page.getByText(
      "Short test philosophy for Test Peak"
    );
    // Auto-expanded — collapse it
    await expect(philosophyText).toBeVisible({ timeout: 5000 });
    await toggleButton.click();
    await expect(philosophyText).not.toBeVisible({ timeout: 3000 });
    // Re-expand it
    await toggleButton.click();
    await expect(philosophyText).toBeVisible({ timeout: 3000 });
  });

  test("7. Philosophy section does not contain graduation workout content", async ({
    page,
  }) => {
    await page.goto("/plan");
    const philosophyButton = page.locator("button", {
      has: page.locator("h3", { hasText: "Plan Philosophy" }),
    });
    await expect(philosophyButton).toBeVisible({ timeout: 15000 });
    // The philosophy card is the immediate parent div wrapping the button
    const philosophyCard = philosophyButton.locator("..");
    await expect(philosophyCard).not.toContainText("Graduation Workouts");
  });

  test('8. Plan page shows objective name "Test Peak"', async ({ page }) => {
    await page.goto("/plan");
    await expect(page.getByText("Test Peak")).toBeVisible({ timeout: 15000 });
  });

  test("9. Plan page does not redirect to /calendar", async ({ page }) => {
    await page.goto("/plan");
    // Wait for page to settle
    await expect(page.getByText("Test Peak")).toBeVisible({ timeout: 15000 });
    // Verify we are still on /plan
    expect(page.url()).toContain("/plan");
    expect(page.url()).not.toContain("/calendar");
  });

  test("10. Philosophy section is separate from graduation section", async ({
    page,
  }) => {
    await page.goto("/plan");
    // Both sections should exist as separate elements
    const philosophyHeader = page.locator("h3", {
      hasText: "Plan Philosophy",
    });
    const graduationHeader = page.locator("h3", {
      hasText: "Graduation Workouts",
    });
    await expect(philosophyHeader).toBeVisible({ timeout: 15000 });
    await expect(graduationHeader).toBeVisible({ timeout: 15000 });
    // They should be in different parent containers (different collapsible cards)
    const philosophyCard = page
      .locator("button", {
        has: page.locator("h3", { hasText: "Plan Philosophy" }),
      })
      .first();
    const graduationCard = page
      .locator("button", {
        has: page.locator("h3", { hasText: "Graduation Workouts" }),
      })
      .first();
    // Both toggle buttons should exist and be distinct elements
    await expect(philosophyCard).toBeVisible();
    await expect(graduationCard).toBeVisible();
    // Verify they are not the same element by checking text content
    await expect(philosophyCard).not.toContainText("Graduation Workouts");
    await expect(graduationCard).not.toContainText("Plan Philosophy");
  });
});
