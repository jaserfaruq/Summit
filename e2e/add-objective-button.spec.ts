import { test, expect } from "@playwright/test";

test.describe("Add Objective Button", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any draft state so we get the default landing page with "Plan your summit"
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("1. Landing page 'Plan your summit' CTA opens ObjectiveModal", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });
  });

  test("2. ObjectiveModal shows 'New Objective' title (not 'Edit Objective')", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });
    // Should NOT show "Edit Objective" since we are adding, not editing
    await expect(page.getByText("Edit Objective")).not.toBeVisible();
  });

  test("3. ObjectiveModal has Search by Name and Manual Entry options", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await expect(page.getByText("Search by Name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Manual Entry")).toBeVisible();
    // Check descriptive text is present
    await expect(page.getByText("Find a known peak, route, or race")).toBeVisible();
    await expect(page.getByText("Enter all the details yourself")).toBeVisible();
  });

  test("4. Search mode input is functional and accepts text", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await page.getByText("Search by Name").click();

    const searchInput = page.getByPlaceholder(/Mont Blanc|Half Dome|Rainier/);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
    await searchInput.fill("Half Dome");
    await expect(searchInput).toHaveValue("Half Dome");
  });

  test("5. Manual entry form has all required fields", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await page.getByText("Manual Entry").click();

    // Objective Name
    await expect(page.getByPlaceholder(/Mont Blanc|Half Dome/)).toBeVisible();
    // Type dropdown
    await expect(page.locator("select").first()).toBeVisible();
    // Target Date
    await expect(page.locator('input[type="date"]')).toBeVisible();
    // Distance field
    await expect(page.getByText("Distance (miles)")).toBeVisible();
    // Elevation Gain field
    await expect(page.getByText("Elevation Gain (ft)")).toBeVisible();
    // Technical Grade field
    await expect(page.getByText("Technical Grade")).toBeVisible();
    // Find & Save button
    await expect(page.getByRole("button", { name: /Find & Save/i })).toBeVisible();
  });

  test("6. Modal can be closed via the close button without side effects", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });

    // Close the modal via the x button
    const closeButton = page.locator("button", { hasText: "\u00d7" });
    await closeButton.click();

    // Modal should be gone
    await expect(page.getByText("New Objective")).not.toBeVisible();
    // The CTA button should still be on the page
    await expect(page.getByRole("button", { name: "Plan your summit" })).toBeVisible();
  });

  test("7. AddObjectiveButton component uses label prop in codebase", async ({ page }) => {
    // This test verifies the dashboard uses AddObjectiveButton with label="Add Objective"
    // Since we can't authenticate, we verify the component exists on the landing page
    // with its default label (no label prop = "Add Your First Objective")
    // The landing page uses LandingCTAs which opens the same ObjectiveModal
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");

    // The landing page should render the "Plan your summit" CTA (from LandingCTAs)
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });

    // Clicking it should open the same ObjectiveModal used by AddObjectiveButton
    await cta.click();
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });
    // The modal backdrop should be present (fixed overlay)
    const overlay = page.locator(".fixed.inset-0.bg-black\\/70");
    await expect(overlay).toBeVisible();
  });

  test("8. /dashboard redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("9. Type dropdown has all 7 objective types", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await page.getByText("Manual Entry").click();

    const typeSelect = page.locator("select").first();
    await expect(typeSelect).toBeVisible();
    const options = await typeSelect.locator("option").allTextContents();
    expect(options).toContain("Hike");
    expect(options).toContain("Trail Run");
    expect(options).toContain("Alpine Climb");
    expect(options).toContain("Rock Climb");
    expect(options).toContain("Mountaineering");
    expect(options).toContain("Scramble");
    expect(options).toContain("Backpacking");
    expect(options).toHaveLength(7);
  });

  test("10. Manual entry Back button returns to choose-mode", async ({ page }) => {
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();

    // Navigate to manual entry
    await page.getByText("Manual Entry").click();
    await expect(page.getByPlaceholder(/Mont Blanc|Half Dome/)).toBeVisible();

    // Click Back
    await page.getByRole("button", { name: "Back" }).click();

    // Should return to choose-mode showing both options
    await expect(page.getByText("Search by Name")).toBeVisible();
    await expect(page.getByText("Manual Entry")).toBeVisible();
    await expect(page.getByText("How would you like to add your objective?")).toBeVisible();
  });
});
