import { test, expect } from "@playwright/test";

test.describe("Batch 3: Auth pages & guards", () => {
  test("21. /login page renders email input", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
  });

  test("22. /login page renders password input", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#password")).toBeVisible();
  });

  test("23. /login page renders Log In button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Log In/i })).toBeVisible();
  });

  test("24. /login page has link to Sign Up", async ({ page }) => {
    await page.goto("/login");
    const signupLink = page.getByRole("link", { name: /Sign Up/i });
    await expect(signupLink).toBeVisible();
  });

  test("25. /signup page renders email and password inputs", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("26. /signup page renders Sign Up button", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: /Sign Up/i })).toBeVisible();
  });

  test("27. /signup page has link to Log In", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("link", { name: /Log In/i })).toBeVisible();
  });

  test("28. /dashboard redirects unauthenticated to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("29. /progress redirects unauthenticated to /login", async ({ page }) => {
    await page.goto("/progress");
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("30. /assessment legacy route redirects away from /calendar", async ({ page }) => {
    await page.goto("/assessment");
    await page.waitForURL((url) => !url.pathname.startsWith("/assessment"), { timeout: 10000 });
    expect(page.url()).not.toContain("/calendar");
  });
});
