import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { DEMO_PASSWORD } from "../playwright.config";

export const USERS = {
  admin: "admin@example.com",
  sam: "sam.patel@example.com", // IT Requests + Facilities
  taylor: "taylor.kim@example.com", // Human Resources + Operations
  riley: "riley.chen@example.com", // disabled
};

export { DEMO_PASSWORD };

export async function login(page: Page, email: string, password = DEMO_PASSWORD, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function loginAs(page: Page, email: string, password = DEMO_PASSWORD) {
  await login(page, email, password);
  await expect(page).toHaveURL(/\/forms$/);
}

/** The page's own alerts (Next.js also renders a route announcer with role="alert"). */
export const formAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Fails the test on console errors and uncaught exceptions (e.g. hydration or CSP problems). */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Expected: the browser logs failed requests for deliberate 4xx API checks.
    if (/Failed to load resource: the server responded with a status of (401|403|404|409|422)/.test(text)) return;
    problems.push(text);
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return {
    assertClean: () => expect(problems, problems.join("\n")).toEqual([]),
  };
}

/** No horizontal scrolling at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(0);
}

/** WCAG 2.1 A/AA checks with axe. */
export async function expectAccessible(page: Page, testInfo: TestInfo, label: string) {
  // Let entrance animations (e.g. a dialog fading in) finish, so contrast is measured on the final state.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity)
  );
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`);
  await testInfo.attach(`axe-${label}`, { body: JSON.stringify(results.violations, null, 2), contentType: "application/json" });
  expect(summary, `${label}:\n${summary.join("\n")}`).toEqual([]);
}

export const isMobile = (testInfo: TestInfo) => testInfo.project.name === "mobile";

/** Client-side navigation through the sidebar, or the drawer on phones. */
export async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Main" }).last().getByRole("link", { name: label, exact: true }).click();
}
