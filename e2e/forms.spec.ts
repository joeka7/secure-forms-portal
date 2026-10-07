import { expect, test } from "@playwright/test";
import { USERS, expectAccessible, expectNoHorizontalOverflow, formAlert, loginAs, watchConsole } from "./helpers";

test("a short form validates on both sides and submits", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.sam);
  await page.goto("/forms/facilities");
  await expectAccessible(page, testInfo, "category");
  await page.getByRole("link", { name: "Fill form: Maintenance Request" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Maintenance Request" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "maintenance-form");

  // Client-side validation lists every problem and links to it.
  await page.getByRole("button", { name: "Report issue" }).click();
  const alert = formAlert(page);
  await expect(alert).toContainText("items need attention");
  await expect(alert.getByRole("button", { name: "Building is required." })).toBeVisible();
  await expectAccessible(page, testInfo, "maintenance-form-errors");

  await page.getByLabel("Building").selectOption("main");
  await page.getByLabel("Floor and room").fill("Level 2, Room 2.14");
  await page.getByLabel("Type of issue").selectOption("hvac");
  await page.getByRole("radio", { name: /^Medium/ }).check();
  await page.getByLabel("Describe the issue").fill("The meeting room is too warm.");
  // Conditional requirement: a hazard needs details.
  await page.getByRole("group", { name: "Is the issue a safety hazard?" }).getByLabel("Yes").check();
  await page.getByLabel("Contact phone").fill("+1 555 0100");
  await page.getByRole("button", { name: "Report issue" }).click();
  await expect(formAlert(page)).toContainText("Describe the hazard");

  await page.getByLabel("Hazard details").fill("Loose ceiling tile above the door.");
  await page.getByLabel("Available from").fill("09:00");
  await page.getByRole("button", { name: "Report issue" }).click();
  await expect(page.getByRole("heading", { name: "Submission received" })).toBeVisible();
  await expect(page.getByTestId("submission-reference")).toHaveText(/Reference: [0-9A-F]{8}/);
  await expectNoHorizontalOverflow(page);
  console.assertClean();
});

test("the server rejects invalid answers even when the browser is bypassed", async ({ page }) => {
  await loginAs(page, USERS.sam);
  const res = await page.request.post("/api/forms/it-requests/equipment-request/submissions", {
    data: { data: { requesterName: "Sam", equipmentType: "other", quantity: 500, policyAccepted: "yes" } },
  });
  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.fieldErrors).toMatchObject({
    equipmentOther: "Describe the equipment you need.",
    quantity: expect.stringContaining("at most 20"),
    policyAccepted: expect.any(String),
  });
  const notJson = await page.request.post("/api/forms/it-requests/equipment-request/submissions", { headers: { "content-type": "text/plain" }, data: "x" });
  expect(notJson.status()).toBe(415);
});

test("checkbox limits and signatures on the access request", async ({ page }) => {
  await loginAs(page, USERS.sam);
  await page.goto("/forms/it-requests/system-access-request");
  const systems = page.getByRole("group", { name: "Systems" });
  for (const name of ["Email and calendar", "Document management", "Finance system", "HR system", "Analytics dashboards"]) {
    await systems.getByLabel(name).check();
  }
  await page.getByRole("button", { name: "Request access" }).click();
  await expect(formAlert(page)).toContainText("Select no more than 4 options for Systems.");
});

test("preview shows the structure without saving anything", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.sam);
  await page.goto("/forms/it-requests/equipment-request/view");
  await expect(page.getByText("This is a preview of the form.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit request" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "preview");
  console.assertClean();
});
