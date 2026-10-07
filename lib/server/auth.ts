import "server-only";
import { PASSWORD_MAX_LENGTH } from "@/lib/config";
import { getDb } from "@/lib/server/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/server/password";
import type { RateLimiter } from "@/lib/server/rate-limit";
import type { UserStatus } from "@/lib/types";

export type AuthResult = { kind: "ok"; userId: string } | { kind: "invalid" } | { kind: "disabled" };

/**
 * Check credentials. Unknown emails still spend a full password verification so timing does not
 * reveal which accounts exist, and a disabled account is only reported after a correct password.
 */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const user = getDb()
    .prepare("SELECT id, password_hash, status FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as { id: string; password_hash: string; status: UserStatus } | undefined;

  if (!user) {
    await burnPasswordCheck(password);
    return { kind: "invalid" };
  }
  if (!(await verifyPassword(password, user.password_hash))) return { kind: "invalid" };
  if (user.status !== "active") return { kind: "disabled" };
  return { kind: "ok", userId: user.id };
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_ACCOUNT = 5;
export const MAX_FAILURES_PER_IP = 30;

export type LoginOutcome =
  | { kind: "ok"; userId: string }
  | { kind: "invalid_request" }
  | { kind: "invalid" }
  | { kind: "disabled" }
  | { kind: "throttled"; retryAfterSeconds: number };

/**
 * The login use case: input checks, per-account and per-IP throttling, then credential verification.
 * Failed attempts count against both keys; a success clears the account's counter.
 */
export async function attemptLogin(limiter: RateLimiter, ip: string, rawEmail: unknown, rawPassword: unknown): Promise<LoginOutcome> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  if (!email || !password || email.length > 254 || password.length > PASSWORD_MAX_LENGTH) return { kind: "invalid_request" };

  const ipKey = `login:ip:${ip}`;
  const accountKey = `login:account:${email}`;
  const ipStatus = limiter.check(ipKey, MAX_FAILURES_PER_IP);
  const accountStatus = limiter.check(accountKey, MAX_FAILURES_PER_ACCOUNT);
  if (!ipStatus.allowed || !accountStatus.allowed) {
    return { kind: "throttled", retryAfterSeconds: Math.max(ipStatus.retryAfterSeconds, accountStatus.retryAfterSeconds) };
  }

  const result = await authenticate(email, password);
  if (result.kind === "invalid") {
    limiter.recordFailure(ipKey, LOGIN_WINDOW_MS);
    limiter.recordFailure(accountKey, LOGIN_WINDOW_MS);
    return result;
  }
  if (result.kind === "ok") limiter.reset(accountKey);
  return result;
}
