/**
 * Constants shared by middleware (edge runtime), server code and client components.
 * Keep this file free of Node-only imports.
 */

export const APP_NAME = "Secure Forms Portal";

export const SESSION_COOKIE_NAME = "sfp_session";

/** A session ends after this much inactivity. */
export const SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
/** A session never lives longer than this, regardless of activity. */
export const SESSION_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

export const HOME_PATH = "/forms";
export const LOGIN_PATH = "/login";

/** Authenticated page routes. */
export const APP_PAGE_PREFIXES = ["/forms", "/submissions", "/users"] as const;

export function isAppPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  return APP_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Post-login redirect target. Only same-origin paths inside the application are allowed, so the
 * `next` parameter can never be used as an open redirect.
 */
export function safeRedirectPath(next: string | null | undefined) {
  if (!next || typeof next !== "string" || next.length > 2048) return HOME_PATH;
  // Absolute or protocol-relative URLs, backslashes (treated as "/" by browsers) and control characters.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return HOME_PATH;
  const path = next.split(/[?#]/)[0];
  if (!isAppPath(path)) return HOME_PATH;
  return next;
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** Largest JSON request body accepted by mutation endpoints. */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;
