import { expect, test, type Page } from "@playwright/test";
import { USERS, expectAccessible, expectNoHorizontalOverflow, formAlert, loginAs, watchConsole } from "./helpers";

const FORM = "/forms/operations/quarterly-operations-review";
const DRAFT_API = "/api/forms/operations/quarterly-operations-review/draft";

async function resetDraft(page: Page) {
  expect((await page.request.delete(DRAFT_API)).ok()).toBe(true);
}

async function savedDraft(page: Page) {
  return (await (await page.request.get(DRAFT_API)).json()).draft as { data: Record<string, unknown> } | null;
}

test.beforeEach(async ({ page }) => {
  await loginAs(page, USERS.taylor);
  await resetDraft(page);
});

test("long form: navigation, progress, manual save and restore", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await page.goto(FORM);
  await expect(page.getByTestId("draft-status")).toHaveText("Drafts save automatically");
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "long-form");

  await page.getByRole("combobox", { name: "Site", exact: true }).selectOption("hub");
  await page.getByLabel("Review lead").fill("Taylor Kim");
  await expect(page.getByTestId("draft-status")).toHaveText("Unsaved changes");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("draft-status")).toContainText("Draft saved");

  await page.reload();
  await expect(page.getByText(/Your saved draft from .* has been restored/)).toBeVisible();
  await expect(page.getByLabel("Review lead")).toHaveValue("Taylor Kim");
  await expect(page.getByRole("combobox", { name: "Site", exact: true })).toHaveValue("hub");
  console.assertClean();
});

test("autosave, and conditional cells inside a table", async ({ page }) => {
  await page.goto(FORM);
  await page.getByRole("radiogroup", { name: "Operational checklist – 1: Status" }).getByRole("radio", { name: "M: Met" }).click();
  // Autosave is debounced: wait for it instead of pressing Save.
  await expect(page.getByTestId("draft-status")).toContainText("Draft saved", { timeout: 10_000 });
  expect((await savedDraft(page))?.data.checklist).toEqual({ safety_walk: { status: "M" } });

  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(formAlert(page)).toContainText("Operational checklist – 1: Add the evidence reference.");
});

test("conflicting edits from two tabs: load the saved version, or keep this page", async ({ page, context }) => {
  await page.goto(FORM);
  const other = await context.newPage();
  await other.goto(FORM);

  await other.getByLabel("Review lead").fill("From the other tab");
  await other.getByRole("button", { name: "Save draft" }).click();
  await expect(other.getByTestId("draft-status")).toContainText("Draft saved");

  await page.getByLabel("Review lead").fill("From this tab");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("This form was saved more recently in another tab or on another device.")).toBeVisible();
  await page.getByRole("button", { name: "Load the saved version" }).click();
  await expect(page.getByLabel("Review lead")).toHaveValue("From the other tab");

  await other.getByLabel("Review lead").fill("Other tab, again");
  await other.getByRole("button", { name: "Save draft" }).click();
  await expect(other.getByTestId("draft-status")).toContainText("Draft saved");
  await page.getByLabel("Review lead").fill("Keep mine");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Keep the answers on this page" }).click();
  await expect(page.getByTestId("draft-status")).toContainText("Draft saved");
  expect((await savedDraft(page))?.data.reviewLead).toBe("Keep mine");
  await other.close();
});

test("discarding a draft clears the form, and leaving saves pending edits first", async ({ page }) => {
  await page.goto(FORM);
  await page.getByLabel("Review lead").fill("To be discarded");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("draft-status")).toContainText("Draft saved");
  await page.reload();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard draft and start over" }).click();
  await expect(page.getByLabel("Review lead")).toHaveValue("");
  expect(await savedDraft(page)).toBeNull();

  // Leaving through an in-app link saves the draft before navigating.
  await page.getByLabel("Review lead").fill("Saved on the way out");
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Operations" }).click();
  await expect(page).toHaveURL(/\/forms\/operations$/);
  expect((await savedDraft(page))?.data.reviewLead).toBe("Saved on the way out");
});

test("the long form submits end to end and its draft is removed", async ({ page }) => {
  const console = watchConsole(page);
  await page.goto(FORM);
  await page.getByRole("combobox", { name: "Site", exact: true }).selectOption("main");
  await page.getByRole("combobox", { name: "Quarter", exact: true }).selectOption("Q3");
  await page.getByRole("spinbutton", { name: "Year", exact: true }).fill("2026");
  await page.getByLabel("Review lead").fill("Taylor Kim");
  await page.getByRole("radio", { name: "On track" }).check();
  await page.getByLabel("Summary of the quarter").fill("A steady quarter with no major incidents.");
  await page.getByRole("textbox", { name: "Top three highlights 1 (required)" }).fill("All checks completed on time");
  for (let row = 1; row <= 10; row += 1) {
    await page.getByRole("radiogroup", { name: `Operational checklist – ${row}: Status` }).getByRole("radio", { name: "M: Met" }).click();
    await page.getByRole("textbox", { name: `Operational checklist – ${row}: Evidence reference` }).fill(`EV-${row}`);
  }
  for (let q = 1; q <= 4; q += 1) {
    await page.getByRole("combobox", { name: `Review questions – Q${q}: Rating` }).selectOption("4");
  }
  await page.getByLabel("Open service tickets").fill("12");
  await page.getByLabel("Average resolution time (hours)").fill("18.5");
  await page.getByLabel("Reported incidents").fill("0");
  await page.getByRole("textbox", { name: "Sign-off – Prepared by: Name" }).fill("Taylor Kim");
  await page.getByRole("textbox", { name: "Sign-off – Prepared by: Signature" }).fill("Taylor Kim");
  await page.getByLabel("Sign-off – Prepared by: Date and time").fill("2026-10-01T09:30");
  await page.getByLabel("I confirm this review reflects the records held on site for the quarter.").check();

  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByRole("heading", { name: "Submission received" })).toBeVisible();
  expect(await savedDraft(page)).toBeNull();
  console.assertClean();
});
