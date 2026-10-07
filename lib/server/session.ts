import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_COOKIE_NAME } from "@/lib/config";
import { getDb } from "@/lib/server/db";
import { createSessionRecord, deleteSessionByToken, resolveSession } from "@/lib/server/session-store";
import { cookieSecure } from "@/lib/server/settings";
import type { SessionUser } from "@/lib/types";

/** Cookie layer over `session-store`. The cookie is HttpOnly, SameSite=Lax and Secure in production. */

export function currentSessionToken() {
  return cookies().get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** The signed-in user (re-read from the database), or null. Memoised per request. */
export const getSessionUser = cache((): SessionUser | null => resolveSession(getDb(), currentSessionToken() ?? undefined));

function writeCookie(value: string, maxAgeSeconds: number) {
  cookies().set({
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

/** Route handlers only: start a new session and set its cookie, replacing any session this browser had. */
export function startSession(userId: string) {
  const previous = currentSessionToken();
  if (previous) deleteSessionByToken(getDb(), previous);
  writeCookie(createSessionRecord(getDb(), userId), Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000));
}

/** Route handlers only: revoke the current session and clear its cookie. */
export function endCurrentSession() {
  const token = currentSessionToken();
  if (token) deleteSessionByToken(getDb(), token);
  writeCookie("", 0);
}
