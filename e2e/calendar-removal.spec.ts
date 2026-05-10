import { test, expect } from "@playwright/test";

test.describe("Calendar removal — all flows bypass /calendar", () => {
  test("1. /calendar returns 404 (page deleted)", async ({ page }) => {
    const response = await page.goto("/calendar");
    expect(response?.status()).toBe(404);
  });

  test("2. Landing page 'Plan your summit' opens ObjectiveModal inline", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for hydration — the button replaces an invisible placeholder
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();

    // ObjectiveModal should appear as a portal overlay
    const modalOverlay = page.locator("[class*='fixed inset-0']");
    await expect(modalOverlay.first()).toBeVisible({ timeout: 5000 });

    // URL should still be / — no navigation to /calendar
    expect(page.url()).toMatch(/\/$/);
  });

  test("3. Legacy /assessment route redirects away from /calendar", async ({ page }) => {
    await page.goto("/assessment");
    // router.replace("/dashboard") fires, which requires auth and redirects to /login
    await page.waitForURL((url) => !url.pathname.startsWith("/assessment"), {
      timeout: 10000,
    });
    expect(page.url()).not.toContain("/calendar");
  });

  test("4. /plan empty state CTA links to /dashboard, not /calendar", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");

    // Look for "Start Planning" link — only shows for guests with no objective
    const startLink = page.getByRole("link", { name: /Start Planning/i });
    if (await startLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await startLink.getAttribute("href");
      expect(href).toContain("/dashboard");
      expect(href).not.toContain("/calendar");
    }

    // Regardless of state, we should never be on /calendar
    expect(page.url()).not.toContain("/calendar");
  });

  test("5. No /calendar links exist anywhere on the landing page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    // Wait for full hydration
    await page.getByRole("button", { name: "Plan your summit" }).waitFor({ timeout: 10000 });

    const calendarLinks = page.locator('a[href*="/calendar"]');
    const count = await calendarLinks.count();
    expect(count).toBe(0);
  });
});
