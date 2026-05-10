import { test, expect } from "@playwright/test";

test.describe("Batch 5: Plan page, nav & misc", () => {
  test("41. /plan loads without errors for unauthenticated user", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/calendar");
  });

  test("42. /plan empty state does not link to /calendar", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");
    const calendarLinks = page.locator('a[href*="/calendar"]');
    expect(await calendarLinks.count()).toBe(0);
  });

  test("43. AppShell shows Plan nav link for unauthenticated users", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");
    // Desktop nav should have "Plan" link
    const planLink = page.getByRole("link", { name: "Plan" });
    await expect(planLink.first()).toBeVisible({ timeout: 5000 });
  });

  test("44. AppShell does not show Dashboard nav for unauthenticated users", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForLoadState("networkidle");
    // Dashboard requires auth — should not be in nav
    const dashLink = page.locator('nav a[href="/dashboard"]');
    expect(await dashLink.count()).toBe(0);
  });

  test("45. Login page navigates to signup via link", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /Sign Up/i }).click();
    await page.waitForURL("**/signup");
    expect(page.url()).toContain("/signup");
  });

  test("46. Signup page navigates to login via link", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: /Log In/i }).click();
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("47. Modal does not navigate away from landing page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.reload();
    const cta = page.getByRole("button", { name: "Plan your summit" });
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await expect(page.getByText("New Objective")).toBeVisible({ timeout: 5000 });
    // URL should still be /
    expect(page.url()).toMatch(/\/$/);
  });

  test("48. Assessment draft page redirects to / when no draft exists", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("summit-draft-plan"));
    await page.goto("/assessment/draft");
    // Should redirect away since there's no draft
    await page.waitForURL((url) => !url.pathname.includes("/assessment"), { timeout: 10000 });
    expect(page.url()).not.toContain("/assessment");
  });

  test("49. Login page email input accepts text", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator("#email");
    await email.fill("test@example.com");
    await expect(email).toHaveValue("test@example.com");
  });

  test("50. Signup page password input has minlength requirement", async ({ page }) => {
    await page.goto("/signup");
    const password = page.locator("#password");
    await expect(password).toBeVisible();
    const minLength = await password.getAttribute("minLength");
    expect(Number(minLength)).toBeGreaterThanOrEqual(6);
  });
});
