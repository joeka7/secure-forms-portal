import { expect, test, type Page } from "@playwright/test";
import { USERS, expectAccessible, expectNoHorizontalOverflow, formAlert, isMobile, login, loginAs, navigate, watchConsole } from "./helpers";

async function signOut(page: Page) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test("submissions: search, filters, sorting and detail view", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.admin);
  await page.goto("/submissions");
  const count = page.getByTestId("result-count");
  await expect(count).toHaveText(/^\d+ submissions$/);
  const total = Number((await count.textContent())!.split(" ")[0]);
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "submissions");

  // Search narrows in the browser.
  await page.getByLabel("Search submissions by person, form or category").fill("Taylor");
  await expect(count).toHaveText(new RegExp(`^\\d+ of ${total} submissions$`));
  await page.getByLabel("Search submissions by person, form or category").fill("");

  if (isMobile(testInfo)) await page.getByRole("button", { name: "Filters", exact: true }).click();
  // Category filter runs on the server through the URL.
  await page.getByLabel("Category", { exact: true }).selectOption("human-resources");
  await expect(page).toHaveURL(/category=human-resources/);
  await expect(count).toHaveText(new RegExp(`^1 of ${total} submissions$`));

  // AND semantics: a person who has no HR submissions gives no results.
  await page.getByRole("combobox", { name: "Person" }).click();
  await page.getByRole("combobox", { name: "Person" }).fill("Sam");
  await page.getByRole("option", { name: /Sam Patel/ }).click();
  await expect(page).toHaveURL(/person=/);
  await expect(page.getByText("No submissions match your filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/submissions$/);

  // Date range in the display time zone.
  await page.getByLabel("From", { exact: true }).fill("2099-01-01");
  await expect(page).toHaveURL(/from=2099-01-01/);
  await expect(page.getByText("No submissions match your filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(count).toHaveText(`${total} submissions`);

  // Sorting.
  if (isMobile(testInfo)) {
    await page.getByLabel("Sort by").selectOption("person:asc");
  } else {
    await page.getByRole("button", { name: "Person" }).click();
  }
  const firstView = page.getByRole("link", { name: /^View submission:/ }).first();
  await expect(firstView).toHaveAccessibleName(/by Jordan Reyes$/);

  // Detail view renders answers with the stored form version.
  await page.getByLabel("Search submissions by person, form or category").fill("Quarterly");
  // Ties keep newest first, so the last match is the seeded review (other tests may add newer ones).
  await page.getByRole("link", { name: /^View submission: Quarterly Operations Review by Taylor Kim/ }).last().click();
  await expect(page.getByRole("heading", { name: "Submission details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Submitted answers" })).toBeVisible();
  await expect(page.getByText("Version 1 (current)")).toBeVisible();
  await expect(page.getByText("ACT-01").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "submission-detail");
  console.assertClean();
});

test("users: search, filters, create with a generated password, disable and remove", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  const email = `new.${testInfo.project.name}.${Date.now()}@example.com`;
  await loginAs(page, USERS.admin);
  await page.goto("/users");
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, testInfo, "users");

  const count = page.getByTestId("user-count");
  await page.getByLabel("Search users by name or email").fill("sam");
  await expect(count).toHaveText(/^1 of \d+ users$/);
  await page.getByLabel("Search users by name or email").fill("");
  await page.getByLabel("Filter by status").selectOption("disabled");
  await expect(page.getByRole("main")).toContainText("Riley Chen");
  await page.getByLabel("Filter by status").selectOption("all");

  // Create a user with a generated password.
  await page.getByRole("button", { name: "Add user" }).click();
  const dialog = page.getByRole("dialog", { name: "Add user" });
  await expect(dialog).toBeVisible();
  await expectAccessible(page, testInfo, "user-dialog");
  await dialog.getByLabel("Name").fill("Morgan Lee");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Generate password" }).click();
  const passwordInput = dialog.getByTestId("password-input");
  await expect(passwordInput).toHaveAttribute("type", "text");
  const password = await passwordInput.inputValue();
  expect(password).toHaveLength(18);
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(dialog.getByText("Assign at least one category to this user.")).toBeVisible();
  await dialog.getByLabel("Facilities").check();
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Morgan Lee was added.")).toBeVisible();

  // The new account works with exactly the assigned access.
  await signOut(page);
  await loginAs(page, email.toUpperCase(), password);
  await expect(page.getByRole("main").getByRole("link", { name: /View forms/ })).toHaveCount(1);
  await signOut(page);

  // Disable it: it can no longer sign in.
  await loginAs(page, USERS.admin);
  await page.goto("/users");
  await page.getByLabel("Search users by name or email").fill(email);
  await page.getByRole("button", { name: "Edit Morgan Lee" }).click();
  const edit = page.getByRole("dialog", { name: "Edit user" });
  await edit.getByLabel("Status").selectOption("disabled");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes to Morgan Lee were saved.")).toBeVisible();
  await signOut(page);
  await login(page, email, password);
  await expect(formAlert(page)).toContainText("disabled");

  // Remove it (no submissions), and see that users with submissions can't be removed.
  await loginAs(page, USERS.admin);
  await page.goto("/users");
  await page.getByLabel("Search users by name or email").fill(email);
  await page.getByRole("button", { name: "Remove Morgan Lee" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove user" }).click();
  await expect(page.getByText("Morgan Lee was removed.")).toBeVisible();

  await page.getByLabel("Search users by name or email").fill("riley");
  await page.getByRole("button", { name: "Remove Riley Chen" }).click();
  await expect(page.getByRole("alertdialog", { name: "This user can't be removed" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  console.assertClean();
});

test("an edited user shows its new details at once and after navigating away and back", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.admin);
  // A dedicated user, so other tests keep the demo names they rely on.
  const email = `rename.${testInfo.project.name}.${Date.now()}@example.com`;
  const [category] = (await (await page.request.get("/api/forms")).json()).categories as Array<{ id: string }>;
  const created = await page.request.post("/api/users", {
    data: { name: "Casey Original", email, role: "user", status: "active", categoryIds: [category.id], password: "rename-test-password" },
  });
  expect(created.status()).toBe(201);

  // Arrive by client-side navigation, as a person would.
  await navigate(page, "Users");
  await expect(page).toHaveURL(/\/users$/);
  const search = page.getByLabel("Search users by name or email");
  await search.fill(email);
  await page.getByRole("button", { name: "Edit Casey Original" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit user" });
  await dialog.getByLabel("Name").fill("Casey Renamed");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);

  const main = page.getByRole("main");
  // The page renders a table (desktop) and cards (phones); only one is visible at a time.
  const renamed = main.getByText("Casey Renamed", { exact: true }).locator("visible=true").first();
  await expect(renamed).toBeVisible();
  await expect(main.getByText("Casey Original")).toHaveCount(0);

  // Reopening the dialog shows the saved values.
  await page.getByRole("button", { name: "Edit Casey Renamed" }).click();
  await expect(dialog.getByLabel("Name")).toHaveValue("Casey Renamed");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Leaving and returning through client-side navigation must not show the old name.
  await navigate(page, "Forms");
  await expect(page).toHaveURL(/\/forms$/);
  await navigate(page, "Users");
  await expect(page).toHaveURL(/\/users$/);
  await search.fill(email);
  await expect(renamed).toBeVisible();
  await expect(main.getByText("Casey Original")).toHaveCount(0);

  // Browser back and forward too.
  await page.goBack();
  await expect(page).toHaveURL(/\/forms$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/users$/);
  await search.fill(email);
  await expect(renamed).toBeVisible();
  await expect(main.getByText("Casey Original")).toHaveCount(0);

  // Clean up.
  const users = (await (await page.request.get("/api/users")).json()).users as Array<{ id: string; email: string }>;
  expect((await page.request.delete(`/api/users/${users.find((u) => u.email === email)!.id}`)).ok()).toBe(true);
  console.assertClean();
});

test("administrators can't lock themselves out", async ({ page }) => {
  await loginAs(page, USERS.admin);
  await page.goto("/users");
  await page.getByLabel("Search users by name or email").fill(USERS.admin);
  await expect(page.getByRole("button", { name: "Remove Jordan Reyes" })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Jordan Reyes" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit user" });
  await expect(dialog.getByRole("radio", { name: /^User/ })).toBeDisabled();
  await expect(dialog.getByLabel("Status")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // The server refuses even when the UI is bypassed.
  const users = (await (await page.request.get("/api/users")).json()).users as Array<{ id: string; email: string }>;
  const me = users.find((u) => u.email === USERS.admin)!;
  const res = await page.request.patch(`/api/users/${me.id}`, { data: { name: "Jordan Reyes", email: USERS.admin, role: "user", status: "active", categoryIds: [] } });
  expect(res.status()).toBe(422);
  expect((await page.request.delete(`/api/users/${me.id}`)).status()).toBe(409);
});

test("navigation works on every screen size", async ({ page }, testInfo) => {
  const console = watchConsole(page);
  await loginAs(page, USERS.admin);
  if (isMobile(testInfo)) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await drawer.getByRole("link", { name: "Users" }).click();
    await expect(drawer).toHaveCount(0);
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Users" }).click();
  }
  await expect(page).toHaveURL(/\/users$/);
  for (const path of ["/forms", "/forms/operations", "/forms/operations/incident-report", "/forms/human-resources/leave-request/view"]) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
  await expectAccessible(page, testInfo, "leave-preview");
  console.assertClean();
});
