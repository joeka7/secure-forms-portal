import "server-only";
import { isIP } from "node:net";

/**
 * Client IP for throttling. X-Forwarded-For can be forged by any client, so it is only read when the
 * operator declares how many trusted proxies sit in front of the app: each trusted proxy appends the
 * address it received the request from, so the client is the entry `hops` places from the end.
 *
 * Without trusted proxies, every request shares one bucket (UNTRUSTED_CLIENT): per-IP throttling then
 * acts as a global brake, and per-account throttling still applies.
 */

export const UNTRUSTED_CLIENT = "untrusted";

export function clientIp(headers: Headers, trustedHops: number) {
  if (trustedHops <= 0) return UNTRUSTED_CLIENT;
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (chain.length === 0) return UNTRUSTED_CLIENT;
  const candidate = chain[Math.max(0, chain.length - trustedHops)];
  return isIP(candidate) ? candidate.toLowerCase() : UNTRUSTED_CLIENT;
}
