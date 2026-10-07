import "server-only";
import path from "node:path";
import { PASSWORD_MIN_LENGTH } from "@/lib/config";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/time";

/**
 * Runtime settings read from the environment, validated once. See `.env.example` and the README.
 */

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[secure-forms-portal] ${message}`);
}

export const isProduction = () => process.env.NODE_ENV === "production";

export function databasePath() {
  return process.env.PORTAL_DB_PATH || path.join(process.cwd(), ".data", "portal.sqlite");
}

/** IANA time zone used to display timestamps and to interpret date filters. */
export function displayTimeZone() {
  const value = process.env.PORTAL_TIMEZONE?.trim();
  if (!value) return DEFAULT_TIME_ZONE;
  if (isValidTimeZone(value)) return value;
  warnOnce("tz", `PORTAL_TIMEZONE "${value}" is not a valid IANA time zone; using ${DEFAULT_TIME_ZONE}.`);
  return DEFAULT_TIME_ZONE;
}

/**
 * Number of reverse proxies in front of the app whose X-Forwarded-For entries can be trusted.
 * 0 ignores forwarded headers entirely (they can be forged by any client).
 */
export function trustedProxyHops() {
  const raw = process.env.PORTAL_TRUSTED_PROXY_HOPS?.trim();
  if (!raw) {
    if (isProduction()) {
      warnOnce("proxy", "PORTAL_TRUSTED_PROXY_HOPS is not set: per-IP login throttling treats all clients as one source.");
    }
    return 0;
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
    warnOnce("proxy-invalid", `PORTAL_TRUSTED_PROXY_HOPS "${raw}" must be an integer from 0 to 10; using 0.`);
    return 0;
  }
  return hops;
}

/** Session cookies are Secure in production unless explicitly disabled for plain-HTTP testing. */
export function cookieSecure() {
  if (process.env.PORTAL_COOKIE_SECURE === "false") return false;
  return isProduction();
}

export type DemoSeedSettings = { password: string };

/** Demo data is created only when PORTAL_SEED_DEMO=true and a demo password is configured. */
export function demoSeedSettings(): DemoSeedSettings | null {
  if (process.env.PORTAL_SEED_DEMO !== "true") return null;
  const password = process.env.PORTAL_DEMO_PASSWORD ?? "";
  if (password.length < PASSWORD_MIN_LENGTH) {
    warnOnce("demo", `PORTAL_DEMO_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters; demo data was not created.`);
    return null;
  }
  if (isProduction()) warnOnce("demo-prod", "PORTAL_SEED_DEMO is enabled in production. Demo accounts will exist.");
  return { password };
}

export type BootstrapAdminSettings = { email: string; password: string; name: string };

/** First administrator for a real deployment, only used while no administrator exists. */
export function bootstrapAdminSettings(): BootstrapAdminSettings | null {
  const email = process.env.PORTAL_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PORTAL_BOOTSTRAP_ADMIN_PASSWORD ?? "";
  if (!email || !password) return null;
  if (password.length < PASSWORD_MIN_LENGTH) {
    warnOnce("bootstrap", `PORTAL_BOOTSTRAP_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters; skipped.`);
    return null;
  }
  return { email, password, name: process.env.PORTAL_BOOTSTRAP_ADMIN_NAME?.trim() || "Administrator" };
}
