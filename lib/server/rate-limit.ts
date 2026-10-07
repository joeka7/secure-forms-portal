import "server-only";
import type { DB } from "@/lib/server/db";

/**
 * Fixed-window failure counters for login throttling.
 *
 * `RateLimiter` is an interface so the store can match the deployment: the default SQLite store is
 * shared by every process using the same database file and survives restarts; a multi-host
 * deployment would implement the same three methods on a shared store such as Redis.
 */

export type RateLimitStatus = { allowed: boolean; retryAfterSeconds: number };

export interface RateLimiter {
  /** Whether another attempt is allowed under `limit` failures per window. */
  check(key: string, limit: number, now?: number): RateLimitStatus;
  /** Count one failure; a new window starts when the previous one has expired. */
  recordFailure(key: string, windowMs: number, now?: number): void;
  reset(key: string): void;
}

const status = (count: number, resetAt: number, limit: number, now: number): RateLimitStatus => {
  if (resetAt <= now) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: count < limit, retryAfterSeconds: Math.ceil((resetAt - now) / 1000) };
};

export class SqliteRateLimiter implements RateLimiter {
  constructor(private readonly db: DB) {}

  check(key: string, limit: number, now = Date.now()) {
    const row = this.db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as
      | { count: number; reset_at: number }
      | undefined;
    return row ? status(row.count, row.reset_at, limit, now) : { allowed: true, retryAfterSeconds: 0 };
  }

  recordFailure(key: string, windowMs: number, now = Date.now()) {
    // One atomic upsert: expired windows restart at 1, live windows increment.
    this.db
      .prepare(
        `INSERT INTO rate_limits (key, count, reset_at) VALUES (@key, 1, @resetAt)
         ON CONFLICT (key) DO UPDATE SET
           count    = CASE WHEN rate_limits.reset_at <= @now THEN 1 ELSE rate_limits.count + 1 END,
           reset_at = CASE WHEN rate_limits.reset_at <= @now THEN @resetAt ELSE rate_limits.reset_at END`
      )
      .run({ key, now, resetAt: now + windowMs });
    this.db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(now);
  }

  reset(key: string) {
    this.db.prepare("DELETE FROM rate_limits WHERE key = ?").run(key);
  }
}

/** In-process store for tests or a single-process deployment without a database. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, now = Date.now()) {
    const bucket = this.buckets.get(key);
    return bucket ? status(bucket.count, bucket.resetAt, limit, now) : { allowed: true, retryAfterSeconds: 0 };
  }

  recordFailure(key: string, windowMs: number, now = Date.now()) {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) this.buckets.set(key, { count: 1, resetAt: now + windowMs });
    else bucket.count += 1;
  }

  reset(key: string) {
    this.buckets.delete(key);
  }
}
