import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { USERS, loginAs, navigate, watchConsole } from "./helpers";

/**
 * Pages must never show server data that is out of date because Next.js reused a cached copy:
 * neither when returning through the app's own links nor through browser back/forward, and
 * whether the data changed in this session or in someone else's.
 */

const EQUIPMENT = {
  requesterName: "Sam Patel",
  requesterEmail: "sam.patel@example.com",
  department: "operations",
  equipmentType: "monitor",
  quantity: 1,
  neededBy: "2026-12-01",
  justification: "A second screen for the new dispatch desk.",
  policyAccepted: true,
};

/** A separate signed-in browser session: another person, or the same person on another device. */
async function otherSession(browser: Browser, testInfo: TestInfo, email: string, password?: string) {
  // Same device as the test project (desktop or phone).
  const { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent });
  const page = await context.newPage();
  await loginAs(page, email, password);
  return { page, close: () => context.close() };
}

async function submissionCount(page: Page) {
  const text = await page.getByTestId("result-count").textContent();
  return Number(text!.trim().split(" ")[0]);
}

async function categoryIds(page: Page) {
  const categories = (await (await page.request.get("/api/forms")).json()).categories as Array<{ id: string; slug: string }>;
  return Object.fromEntries(categories.map((c) => [c.slug, c.id]));
}

test("submissions: your own new submission shows when you go back to the list", async ({ page }) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.admin);
  await navigate(page, "Submissions");
  await expect(page).toHaveURL(/\/submissions$/);
  const before = await submissionCount(page);

  // Reach the form through the app's links, submit it, then return with browser back.
  await navigate(page, "Forms");
  await page.getByRole("link", { name: /IT Requests/ }).click();
  await page.getByRole("link", { name: "Fill form: Equipment Request" }).click();
  await page.getByLabel("Full name").fill("Jordan Reyes");
  await page.getByLabel("Work email").fill(USERS.admin);
  await page.getByLabel("Department").selectOption("operations");
  await page.getByRole("radio", { name: "Laptop" }).check();
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Needed by").fill("2026-12-01");
  await page.getByLabel("Business justification").fill("Replacement for a laptop with a failing battery.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("heading", { name: "Submission received" })).toBeVisible();

  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/submissions$/);
  await expect(page.getByTestId("result-count")).toHaveText(`${before + 1} submissions`);
  console.assertClean();
});

test("submissions: another person's submission shows when you return by link or by back", async ({ page, browser }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.admin);
  const sam = await otherSession(browser, testInfo, USERS.sam);
  const submit = async () => expect((await sam.page.request.post("/api/forms/it-requests/equipment-request/submissions", { data: { data: EQUIPMENT } })).status()).toBe(201);

  await navigate(page, "Submissions");
  await expect(page).toHaveURL(/\/submissions$/);
  const before = await submissionCount(page);

  await navigate(page, "Forms");
  await expect(page).toHaveURL(/\/forms$/);
  await submit();
  await navigate(page, "Submissions");
  await expect(page.getByTestId("result-count")).toHaveText(`${before + 1} submissions`);

  await navigate(page, "Forms");
  await expect(page).toHaveURL(/\/forms$/);
  await submit();
  await page.goBack();
  await expect(page).toHaveURL(/\/submissions$/);
  await expect(page.getByTestId("result-count")).toHaveText(`${before + 2} submissions`);
  await sam.close();
  console.assertClean();
});

test("users: a change made in another session shows when you return by link or by back", async ({ page, browser }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.admin);
  const email = `elsewhere.${testInfo.project.name}.${Date.now()}@example.com`;
  const categories = await categoryIds(page);
  const created = await page.request.post("/api/users", {
    data: { name: "Robin First", email, role: "user", status: "active", categoryIds: [categories["facilities"]], password: "elsewhere-test-password" },
  });
  expect(created.status()).toBe(201);
  const userId = (await created.json()).user.id as string;
  const otherAdmin = await otherSession(browser, testInfo, USERS.admin);
  const rename = async (name: string) =>
    expect(
      (await otherAdmin.page.request.patch(`/api/users/${userId}`, { data: { name, email, role: "user", status: "active", categoryIds: [categories["facilities"]] } })).status()
    ).toBe(200);
  const shown = (name: string) => page.getByRole("main").getByText(name, { exact: true }).locator("visible=true").first();

  await navigate(page, "Users");
  await expect(shown("Robin First")).toBeVisible();

  await navigate(page, "Forms");
  await expect(page).toHaveURL(/\/forms$/);
  await rename("Robin Second");
  await navigate(page, "Users");
  await expect(shown("Robin Second")).toBeVisible();

  await navigate(page, "Forms");
  await expect(page).toHaveURL(/\/forms$/);
  await rename("Robin Third");
  await page.goBack();
  await expect(page).toHaveURL(/\/users$/);
  await expect(shown("Robin Third")).toBeVisible();

  await otherAdmin.close();
  expect((await page.request.delete(`/api/users/${userId}`)).ok()).toBe(true);
  console.assertClean();
});

test("forms: category access changed by an administrator applies when the user returns by link or by back", async ({ page, browser }, testInfo) => {
  await loginAs(page, USERS.admin);
  const categories = await categoryIds(page);
  const email = `access.${testInfo.project.name}.${Date.now()}@example.com`;
  const password = "access-test-password";
  const created = await page.request.post("/api/users", {
    data: { name: "Quinn Access", email, role: "user", status: "active", categoryIds: [categories["it-requests"], categories["facilities"]], password },
  });
  expect(created.status()).toBe(201);
  const userId = (await created.json()).user.id as string;

  const quinn = await otherSession(browser, testInfo, email, password);
  const console = watchConsole(quinn.page);
  const cards = quinn.page.getByRole("main").getByRole("heading", { level: 3 });
  await expect(cards).toHaveText(["IT Requests", "Facilities"]);
  await quinn.page.getByRole("link", { name: /Facilities/ }).click();
  await expect(quinn.page).toHaveURL(/\/forms\/facilities$/);
  await quinn.page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Forms" }).click();
  await expect(quinn.page).toHaveURL(/\/forms$/);

  // The administrator swaps Facilities for Operations.
  const update = await page.request.patch(`/api/users/${userId}`, {
    data: { name: "Quinn Access", email, role: "user", status: "active", categoryIds: [categories["it-requests"], categories["operations"]] },
  });
  expect(update.status()).toBe(200);

  // Back on the dashboard through the app's links: the new access applies.
  await quinn.page.getByRole("link", { name: /IT Requests/ }).click();
  await expect(quinn.page).toHaveURL(/\/forms\/it-requests$/);
  await quinn.page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Forms" }).click();
  await expect(cards).toHaveText(["IT Requests", "Operations"]);

  // Browser back to the revoked category no longer shows its forms.
  await quinn.page.goBack();
  await quinn.page.goBack();
  await quinn.page.goBack();
  await expect(quinn.page).toHaveURL(/\/forms\/facilities$/);
  await expect(quinn.page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  console.assertClean();
  await quinn.close();
  expect((await page.request.delete(`/api/users/${userId}`)).ok()).toBe(true);
});
