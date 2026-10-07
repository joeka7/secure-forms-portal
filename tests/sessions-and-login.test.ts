import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS } from "@/lib/config";
import { MAX_FAILURES_PER_ACCOUNT, MAX_FAILURES_PER_IP, attemptLogin } from "@/lib/server/auth";
import { UNTRUSTED_CLIENT, clientIp } from "@/lib/server/client-ip";
import type { DB } from "@/lib/server/db";
import { MemoryRateLimiter, SqliteRateLimiter } from "@/lib/server/rate-limit";
import { createSessionRecord, deleteSessionByToken, deleteUserSessions, hashToken, resolveSession } from "@/lib/server/session-store";
import { TEST_PASSWORD, categoryId, freshDb, insertUser } from "./helpers/db";

let db: DB;
beforeEach(() => {
  db = freshDb();
});

describe("sessions", () => {
  it("stores only a hash of the token and resolves the user", () => {
    const user = insertUser(db, { categories: ["facilities"] });
    const token = createSessionRecord(db, user.id);
    expect(token.length).toBeGreaterThanOrEqual(43);
    const row = db.prepare("SELECT id FROM sessions").get() as { id: string };
    expect(row.id).toBe(hashToken(token));
    expect(row.id).not.toContain(token);
    expect(resolveSession(db, token)).toMatchObject({ id: user.id, role: "user", categoryIds: [categoryId(db, "facilities")] });
    expect(resolveSession(db, "forged-token")).toBeNull();
  });

  it("expires after 12 hours idle and 7 days in total", () => {
    const user = insertUser(db);
    const start = Date.now();
    const idle = createSessionRecord(db, user.id, start);
    expect(resolveSession(db, idle, start + SESSION_IDLE_TIMEOUT_MS + 1)).toBeNull();

    // Activity extends the idle window, but never beyond the absolute lifetime.
    const active = createSessionRecord(db, user.id, start);
    let now = start;
    while (now < start + SESSION_ABSOLUTE_TIMEOUT_MS - SESSION_IDLE_TIMEOUT_MS) {
      now += SESSION_IDLE_TIMEOUT_MS - 60_000;
      expect(resolveSession(db, active, now)).not.toBeNull();
    }
    expect(resolveSession(db, active, start + SESSION_ABSOLUTE_TIMEOUT_MS + 1)).toBeNull();
  });

  it("re-reads status, role and categories on every request", () => {
    const user = insertUser(db, { categories: ["facilities"] });
    const token = createSessionRecord(db, user.id);
    db.prepare("INSERT INTO user_categories (user_id, category_id, created_at) VALUES (?, ?, ?)").run(user.id, categoryId(db, "operations"), new Date().toISOString());
    expect(resolveSession(db, token)?.categoryIds).toHaveLength(2);
    // Inactive categories grant nothing.
    db.prepare("UPDATE categories SET status = 'inactive' WHERE slug = 'operations'").run();
    expect(resolveSession(db, token)?.categoryIds).toHaveLength(1);
    // Disabling the account ends the session immediately.
    db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(user.id);
    expect(resolveSession(db, token)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
  });

  it("revokes sessions on logout and per user, optionally keeping the current one", () => {
    const user = insertUser(db);
    const a = createSessionRecord(db, user.id);
    const b = createSessionRecord(db, user.id);
    deleteUserSessions(db, user.id, a);
    expect(resolveSession(db, a)).not.toBeNull();
    expect(resolveSession(db, b)).toBeNull();
    deleteSessionByToken(db, a);
    expect(resolveSession(db, a)).toBeNull();
  });
});

describe("login throttling", () => {
  it("authenticates case-insensitively and reports disabled accounts only after a correct password", async () => {
    insertUser(db, { email: "Person@Example.com" });
    insertUser(db, { email: "off@example.com", status: "disabled" });
    const limiter = new MemoryRateLimiter();
    expect((await attemptLogin(limiter, "ip", "PERSON@example.com", TEST_PASSWORD)).kind).toBe("ok");
    expect((await attemptLogin(limiter, "ip", "off@example.com", "wrong-password")).kind).toBe("invalid");
    expect((await attemptLogin(limiter, "ip", "off@example.com", TEST_PASSWORD)).kind).toBe("disabled");
    expect((await attemptLogin(limiter, "ip", "nobody@example.com", TEST_PASSWORD)).kind).toBe("invalid");
    expect((await attemptLogin(limiter, "ip", "", "")).kind).toBe("invalid_request");
  });

  it("locks an account after repeated failures, even with the right password", async () => {
    insertUser(db, { email: "target@example.com" });
    const limiter = new SqliteRateLimiter(db);
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT; i += 1) {
      expect((await attemptLogin(limiter, `ip-${i}`, "target@example.com", "guess")).kind).toBe("invalid");
    }
    const blocked = await attemptLogin(limiter, "another-ip", "target@example.com", TEST_PASSWORD);
    expect(blocked.kind).toBe("throttled");
    if (blocked.kind === "throttled") expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("throttles a single source across many accounts", async () => {
    const limiter = new SqliteRateLimiter(db);
    for (let i = 0; i < MAX_FAILURES_PER_IP; i += 1) await attemptLogin(limiter, "203.0.113.9", `user${i}@example.com`, "guess");
    expect((await attemptLogin(limiter, "203.0.113.9", "fresh@example.com", "guess")).kind).toBe("throttled");
    expect((await attemptLogin(limiter, "198.51.100.1", "fresh@example.com", "guess")).kind).toBe("invalid");
  });

  it("starts a new window once the old one expires", () => {
    const limiter = new SqliteRateLimiter(db);
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) limiter.recordFailure("k", 1000, now);
    expect(limiter.check("k", 3, now).allowed).toBe(false);
    expect(limiter.check("k", 3, now + 1001).allowed).toBe(true);
    limiter.recordFailure("k", 1000, now + 1001);
    expect(limiter.check("k", 3, now + 1001).allowed).toBe(true);
  });
});

describe("client IP", () => {
  const headers = (xff: string) => new Headers({ "x-forwarded-for": xff });
  it("ignores forwarded headers unless proxies are trusted", () => {
    expect(clientIp(headers("1.2.3.4"), 0)).toBe(UNTRUSTED_CLIENT);
  });
  it("reads the address appended by the outermost trusted proxy", () => {
    // A client can prepend anything; only the trusted hops' entries count.
    expect(clientIp(headers("6.6.6.6, 203.0.113.7"), 1)).toBe("203.0.113.7");
    expect(clientIp(headers("6.6.6.6, 203.0.113.7, 10.0.0.2"), 2)).toBe("203.0.113.7");
    expect(clientIp(headers("not-an-ip"), 1)).toBe(UNTRUSTED_CLIENT);
  });
});
