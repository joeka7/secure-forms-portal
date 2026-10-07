import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "@/lib/catalog/demo-catalog";
import type { CatalogCategory } from "@/lib/catalog/types";
import { syncCatalog, type DB } from "@/lib/server/db";
import { deleteDraft, getDraft, saveDraft } from "@/lib/server/drafts";
import { getCategoryForUser, getFormForUser, listAccessibleCategories } from "@/lib/server/catalog";
import { getSubmissionForAdmin, listSubmissionsForAdmin, submitForm } from "@/lib/server/submissions";
import { EMPTY_FILTERS, parseSubmissionFilters } from "@/lib/submissions/filters";
import type { SessionUser } from "@/lib/types";
import { freshDb, insertUser } from "./helpers/db";

let db: DB;
let admin: SessionUser;
let sam: SessionUser;

const maintenance = {
  building: "main",
  room: "2.14",
  issueType: "hvac",
  priority: "medium",
  description: "Too warm.",
  hazard: "no",
  contactPhone: "+1 555 0100",
};

beforeEach(() => {
  db = freshDb();
  admin = insertUser(db, { role: "administrator", name: "Ada Admin" });
  sam = insertUser(db, { name: "Sam User", categories: ["facilities", "it-requests"] });
});

describe("scoped catalog", () => {
  it("shows users only their categories and hides whether others exist", () => {
    expect(listAccessibleCategories(sam).map((c) => c.slug)).toEqual(["it-requests", "facilities"]);
    expect(listAccessibleCategories(admin)).toHaveLength(4);
    expect(getCategoryForUser(sam, "operations").kind).toBe("denied");
    expect(getCategoryForUser(sam, "does-not-exist").kind).toBe("denied");
    expect(getCategoryForUser(admin, "does-not-exist").kind).toBe("not_found");
    expect(getFormForUser(sam, "operations", "incident-report").kind).toBe("denied");
  });
});

describe("submissions", () => {
  it("stores normalised answers with server-side identity and time", () => {
    const before = new Date().toISOString();
    const result = submitForm(sam, "facilities", "maintenance-request", { ...maintenance, userId: admin.id, submittedAt: "1999-01-01T00:00:00Z" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const row = db.prepare("SELECT * FROM form_submissions WHERE id = ?").get(result.id) as Record<string, string>;
    expect(row.user_id).toBe(sam.id);
    expect(row.submitted_at >= before).toBe(true);
    expect(JSON.parse(row.data)).not.toHaveProperty("userId");
    expect(JSON.parse(row.data)).not.toHaveProperty("submittedAt");
  });

  it("rejects invalid answers and forms outside the user's categories", () => {
    expect(submitForm(sam, "facilities", "maintenance-request", { ...maintenance, hazard: "yes" })).toMatchObject({
      kind: "invalid",
      errors: { hazardDetails: expect.stringMatching(/hazard/) },
    });
    expect(submitForm(sam, "operations", "incident-report", {}).kind).toBe("denied");
    expect(submitForm(sam, "facilities", "nope", {}).kind).toBe("not_found");
  });

  it("removes the submitter's draft of that form, and nobody else's", () => {
    const colleague = insertUser(db, { categories: ["facilities"] });
    saveDraft(sam, "facilities", "maintenance-request", { room: "draft" }, null);
    saveDraft(colleague, "facilities", "maintenance-request", { room: "theirs" }, null);
    expect(submitForm(sam, "facilities", "maintenance-request", maintenance).kind).toBe("ok");
    expect(getDraft(sam, "facilities", "maintenance-request")).toEqual({ kind: "ok", draft: null });
    expect(getDraft(colleague, "facilities", "maintenance-request")).toMatchObject({ kind: "ok", draft: { data: { room: "theirs" } } });
  });

  it("lets only administrators list and read submissions, checking the role before the id", () => {
    const result = submitForm(sam, "facilities", "maintenance-request", maintenance);
    if (result.kind !== "ok") throw new Error("setup");
    expect(listSubmissionsForAdmin(sam, EMPTY_FILTERS, "UTC").kind).toBe("denied");
    expect(getSubmissionForAdmin(sam, result.id).kind).toBe("denied");
    expect(getSubmissionForAdmin(sam, "not-a-uuid").kind).toBe("denied");
    const detail = getSubmissionForAdmin(admin, result.id);
    expect(detail).toMatchObject({ kind: "ok", submission: { person: { id: sam.id }, formVersion: 1, isLatestVersion: true } });
  });

  it("filters with AND semantics and whole days in the display time zone", () => {
    const a = submitForm(sam, "facilities", "maintenance-request", maintenance);
    const b = submitForm(admin, "facilities", "maintenance-request", maintenance);
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("setup");
    db.prepare("UPDATE form_submissions SET submitted_at = ? WHERE id = ?").run("2026-03-01T21:30:00.000Z", a.id);
    db.prepare("UPDATE form_submissions SET submitted_at = ? WHERE id = ?").run("2026-03-02T10:00:00.000Z", b.id);

    const list = (raw: Record<string, string>, tz = "UTC") => {
      const result = listSubmissionsForAdmin(admin, parseSubmissionFilters((k) => raw[k]), tz);
      if (result.kind !== "ok") throw new Error(result.kind);
      return result.submissions.map((s) => s.id);
    };
    expect(list({})).toEqual([b.id, a.id]);
    expect(list({ person: sam.id })).toEqual([a.id]);
    expect(list({ person: sam.id, from: "2026-03-02" })).toEqual([]);
    // 21:30 UTC on 1 March is already 2 March in Tokyo (UTC+9).
    expect(list({ from: "2026-03-02", to: "2026-03-02" }, "Asia/Tokyo")).toEqual([b.id, a.id]);
    expect(list({ to: "2026-03-01" }, "UTC")).toEqual([a.id]);
    expect(list({ category: "facilities", from: "not-a-date" })).toHaveLength(2);
    expect(listSubmissionsForAdmin(admin, parseSubmissionFilters((k) => ({ category: "unknown-category" })[k as "category"]), "UTC").kind).toBe("not_found");
  });
});

describe("drafts", () => {
  const args = ["operations", "quarterly-operations-review"] as const;
  let taylor: SessionUser;
  beforeEach(() => {
    taylor = insertUser(db, { categories: ["operations"] });
  });

  it("keeps one sanitised draft per user and form", () => {
    const first = saveDraft(taylor, ...args, { site: "main", injected: "<script>", year: "20x6" }, null);
    expect(first.kind).toBe("ok");
    if (first.kind !== "ok") return;
    expect(first.draft?.data).toMatchObject({ site: "main", year: "20x6" });
    expect(first.draft?.data).not.toHaveProperty("injected");
    const second = saveDraft(taylor, ...args, { site: "hub" }, first.draft!.updatedAt);
    expect(second.kind).toBe("ok");
    expect(db.prepare("SELECT COUNT(*) AS n FROM form_drafts").get()).toEqual({ n: 1 });
  });

  it("detects conflicting saves and allows an explicit overwrite", () => {
    const first = saveDraft(taylor, ...args, { site: "main" }, null);
    if (first.kind !== "ok") throw new Error("setup");
    const base = first.draft!.updatedAt;
    // Another tab saves on top of the same version...
    expect(saveDraft(taylor, ...args, { site: "hub" }, base).kind).toBe("ok");
    // ...so this tab's save from the old version is refused, with the newer draft returned.
    const conflict = saveDraft(taylor, ...args, { site: "annex" }, base);
    expect(conflict).toMatchObject({ kind: "conflict", draft: { data: { site: "hub" } } });
    // Creating a draft when one already exists is a conflict too.
    expect(saveDraft(taylor, ...args, { site: "annex" }, null).kind).toBe("conflict");
    // "Keep the answers on this page": no version check.
    expect(saveDraft(taylor, ...args, { site: "annex" })).toMatchObject({ kind: "ok", draft: { data: { site: "annex" } } });
  });

  it("is private to its owner and to permitted forms", () => {
    saveDraft(taylor, ...args, { site: "main" }, null);
    const colleague = insertUser(db, { categories: ["operations"] });
    expect(getDraft(colleague, ...args)).toEqual({ kind: "ok", draft: null });
    expect(saveDraft(sam, ...args, { site: "main" }, null).kind).toBe("denied");
    expect(deleteDraft(taylor, ...args)).toEqual({ kind: "ok", draft: null });
    expect(getDraft(taylor, ...args)).toEqual({ kind: "ok", draft: null });
  });
});

describe("form versions", () => {
  it("records a new version when a schema changes and keeps submissions on their own version", () => {
    const result = submitForm(sam, "facilities", "maintenance-request", maintenance);
    if (result.kind !== "ok") throw new Error("setup");

    // Re-syncing an unchanged catalog creates no version.
    syncCatalog(db, catalog);
    expect(db.prepare("SELECT COUNT(*) AS n FROM form_versions").get()).toEqual({ n: 6 });

    const changed: CatalogCategory[] = structuredClone(catalog);
    const form = changed.find((c) => c.slug === "facilities")!.forms[0];
    form.schema.sections[0].fields.push({ name: "assetTag", label: "Asset tag", type: "text", required: true });
    syncCatalog(db, changed);

    const current = getFormForUser(sam, "facilities", "maintenance-request");
    expect(current.kind === "ok" && current.form.version).toBe(2);
    // New submissions are validated against version 2...
    expect(submitForm(sam, "facilities", "maintenance-request", maintenance).kind).toBe("invalid");
    // ...while the old submission still renders with the questions it answered.
    const detail = getSubmissionForAdmin(admin, result.id);
    expect(detail).toMatchObject({ kind: "ok", submission: { formVersion: 1, isLatestVersion: false } });
    if (detail.kind === "ok") expect(JSON.stringify(detail.submission.schema)).not.toContain("assetTag");
  });

  it("rejects an invalid catalog before writing anything", () => {
    const broken: CatalogCategory[] = structuredClone(catalog);
    broken[0].name = "Renamed";
    broken[1].forms[0].schema.sections[0].fields.push({ name: "room", label: "Duplicate", type: "text" });
    expect(() => syncCatalog(db, broken)).toThrow(/duplicate field name/);
    expect(db.prepare("SELECT name FROM categories WHERE slug = 'it-requests'").get()).toEqual({ name: "IT Requests" });
  });
});
