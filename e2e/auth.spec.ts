import { expect, test } from "@playwright/test";
import { USERS, expectAccessible, expectNoHorizontalOverflow, formAlert, login, loginAs, watchConsole } from "./helpers";

test("sign-in page is accessible and fits the screen", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "login");
  console.assertClean();
});

test("protected pages redirect to sign-in and return afterwards", async ({ page }) => {
  await page.goto("/forms/facilities");
  await expect(page).toHaveURL(/\/login\?next=%2Fforms%2Ffacilities/);
  await page.getByLabel("Email").fill(USERS.sam);
  await page.getByLabel("Password", { exact: true }).fill("e2e-demo-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/forms\/facilities$/);
});

test("wrong credentials get a generic message and disabled accounts can't sign in", async ({ page }) => {
  await login(page, USERS.sam, "not-the-password");
  await expect(formAlert(page)).toHaveText("The email or password is incorrect.");
  await login(page, "nobody@example.com", "not-the-password");
  await expect(formAlert(page)).toHaveText("The email or password is incorrect.");
  await login(page, USERS.riley);
  await expect(formAlert(page)).toContainText("disabled");
});

test("signing out revokes the server session, not just the cookie", async ({ page, context, playwright, baseURL }) => {
  await loginAs(page, USERS.sam);
  const cookie = (await context.cookies()).find((c) => c.name === "sfp_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");

  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Replaying the old cookie no longer works.
  const replay = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `sfp_session=${cookie!.value}` } });
  expect((await replay.get("/api/auth/session")).status()).toBe(401);
  await replay.dispose();
});

test("responses carry security headers", async ({ request }) => {
  const res = await request.get("/login");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["strict-transport-security"]).toContain("max-age=");
});
