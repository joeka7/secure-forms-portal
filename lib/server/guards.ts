import "server-only";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/config";
import { getSessionUser } from "@/lib/server/session";
import type { SessionUser } from "@/lib/types";

/**
 * Server component guard: the signed-in user, or a redirect to the login page. The middleware only
 * checks that a cookie exists; this is where the session is actually validated.
 */
export function requirePageUser(returnTo: string): SessionUser {
  const user = getSessionUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(returnTo)}`);
  return user;
}
