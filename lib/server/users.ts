import "server-only";
import { randomUUID } from "node:crypto";
import { canManageUsers } from "@/lib/authz";
import { getDb, nowIso, type DB } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { deleteUserSessions } from "@/lib/server/session-store";
import type { ManagedUser, Role, SessionUser, UserStatus } from "@/lib/types";
import { validateUserInput, type UserFieldErrors, type UserInput } from "@/lib/users/validation";

/**
 * Administrator-only user management. Every function re-checks `canManageUsers`, so it stays safe
 * even if a caller forgets its own guard.
 *
 * The lock-out safeguards (no self-demotion, no self-disable, at least one active administrator,
 * unique emails) are evaluated inside the same IMMEDIATE transaction as the write. Two administrators
 * demoting each other at the same moment therefore cannot both succeed, even across processes.
 */

type UserRow = { id: string; name: string; email: string; role: Role; status: UserStatus; created_at: string; updated_at: string };

export type UserMutationResult =
  | { kind: "ok"; user: ManagedUser }
  | { kind: "invalid"; errors: UserFieldErrors; message?: string }
  | { kind: "not_found" };

export type UserDeleteResult = { kind: "ok" } | { kind: "not_found" } | { kind: "blocked"; message: string };

const LAST_ADMIN_MESSAGE = "At least one active administrator is required.";

function assertAdmin(actor: SessionUser) {
  if (!canManageUsers(actor)) throw new Error("Administrator access required.");
}

function loadUser(db: DB, id: string): ManagedUser | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  if (!row) return null;
  const categoryIds = (db.prepare("SELECT category_id FROM user_categories WHERE user_id = ?").all(id) as Array<{ category_id: string }>).map(
    (r) => r.category_id
  );
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM form_submissions WHERE user_id = ?").get(id) as { count: number };
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryIds: row.role === "user" ? categoryIds : [],
    submissionCount: count,
  };
}

export function listUsers(actor: SessionUser): ManagedUser[] {
  assertAdmin(actor);
  const db = getDb();
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC, name").all() as UserRow[];
  const byUser = new Map<string, string[]>();
  for (const a of db.prepare("SELECT user_id, category_id FROM user_categories").all() as Array<{ user_id: string; category_id: string }>) {
    byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a.category_id]);
  }
  const submissionCounts = new Map(
    (db.prepare("SELECT user_id, COUNT(*) AS count FROM form_submissions GROUP BY user_id").all() as Array<{ user_id: string; count: number }>).map(
      (r) => [r.user_id, r.count]
    )
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryIds: row.role === "user" ? byUser.get(row.id) ?? [] : [],
    submissionCount: submissionCounts.get(row.id) ?? 0,
  }));
}

/** Checks shared by create and update; must run inside the write transaction. */
function conflictErrors(db: DB, value: UserInput, exceptId?: string): UserMutationResult | null {
  const owner = db.prepare("SELECT id FROM users WHERE email = ?").get(value.email) as { id: string } | undefined;
  if (owner && owner.id !== exceptId) return { kind: "invalid", errors: { email: "Another user already uses this email." } };
  if (value.categoryIds.length > 0) {
    const placeholders = value.categoryIds.map(() => "?").join(",");
    const { count } = db
      .prepare(`SELECT COUNT(*) AS count FROM categories WHERE status = 'active' AND id IN (${placeholders})`)
      .get(...value.categoryIds) as { count: number };
    if (count !== value.categoryIds.length) {
      return { kind: "invalid", errors: { categoryIds: "One or more selected categories no longer exist." } };
    }
  }
  return null;
}

function writeCategories(db: DB, userId: string, categoryIds: string[]) {
  const now = nowIso();
  db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(userId);
  const insert = db.prepare("INSERT INTO user_categories (user_id, category_id, created_at) VALUES (?, ?, ?)");
  for (const categoryId of categoryIds) insert.run(userId, categoryId, now);
}

function otherActiveAdministrators(db: DB, exceptId: string) {
  return (
    db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'administrator' AND status = 'active' AND id <> ?").get(exceptId) as {
      count: number;
    }
  ).count;
}

export async function createUser(actor: SessionUser, raw: unknown): Promise<UserMutationResult> {
  assertAdmin(actor);
  const parsed = validateUserInput(raw, "create");
  if (!parsed.ok) return { kind: "invalid", errors: parsed.errors };
  const value = parsed.value;
  // Hash before opening the transaction: scrypt is deliberately slow.
  const passwordHash = await hashPassword(value.password!);

  const db = getDb();
  const id = randomUUID();
  return db
    .transaction((): UserMutationResult => {
      const problem = conflictErrors(db, value);
      if (problem) return problem;
      const now = nowIso();
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, value.name, value.email, passwordHash, value.role, value.status, now, now);
      writeCategories(db, id, value.categoryIds);
      return { kind: "ok", user: loadUser(db, id)! };
    })
    .immediate();
}

export async function updateUser(
  actor: SessionUser,
  id: string,
  raw: unknown,
  options: { currentSessionToken?: string | null } = {}
): Promise<UserMutationResult> {
  assertAdmin(actor);
  const parsed = validateUserInput(raw, "update");
  if (!parsed.ok) return { kind: "invalid", errors: parsed.errors };
  const value = parsed.value;
  const passwordHash = value.password ? await hashPassword(value.password) : null;

  const db = getDb();
  return db
    .transaction((): UserMutationResult => {
      const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
      if (!existing) return { kind: "not_found" };

      const staysActiveAdmin = value.role === "administrator" && value.status === "active";
      if (actor.id === id && !staysActiveAdmin) {
        return { kind: "invalid", errors: {}, message: "You can't remove your own administrator access or disable your own account." };
      }
      const losesAdmin = existing.role === "administrator" && existing.status === "active" && !staysActiveAdmin;
      if (losesAdmin && otherActiveAdministrators(db, id) === 0) return { kind: "invalid", errors: {}, message: LAST_ADMIN_MESSAGE };

      const problem = conflictErrors(db, value, id);
      if (problem) return problem;

      db.prepare(
        `UPDATE users SET name = ?, email = ?, role = ?, status = ?, updated_at = ?, password_hash = COALESCE(?, password_hash)
          WHERE id = ?`
      ).run(value.name, value.email, value.role, value.status, nowIso(), passwordHash, id);
      writeCategories(db, id, value.categoryIds);

      // Role and category changes apply on the next request (permissions are re-read every time).
      // Disabling an account or resetting its password also ends its sessions; an administrator
      // resetting their own password keeps the session they are using.
      if (value.status === "disabled") deleteUserSessions(db, id);
      else if (passwordHash) deleteUserSessions(db, id, actor.id === id ? options.currentSessionToken : null);

      return { kind: "ok", user: loadUser(db, id)! };
    })
    .immediate();
}

/**
 * Permanently remove a user. Their sessions, category assignments and drafts are deleted with them
 * (foreign keys cascade). Refused for your own account, for the last active administrator, and for
 * users with submissions: submissions keep their author, so such accounts are disabled instead.
 */
export function deleteUser(actor: SessionUser, id: string): UserDeleteResult {
  assertAdmin(actor);
  const db = getDb();
  return db
    .transaction((): UserDeleteResult => {
      const row = db.prepare("SELECT id, name, role, status FROM users WHERE id = ?").get(id) as Pick<UserRow, "id" | "name" | "role" | "status"> | undefined;
      if (!row) return { kind: "not_found" };
      if (row.id === actor.id) return { kind: "blocked", message: "You can't remove your own account." };
      if (row.role === "administrator" && row.status === "active" && otherActiveAdministrators(db, id) === 0) {
        return { kind: "blocked", message: LAST_ADMIN_MESSAGE };
      }
      const { count } = db.prepare("SELECT COUNT(*) AS count FROM form_submissions WHERE user_id = ?").get(id) as { count: number };
      if (count > 0) {
        return {
          kind: "blocked",
          message: `${row.name} has ${count} ${count === 1 ? "submission" : "submissions"}, so the account can't be removed without losing who submitted them. Set the account to Disabled instead: they can no longer sign in and the records are kept.`,
        };
      }
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      return { kind: "ok" };
    })
    .immediate();
}
