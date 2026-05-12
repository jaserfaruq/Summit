import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

// ---------------------------------------------------------------------------
// Fixture data — read from the same JSON files the test-mode bypass serves
// ---------------------------------------------------------------------------
import assessScoreFixture from "./fixtures/prompts/assess-score-mont-blanc.json";

const INITIAL_SCORES = assessScoreFixture.scores;
// Follow-mode adjusted targets (written to the objective by score-assessment API)
const ADJUSTED_TARGETS = assessScoreFixture.adjustedTargets;

// Target date: exactly 26 weeks from today → deterministic totalWeeks
const TOTAL_WEEKS = 26;
const TARGET_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + TOTAL_WEEKS * 7);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
})();

// Expected scores after completing week 1 with one cardio session rated 3
// Formula: expectedAtWeek1 = round(current + (target - current) * (1 / totalWeeks))
//          expectedGain    = expectedAtWeek1 - current
//          newScore        = round(current + expectedGain * 1.0)
// Dimensions with no sessions logged get -1 regression (flat, not formula-driven)
function expectedScoreAfterWeek1(
  current: number,
  target: number,
  hasSession: boolean,
): number {
  if (!hasSession) {
    return Math.max(0, current - 1);
  }
  const expectedAtWeek1 = Math.round(
    current + (target - current) * (1 / TOTAL_WEEKS),
  );
  const expectedGain = expectedAtWeek1 - current;
  return Math.round(current + expectedGain * 1.0);
}

const EXPECTED_CARDIO = expectedScoreAfterWeek1(
  INITIAL_SCORES.cardio,
  ADJUSTED_TARGETS.cardio,
  true,
);
const EXPECTED_STRENGTH = expectedScoreAfterWeek1(
  INITIAL_SCORES.strength,
  ADJUSTED_TARGETS.strength,
  false,
);
const EXPECTED_CLIMBING = expectedScoreAfterWeek1(
  INITIAL_SCORES.climbing_technical,
  ADJUSTED_TARGETS.climbing_technical,
  false,
);
const EXPECTED_FLEXIBILITY = expectedScoreAfterWeek1(
  INITIAL_SCORES.flexibility,
  ADJUSTED_TARGETS.flexibility,
  false,
);

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

let testUser: TestUser;

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  testUser = await createTestUser();

  // Login via the real UI form
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByTestId("login-email").fill(testUser.email);
  await page.getByTestId("login-password").fill(testUser.password);
  await expect(page.getByTestId("login-submit")).toBeEnabled();
  await Promise.all([
    page.waitForURL("**/dashboard**", { timeout: 20_000 }),
    page.getByTestId("login-submit").click(),
  ]);

  // Fresh user with no objectives → lands on onboarding with "Add" CTA
  await expect(
    page.getByTestId("add-objective-button"),
  ).toBeVisible({ timeout: 10_000 });
});

test.afterEach(async () => {
  if (testUser) {
    await deleteTestUser(testUser.id);
  }
});

test("full happy path: search → assessment → plan → log → score verification", async ({
  page,
}) => {
  // -----------------------------------------------------------------------
  // Phase 1: Search & Create Objective
  // -----------------------------------------------------------------------

  // Open the objective modal
  await page.getByTestId("add-objective-button").click();
  await expect(page.getByTestId("objective-modal")).toBeVisible();

  // Choose search mode
  await page.getByTestId("objective-mode-search").click();

  // Type "Mont Blanc" and search
  await page.getByTestId("objective-name-input").fill("Mont Blanc");
  await page.getByTestId("objective-search-button").click();

  // Wait for search results
  await expect(
    page.getByTestId("search-results-list"),
  ).toBeVisible({ timeout: 10_000 });

  // Assert all 3 results visible
  await expect(page.getByTestId("search-result-0")).toBeVisible();
  await expect(page.getByTestId("search-result-1")).toBeVisible();
  await expect(page.getByTestId("search-result-2")).toBeVisible();

  // Click the first result (Gold tier Mont Blanc Goûter from pre-match)
  await page.getByTestId("search-result-0").click();

  // Confirm step: set target date and save
  await page.getByTestId("objective-confirm-date").fill(TARGET_DATE);
  await page.getByTestId("objective-confirm-button").click();

  // -----------------------------------------------------------------------
  // Phase 2: Assessment Layer 1 — Standard Questions
  // -----------------------------------------------------------------------

  await expect(
    page.getByTestId("assessment-heading"),
  ).toBeVisible({ timeout: 10_000 });

  // Training days
  await page.getByTestId("assessment-training-days").selectOption("5");

  // Cardio: hike mode
  await page.getByTestId("assessment-cardio-mode-hike").click();
  await page.getByTestId("assessment-hike-distance").fill("12");
  await page.getByTestId("assessment-hike-duration").fill("4.5");
  await page.getByTestId("assessment-hike-elevation").fill("2000");

  // Strength
  await page
    .getByTestId("assessment-strength-frequency")
    .selectOption("1-2x/week");

  // Pull-up capacity (range input, 1-5, set to 3)
  await page.getByTestId("assessment-pullup-scale").fill("3");

  // Loaded leg capacity (range input, 1-5, set to 3)
  await page.getByTestId("assessment-loaded-leg-scale").fill("3");

  // Climbing
  await page
    .getByTestId("assessment-climbing-level")
    .selectOption("beginner");
  // Grade stays at default "none" — no climbing style UI appears

  // Flexibility
  await page.getByTestId("assessment-hip-mobility").fill("3");
  await page.getByTestId("assessment-ankle-mobility").fill("2");

  // Continue to AI questions
  await page.getByTestId("assessment-continue-button").click();

  // -----------------------------------------------------------------------
  // Phase 3: Assessment Layer 2 — AI-Generated Questions
  // -----------------------------------------------------------------------

  // Wait for the first AI question to render (fixture has 5 questions)
  await expect(
    page.getByTestId("assessment-ai-question-0"),
  ).toBeVisible({ timeout: 10_000 });

  // Q1: Lead/Follow dropdown — select "Follow"
  await page
    .getByTestId("assessment-ai-answer-climbing-lead-follow")
    .selectOption("Follow");

  // Q2: Altitude experience (text)
  await page
    .getByTestId("assessment-ai-answer-altitude-experience")
    .fill("Hiked to 14,000ft, mild headache");

  // Q3: Crampon experience (text)
  await page
    .getByTestId("assessment-ai-answer-crampon-experience")
    .fill("No crampon experience");

  // Q4: Multi-day pack (text)
  await page
    .getByTestId("assessment-ai-answer-multi-day-pack")
    .fill("30lb pack for 3 days");

  // Q5: Time on feet (number)
  await page.getByTestId("assessment-ai-answer-time-on-feet").fill("8");

  // Score the assessment
  await page.getByTestId("assessment-score-button").click();

  // -----------------------------------------------------------------------
  // Phase 4: Assessment Results
  // -----------------------------------------------------------------------

  await expect(
    page.getByTestId("assessment-results"),
  ).toBeVisible({ timeout: 10_000 });

  // Verify scores match fixture values
  await expect(page.getByTestId("assessment-score-cardio")).toHaveText(
    String(INITIAL_SCORES.cardio),
  );
  await expect(page.getByTestId("assessment-score-strength")).toHaveText(
    String(INITIAL_SCORES.strength),
  );
  await expect(
    page.getByTestId("assessment-score-climbing_technical"),
  ).toHaveText(String(INITIAL_SCORES.climbing_technical));
  await expect(page.getByTestId("assessment-score-flexibility")).toHaveText(
    String(INITIAL_SCORES.flexibility),
  );

  // Verify climbing role
  await expect(page.getByTestId("assessment-climbing-role")).toContainText(
    /follow/i,
  );

  // Generate plan
  await page.getByTestId("assessment-generate-plan").click();

  // -----------------------------------------------------------------------
  // Phase 5: Plan Page (app redirects straight to /plan after generation)
  // -----------------------------------------------------------------------

  // Plan generation may take a few seconds (generate-plan + redirect)
  await expect(
    page.getByTestId("plan-heading"),
  ).toBeVisible({ timeout: 15_000 });

  // Score arcs visible (mini arcs in plan header)
  await expect(page.getByTestId("score-arc-cardio")).toBeVisible();
  await expect(page.getByTestId("score-arc-strength")).toBeVisible();
  await expect(page.getByTestId("score-arc-climbing")).toBeVisible();
  await expect(page.getByTestId("score-arc-flexibility")).toBeVisible();

  // Week 1 auto-expands and auto-loads sessions on page mount — just wait
  await expect(
    page.getByTestId("plan-session-log-1-0"),
  ).toBeVisible({ timeout: 15_000 });

  // Click "Log" on the first session (cardio)
  await page.getByTestId("plan-session-log-1-0").click();

  // Land on the log page
  await expect(page.getByTestId("log-heading")).toBeVisible();

  // Rate 3 ("Just right") and submit
  await page.getByTestId("log-rating-3").click();
  await page.getByTestId("log-submit").click();

  // Redirect back to plan
  await expect(
    page.getByTestId("plan-heading"),
  ).toBeVisible({ timeout: 10_000 });

  // Wait for week 1 to show the complete button (session must show as logged first)
  await page.getByTestId("plan-complete-week-1").click();

  // Wait for score results to appear
  await expect(
    page.getByTestId("plan-score-result-cardio"),
  ).toBeVisible({ timeout: 15_000 });

  // -----------------------------------------------------------------------
  // Phase 7: Score Verification
  // -----------------------------------------------------------------------

  // Cardio: had a logged session rated 3 → full expected gain
  const cardioText = await page
    .getByTestId("plan-score-result-cardio")
    .textContent();
  const actualCardio = parseInt(cardioText!, 10);
  expect(actualCardio).toBe(EXPECTED_CARDIO);

  // Strength: no sessions → -1 regression
  const strengthText = await page
    .getByTestId("plan-score-result-strength")
    .textContent();
  const actualStrength = parseInt(strengthText!, 10);
  expect(actualStrength).toBe(EXPECTED_STRENGTH);

  // Climbing: no sessions → -1 regression
  const climbingText = await page
    .getByTestId("plan-score-result-climbing_technical")
    .textContent();
  const actualClimbing = parseInt(climbingText!, 10);
  expect(actualClimbing).toBe(EXPECTED_CLIMBING);

  // Flexibility: no sessions → -1 regression
  const flexibilityText = await page
    .getByTestId("plan-score-result-flexibility")
    .textContent();
  const actualFlexibility = parseInt(flexibilityText!, 10);
  expect(actualFlexibility).toBe(EXPECTED_FLEXIBILITY);

  // Sanity: cardio must have increased, others must have decreased
  expect(actualCardio).toBeGreaterThan(INITIAL_SCORES.cardio);
  expect(actualStrength).toBeLessThan(INITIAL_SCORES.strength);
  expect(actualClimbing).toBeLessThan(INITIAL_SCORES.climbing_technical);
  expect(actualFlexibility).toBeLessThan(INITIAL_SCORES.flexibility);
});
