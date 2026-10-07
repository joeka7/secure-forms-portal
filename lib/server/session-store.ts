import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS } from "@/lib/config";
import type { DB } from "@/lib/server/db";
import type { Role, SessionUser, UserStatus } from "@/lib/types";

/**
 * Database-backed sessions.
 *
 * The browser only holds a random 256-bit token; the database stores its SHA-256 hash, so a leaked
 * database cannot be replayed as cookies. Sessions expire after 12 hours of inactivity and 7 days in
 * total, and can be revoked server-side at any time (logout, disabled account, password reset,
 * removed user). The user's role, status and category assignments are re-read on every request,
 * so permission changes apply immediately.
 */

/** Activity extends a session at most this often, to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_TOKEN_LENGTH = 128;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createSessionRecord(db: DB, userId: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE expires_at <= ? OR created_at <= ?").run(now, now - SESSION_ABSOLUTE_TIMEOUT_MS);
    db.prepare("INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(
      hashToken(token),
      userId,
      now,
      now,
      now + SESSION_IDLE_TIMEOUT_MS
    );
  })();
  return token;
}

type SessionRow = {
  session_id: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  user_id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
};

/** The active user behind a session token, or null. Expired sessions and disabled users are revoked. */
export function resolveSession(db: DB, token: string | undefined, now = Date.now()): SessionUser | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.created_at, s.last_seen_at, s.expires_at,
              u.id AS user_id, u.name, u.email, u.role, u.status
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
    .get(hashToken(token)) as SessionRow | undefined;
  if (!row) return null;

  if (row.expires_at <= now || row.created_at + SESSION_ABSOLUTE_TIMEOUT_MS <= now || row.status !== "active") {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
    return null;
  }

  if (now - row.last_seen_at > TOUCH_INTERVAL_MS) {
    db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?").run(
      now,
      Math.min(now + SESSION_IDLE_TIMEOUT_MS, row.created_at + SESSION_ABSOLUTE_TIMEOUT_MS),
      row.session_id
    );
  }

  const categoryIds =
    row.role === "user"
      ? (
          db
            .prepare(
              `SELECT uc.category_id FROM user_categories uc
                 JOIN categories c ON c.id = uc.category_id
                WHERE uc.user_id = ? AND c.status = 'active'`
            )
            .all(row.user_id) as Array<{ category_id: string }>
        ).map((r) => r.category_id)
      : [];

  return { id: row.user_id, name: row.name, email: row.email, role: row.role, status: row.status, categoryIds };
}

export function deleteSessionByToken(db: DB, token: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
}

/** Revoke every session of a user, optionally keeping the one making the request. */
export function deleteUserSessions(db: DB, userId: string, keepToken?: string | null) {
  if (keepToken) db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, hashToken(keepToken));
  else db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
