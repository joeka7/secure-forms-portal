import { safeRedirectPath } from "@/lib/config";
import { attemptLogin } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { getDb } from "@/lib/server/db";
import { asRecord, errorResponse, isSameOriginRequest, jsonResponse, readJsonBody, serverError } from "@/lib/server/http";
import { SqliteRateLimiter } from "@/lib/server/rate-limit";
import { startSession } from "@/lib/server/session";
import { trustedProxyHops } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

const INVALID_CREDENTIALS = "The email or password is incorrect.";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return errorResponse(403, "csrf", "Cross-site request rejected.");
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.body);

  try {
    const outcome = await attemptLogin(new SqliteRateLimiter(getDb()), clientIp(req.headers, trustedProxyHops()), body.email, body.password);
    switch (outcome.kind) {
      case "invalid_request":
        return errorResponse(400, "invalid_request", "Enter your email and password.");
      case "throttled":
        return errorResponse(
          429,
          "too_many_attempts",
          "Too many sign-in attempts. Please wait a few minutes and try again.",
          { retryAfter: outcome.retryAfterSeconds },
          { "Retry-After": String(outcome.retryAfterSeconds) }
        );
      case "invalid":
        return errorResponse(401, "invalid_credentials", INVALID_CREDENTIALS);
      case "disabled":
        // Only reachable with the correct password, so it reveals nothing to a guesser.
        return errorResponse(403, "account_disabled", "This account has been disabled. Please contact an administrator.");
      case "ok":
        startSession(outcome.userId);
        return jsonResponse({ ok: true, redirectTo: safeRedirectPath(typeof body.next === "string" ? body.next : null) });
    }
  } catch (error) {
    return serverError("Login failed", error);
  }
}
