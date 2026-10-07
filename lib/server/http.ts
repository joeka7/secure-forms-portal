import "server-only";
import { NextResponse } from "next/server";
import { isAdministrator } from "@/lib/authz";
import { MAX_JSON_BODY_BYTES } from "@/lib/config";
import { getSessionUser } from "@/lib/server/session";
import { trustedProxyHops } from "@/lib/server/settings";
import type { SessionUser } from "@/lib/types";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(status: number, error: string, message: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return jsonResponse({ error, message, ...extra }, status, headers);
}

export const unauthorized = () => errorResponse(401, "unauthenticated", "Please sign in to continue.");
export const forbidden = (message = "You don't have permission to access this resource.") => errorResponse(403, "forbidden", message);
export const notFound = () => errorResponse(404, "not_found", "Not found.");

/**
 * CSRF defence for state-changing requests. The session cookie is SameSite=Lax; in addition every
 * mutation must come from this origin (Fetch Metadata, falling back to the Origin header) and carry a
 * JSON body, which a cross-site HTML form cannot send.
 */
export function isSameOriginRequest(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return true; // Not a browser: there are no ambient cookies to abuse.
  // Behind a trusted proxy the public host arrives in X-Forwarded-Host.
  const host = (trustedProxyHops() > 0 && req.headers.get("x-forwarded-host")) || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type BodyResult = { ok: true; body: unknown } | { ok: false; response: NextResponse };

/** Read a JSON body with a hard size limit, whether or not Content-Length is declared. */
export async function readJsonBody(req: Request): Promise<BodyResult> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: errorResponse(415, "unsupported_media_type", "Expected a JSON request body.") };
  }
  const tooLarge = () => ({ ok: false as const, response: errorResponse(413, "payload_too_large", "Request body is too large.") });
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) return tooLarge();

  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return tooLarge();
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: errorResponse(400, "invalid_json", "Request body is not valid JSON.") };
  }
}

/** The body as a plain object ({} for anything else), so handlers can read fields safely. */
export function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

type GuardOptions = { administrator?: boolean; mutation?: boolean };
type GuardResult = { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse };

/** Authenticate (and optionally require an administrator for) an API request. */
export function guardApi(req: Request, options: GuardOptions = {}): GuardResult {
  if (options.mutation && !isSameOriginRequest(req)) {
    return { response: errorResponse(403, "csrf", "Cross-site request rejected.") };
  }
  const user = getSessionUser();
  if (!user) return { response: unauthorized() };
  if (options.administrator && !isAdministrator(user)) return { response: forbidden() };
  return { user };
}

/** Logs a server error without leaking request data, and returns a generic 500. */
export function serverError(context: string, error: unknown, message = "Something went wrong on our side. Please try again.") {
  console.error(`[secure-forms-portal] ${context}:`, error instanceof Error ? error.message : "unknown error");
  return errorResponse(500, "server_error", message);
}
