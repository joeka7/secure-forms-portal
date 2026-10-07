import { describe, expect, it } from "vitest";
import { canAccessCategory, canAccessForm, canManageUsers, canSubmitForm, canViewSubmissions, isAdministrator } from "@/lib/authz";
import { HOME_PATH, safeRedirectPath } from "@/lib/config";
import type { SessionUser } from "@/lib/types";
import { shouldRefreshOnReturn } from "@/components/shell/useRefreshOnHistoryNavigation";

const base: SessionUser = { id: "u", name: "U", email: "u@example.com", role: "user", status: "active", categoryIds: ["cat-a"] };
const admin: SessionUser = { ...base, role: "administrator", categoryIds: [] };

describe("authorization rules", () => {
  it("gives administrators access to everything", () => {
    expect(isAdministrator(admin)).toBe(true);
    expect(canAccessCategory(admin, "anything")).toBe(true);
    expect(canManageUsers(admin)).toBe(true);
    expect(canViewSubmissions(admin)).toBe(true);
  });

  it("limits users to their assigned categories", () => {
    expect(canAccessCategory(base, "cat-a")).toBe(true);
    expect(canAccessCategory(base, "cat-b")).toBe(false);
    expect(canAccessForm(base, { categoryId: "cat-a" })).toBe(true);
    expect(canSubmitForm(base, { categoryId: "cat-b" })).toBe(false);
    expect(canManageUsers(base)).toBe(false);
    expect(canViewSubmissions(base)).toBe(false);
  });

  it("denies disabled accounts, unknown roles and missing users", () => {
    expect(canAccessCategory({ ...admin, status: "disabled" }, "cat-a")).toBe(false);
    expect(canManageUsers({ ...admin, status: "disabled" })).toBe(false);
    expect(canAccessCategory({ ...base, role: "superuser" as never }, "cat-a")).toBe(false);
    expect(canAccessCategory(null, "cat-a")).toBe(false);
    expect(canViewSubmissions(undefined)).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/forms/it-requests", "/forms/it-requests"],
    ["/submissions?category=facilities", "/submissions?category=facilities"],
    ["/users", "/users"],
  ])("allows %s", (input, expected) => expect(safeRedirectPath(input)).toBe(expected));

  it.each([null, "", "https://evil.example", "//evil.example/forms", "/\\evil.example", "/login", "/api/users", "/formsx", "forms", "/forms\u0000x"])(
    "rejects %j",
    (input) => expect(safeRedirectPath(input)).toBe(HOME_PATH)
  );
});

describe("shouldRefreshOnReturn", () => {
  it.each(["/forms", "/forms/facilities", "/submissions", "/submissions/123e4567-e89b-12d3-a456-426614174000", "/users"])(
    "re-fetches %s after browser back/forward",
    (path) => expect(shouldRefreshOnReturn(path)).toBe(true)
  );

  it.each(["/forms/facilities/maintenance-request", "/forms/facilities/maintenance-request/view", "/login", "/formsx", "/users/extra"])(
    "leaves %s to its own handling",
    (path) => expect(shouldRefreshOnReturn(path)).toBe(false)
  );
});
