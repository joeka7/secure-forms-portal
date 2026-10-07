import { expect, test } from "@playwright/test";
import { USERS, expectAccessible, expectNoHorizontalOverflow, isMobile, loginAs, watchConsole } from "./helpers";

test("a user sees only assigned categories and no administrator areas", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.sam);
  const cards = page.getByRole("main").getByRole("link", { name: /View forms/ });
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole("main")).toContainText("IT Requests");
  await expect(page.getByRole("main")).toContainText("Facilities");
  await expect(page.getByRole("main")).not.toContainText("Operations");

  if (isMobile(testInfo)) await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("navigation", { name: "Main" }).last();
  await expect(nav.getByRole("link", { name: "Forms" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Submissions" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
  if (isMobile(testInfo)) await page.getByRole("button", { name: "Close navigation" }).click();

  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "forms-home-user");
  console.assertClean();
});

test("hidden pages are refused by the server, not just hidden", async ({ page }) => {
  await loginAs(page, USERS.sam);
  for (const path of ["/submissions", "/users", "/forms/operations", "/forms/operations/incident-report", "/forms/does-not-exist"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  }
  expect((await page.request.get("/api/submissions")).status()).toBe(403);
  expect((await page.request.get("/api/users")).status()).toBe(403);
  expect((await page.request.get("/api/forms/operations")).status()).toBe(403);
  const create = await page.request.post("/api/users", { data: { name: "Mallory", email: "m@example.com", role: "administrator", password: "long-enough-password" } });
  expect(create.status()).toBe(403);
  const submit = await page.request.post("/api/forms/operations/incident-report/submissions", { data: { data: {} } });
  expect(submit.status()).toBe(403);
});

test("search filters the catalog to permitted forms", async ({ page }) => {
  await loginAs(page, USERS.sam);
  await page.getByLabel("Search forms and categories").fill("access");
  await expect(page.getByRole("link", { name: /System Access Request/ })).toBeVisible();
  await page.getByLabel("Search forms and categories").fill("incident");
  await expect(page.getByText("No results")).toBeVisible();
});
