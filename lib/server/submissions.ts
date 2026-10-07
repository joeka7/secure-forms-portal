import "server-only";
import { randomUUID } from "node:crypto";
import { canSubmitForm, canViewSubmissions } from "@/lib/authz";
import type { FormSchema, ValidationErrors } from "@/lib/forms/types";
import { validateSubmission } from "@/lib/forms/validation";
import { getFormForUser } from "@/lib/server/catalog";
import { getDb, nowIso } from "@/lib/server/db";
import { EMPTY_FILTERS, parseSubmissionFilters, type SubmissionFilterOptions, type SubmissionFilters } from "@/lib/submissions/filters";
import { zonedDayEndExclusiveUtc, zonedDayStartUtc } from "@/lib/time";
import type { SessionUser, SubmissionDetail, SubmissionSummary } from "@/lib/types";

export type SubmissionResult =
  | { kind: "ok"; id: string; submittedAt: string }
  | { kind: "denied" }
  | { kind: "not_found" }
  | { kind: "invalid"; errors: ValidationErrors };

/**
 * Validate and store a submission. Authorization goes through the same scoped lookup the form page
 * uses; the payload is validated against the form's current registered schema; identity, category
 * and timestamp come from the server, never from the request. The record is stored and the user's
 * draft of the form removed in one transaction.
 */
export function submitForm(user: SessionUser, categorySlug: string, formSlug: string, payload: unknown): SubmissionResult {
  const result = getFormForUser(user, categorySlug, formSlug);
  if (result.kind !== "ok") return result;
  const { form, category } = result;
  if (!canSubmitForm(user, form)) return { kind: "denied" };

  const validation = validateSubmission(form.schema, payload);
  if (!validation.ok) return { kind: "invalid", errors: validation.errors };

  const db = getDb();
  const id = randomUUID();
  const submittedAt = nowIso();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO form_submissions (id, form_id, form_version, category_id, user_id, data, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, form.id, form.version, category.id, user.id, JSON.stringify(validation.data), submittedAt);
    db.prepare("DELETE FROM form_drafts WHERE user_id = ? AND form_id = ?").run(user.id, form.id);
  })();
  return { kind: "ok", id, submittedAt };
}

// ---- administrator views

type SubmissionRow = {
  id: string;
  submitted_at: string;
  user_id: string;
  user_name: string;
  user_email: string;
  form_id: string;
  form_name: string;
  form_slug: string;
  category_id: string;
  category_name: string;
  category_slug: string;
};

const SUBMISSION_COLUMNS = `
  s.id, s.submitted_at,
  u.id AS user_id, u.name AS user_name, u.email AS user_email,
  f.id AS form_id, f.name AS form_name, f.slug AS form_slug,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug`;

// Inner joins are safe: submissions reference users, forms and categories with ON DELETE RESTRICT.
const SUBMISSION_JOINS = `
  FROM form_submissions s
  JOIN users u ON u.id = s.user_id
  JOIN forms f ON f.id = s.form_id
  JOIN categories c ON c.id = s.category_id`;

const toSummary = (r: SubmissionRow): SubmissionSummary => ({
  id: r.id,
  submittedAt: r.submitted_at,
  person: { id: r.user_id, name: r.user_name, email: r.user_email },
  form: { id: r.form_id, name: r.form_name, slug: r.form_slug },
  category: { id: r.category_id, name: r.category_name, slug: r.category_slug },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminSubmissionsResult =
  | {
      kind: "ok";
      /** Submissions matching every filter, newest first. */
      submissions: SubmissionSummary[];
      /** Stored submissions before filtering. */
      total: number;
      filters: SubmissionFilters;
      options: SubmissionFilterOptions;
    }
  | { kind: "denied" }
  /** A filter names a person, category or form that does not exist. */
  | { kind: "not_found" };

/**
 * Stored submissions, newest first, without answers, narrowed by the filters in one query (AND).
 * Administrators only: this role check backs up the route guards. Date filters are whole days in
 * the display time zone, compared with the stored UTC timestamps (ISO strings sort chronologically).
 */
export function listSubmissionsForAdmin(user: SessionUser, rawFilters: SubmissionFilters, timeZone: string): AdminSubmissionsResult {
  if (!canViewSubmissions(user)) return { kind: "denied" };
  const filters = parseSubmissionFilters((key) => (rawFilters ?? EMPTY_FILTERS)[key]);
  const db = getDb();

  const where: string[] = [];
  const params: string[] = [];
  if (filters.person) {
    if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(filters.person)) return { kind: "not_found" };
    where.push("s.user_id = ?");
    params.push(filters.person);
  }
  if (filters.category) {
    const category = db.prepare("SELECT id FROM categories WHERE slug = ?").get(filters.category) as { id: string } | undefined;
    if (!category) return { kind: "not_found" };
    where.push("s.category_id = ?");
    params.push(category.id);
  }
  if (filters.form) {
    if (!db.prepare("SELECT 1 FROM forms WHERE id = ?").get(filters.form)) return { kind: "not_found" };
    where.push("s.form_id = ?");
    params.push(filters.form);
  }
  if (filters.from) {
    where.push("s.submitted_at >= ?");
    params.push(zonedDayStartUtc(filters.from, timeZone));
  }
  if (filters.to) {
    where.push("s.submitted_at < ?");
    params.push(zonedDayEndExclusiveUtc(filters.to, timeZone));
  }

  const rows = db
    .prepare(`SELECT ${SUBMISSION_COLUMNS} ${SUBMISSION_JOINS} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY s.submitted_at DESC, s.rowid DESC`)
    .all(...params) as SubmissionRow[];
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM form_submissions").get() as { total: number };

  const people = db
    .prepare(
      `SELECT u.id, u.name, u.email FROM users u
        WHERE EXISTS (SELECT 1 FROM form_submissions s WHERE s.user_id = u.id)
        ORDER BY u.name COLLATE NOCASE`
    )
    .all() as SubmissionFilterOptions["people"];
  // Active catalog entries, plus retired ones that still have submissions.
  const categories = db
    .prepare(
      `SELECT c.id, c.name, c.slug FROM categories c
        WHERE c.status = 'active' OR EXISTS (SELECT 1 FROM form_submissions s WHERE s.category_id = c.id)
        ORDER BY c.sort_order, c.name`
    )
    .all() as SubmissionFilterOptions["categories"];
  const forms = db
    .prepare(
      `SELECT f.id, f.name, c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug
         FROM forms f JOIN categories c ON c.id = f.category_id
        WHERE f.status = 'active' OR EXISTS (SELECT 1 FROM form_submissions s WHERE s.form_id = f.id)
        ORDER BY c.sort_order, f.sort_order, f.name`
    )
    .all() as SubmissionFilterOptions["forms"];

  return { kind: "ok", submissions: rows.map(toSummary), total, filters, options: { people, categories, forms } };
}

export type AdminSubmissionResult = { kind: "ok"; submission: SubmissionDetail } | { kind: "denied" } | { kind: "not_found" };

/**
 * One stored submission with its answers and the form version it was submitted against.
 * Administrators only; the role is checked before the id is looked up, so other users cannot learn
 * whether an id exists.
 */
export function getSubmissionForAdmin(user: SessionUser, submissionId: string): AdminSubmissionResult {
  if (!canViewSubmissions(user)) return { kind: "denied" };
  if (typeof submissionId !== "string" || !UUID_RE.test(submissionId)) return { kind: "not_found" };
  const row = getDb()
    .prepare(
      `SELECT ${SUBMISSION_COLUMNS}, s.data, s.form_version, f.current_version, v.schema
         ${SUBMISSION_JOINS}
         JOIN form_versions v ON v.form_id = s.form_id AND v.version = s.form_version
        WHERE s.id = ?`
    )
    .get(submissionId) as (SubmissionRow & { data: string; form_version: number; current_version: number; schema: string }) | undefined;
  if (!row) return { kind: "not_found" };
  return {
    kind: "ok",
    submission: {
      ...toSummary(row),
      data: JSON.parse(row.data) as Record<string, unknown>,
      schema: JSON.parse(row.schema) as FormSchema,
      formVersion: row.form_version,
      isLatestVersion: row.form_version === row.current_version,
    },
  };
}
