import "server-only";
import { canSubmitForm } from "@/lib/authz";
import type { SubmissionData } from "@/lib/forms/types";
import { sanitizeDraft } from "@/lib/forms/validation";
import { getFormForUser } from "@/lib/server/catalog";
import { getDb, nowIso } from "@/lib/server/db";
import type { SessionUser } from "@/lib/types";

/**
 * Server-side drafts of partially completed forms: at most one per user and form, stored as JSON.
 * Access goes through the same scoped lookup as the form page, and stored data is reduced to the
 * values the form defines (`sanitizeDraft`), so a draft can never hold arbitrary data.
 *
 * Saves use optimistic concurrency: the client sends the version it started from
 * (`baseUpdatedAt`), and a save based on an outdated version is refused with "conflict" instead of
 * silently overwriting newer work from another tab or device.
 */

export type Draft = { data: SubmissionData; updatedAt: string };

export type DraftResult =
  | { kind: "ok"; draft: Draft | null }
  /** The stored draft changed since the version the client edited; it is returned so the client can choose. */
  | { kind: "conflict"; draft: Draft | null }
  | { kind: "denied" }
  | { kind: "not_found" };

function resolveForm(user: SessionUser, categorySlug: string, formSlug: string) {
  const result = getFormForUser(user, categorySlug, formSlug);
  if (result.kind !== "ok") return result;
  if (!canSubmitForm(user, result.form)) return { kind: "denied" as const };
  return result;
}

export function getDraft(user: SessionUser, categorySlug: string, formSlug: string): DraftResult {
  const result = resolveForm(user, categorySlug, formSlug);
  if (result.kind !== "ok") return result;
  const row = getDb().prepare("SELECT data, updated_at FROM form_drafts WHERE user_id = ? AND form_id = ?").get(user.id, result.form.id) as
    | { data: string; updated_at: string }
    | undefined;
  if (!row) return { kind: "ok", draft: null };
  // Re-sanitised against the current schema in case the form changed since the draft was saved.
  return { kind: "ok", draft: { data: sanitizeDraft(result.form.schema, JSON.parse(row.data)), updatedAt: row.updated_at } };
}

/**
 * Save the caller's draft. `baseUpdatedAt` is the draft version the client started from (null: no
 * draft yet); `undefined` skips the check (an explicit "keep my answers" overwrite).
 */
export function saveDraft(user: SessionUser, categorySlug: string, formSlug: string, payload: unknown, baseUpdatedAt?: string | null): DraftResult {
  const result = resolveForm(user, categorySlug, formSlug);
  if (result.kind !== "ok") return result;
  const { schema, id: formId } = result.form;
  const data = sanitizeDraft(schema, payload);
  const db = getDb();
  return db
    .transaction((): DraftResult => {
      const current = db.prepare("SELECT data, updated_at FROM form_drafts WHERE user_id = ? AND form_id = ?").get(user.id, formId) as
        | { data: string; updated_at: string }
        | undefined;
      if (baseUpdatedAt !== undefined && (current?.updated_at ?? null) !== baseUpdatedAt) {
        return { kind: "conflict", draft: current ? { data: sanitizeDraft(schema, JSON.parse(current.data)), updatedAt: current.updated_at } : null };
      }
      // Strictly increasing versions, so two saves within the same millisecond stay distinguishable.
      let updatedAt = nowIso();
      if (current && updatedAt <= current.updated_at) updatedAt = new Date(Date.parse(current.updated_at) + 1).toISOString();
      db.prepare(
        `INSERT INTO form_drafts (user_id, form_id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, form_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).run(user.id, formId, JSON.stringify(data), updatedAt);
      return { kind: "ok", draft: { data, updatedAt } };
    })
    .immediate();
}

export function deleteDraft(user: SessionUser, categorySlug: string, formSlug: string): DraftResult {
  const result = resolveForm(user, categorySlug, formSlug);
  if (result.kind !== "ok") return result;
  getDb().prepare("DELETE FROM form_drafts WHERE user_id = ? AND form_id = ?").run(user.id, result.form.id);
  return { kind: "ok", draft: null };
}
