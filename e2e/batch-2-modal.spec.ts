import { test, expect } from "@playwright/test";

test.describe("Batch 2: ObjectiveModal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
  });

  test("11. Modal opens with 'New Objective' title", async ({ page }) => {
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });
  });

  test("12. Modal shows Search by Name option", async ({ page }) => {
    await expect(page.getByText("Search by Name")).toBeVisible({ timeout: 5000 });
  });

  test("13. Modal shows Manual Entry option", async ({ page }) => {
    await expect(page.getByText("Manual Entry")).toBeVisible({ timeout: 5000 });
  });

  test("14. Clicking Search by Name shows search input", async ({ page }) => {
    await page.getByText("Search by Name").click();
    await expect(page.getByPlaceholder(/Mont Blanc|Half Dome|Rainier/)).toBeVisible();
  });

  test("15. Search step shows Search button", async ({ page }) => {
    await page.getByText("Search by Name").click();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("16. Search step shows Back button", async ({ page }) => {
    await page.getByText("Search by Name").click();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  });

  test("17. Back button in search returns to choose-mode", async ({ page }) => {
    await page.getByText("Search by Name").click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Search by Name")).toBeVisible();
    await expect(page.getByText("Manual Entry")).toBeVisible();
  });

  test("18. Clicking Manual Entry shows name input", async ({ page }) => {
    await page.getByText("Manual Entry").click();
    await expect(page.getByPlaceholder(/Mont Blanc|Half Dome/)).toBeVisible();
  });

  test("19. Manual entry shows type dropdown", async ({ page }) => {
    await page.getByText("Manual Entry").click();
    const typeSelect = page.locator("select").first();
    await expect(typeSelect).toBeVisible();
    // Should contain objective type options
    const options = await typeSelect.locator("option").allTextContents();
    expect(options).toContain("Hike");
    expect(options).toContain("Mountaineering");
  });

  test("20. Manual entry shows target date and Find & Save button", async ({ page }) => {
    await page.getByText("Manual Entry").click();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Find & Save/i })).toBeVisible();
  });
});
